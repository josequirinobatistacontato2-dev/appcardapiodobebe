import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { Resend } from "resend";
import fs from "fs";

dotenv.config();

/**
 * SQL PARA CRIAR A TABELA NO SUPABASE:
 * 
 * create table password_resets (
 *   id uuid default gen_random_uuid() primary key,
 *   email text not null,
 *   token text not null unique,
 *   expires_at timestamp with time zone not null,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Habilitar RLS e permitir que o service_role gerencie tudo
 * alter table password_resets enable row level security;
 */

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zisijswmqoxtfxlgjwgr.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseServiceKey) {
    console.warn("AVISO: SUPABASE_SERVICE_ROLE_KEY não configurada. O sistema de recuperação de senha não funcionará.");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // API: Solicitar Reset de Senha
  app.post("/api/auth/request-reset", async (req, res) => {
    const { email } = req.body;
    const emailLimpo = email.trim().toLowerCase();

    try {
      // 1. Gerar token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      // 2. Salvar na tabela password_resets
      const { error: dbError } = await supabaseAdmin
        .from("password_resets")
        .insert([{ email: emailLimpo, token, expires_at: expiresAt.toISOString() }]);

      if (dbError) throw dbError;

      // 3. Enviar e-mail
      const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset?token=${token}`;
      
      console.log(`[AUTH] Link de recuperação para ${emailLimpo}: ${resetLink}`);

      if (resend) {
        await resend.emails.send({
          from: "Cardápio do Bebê <noreply@appcardapiodobebe.com>",
          to: emailLimpo,
          subject: "Recuperação de Senha",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Recuperação de Senha</h2>
              <p>Olá! Você solicitou a recuperação de senha para sua conta no Cardápio do Bebê Saudável.</p>
              <p>Clique no botão abaixo para definir uma nova senha. Este link expira em 1 hora.</p>
              <a href="${resetLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 99px; text-decoration: none; font-weight: bold; margin: 20px 0;">Definir Nova Senha</a>
              <p>Se você não solicitou isso, ignore este e-mail.</p>
            </div>
          `
        });
      }

      res.json({ success: true, message: "E-mail enviado com sucesso." });
    } catch (error: any) {
      console.error("Erro ao solicitar reset:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: Validar Token e Resetar Senha
  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, novaSenha } = req.body;

    try {
      // 1. Verificar token
      const { data: resetData, error: fetchError } = await supabaseAdmin
        .from("password_resets")
        .select("*")
        .eq("token", token)
        .single();

      if (fetchError || !resetData) {
        return res.status(400).json({ error: "Token inválido ou expirado." });
      }

      const reset = resetData as any;

      const isExpired = new Date() > new Date(reset.expires_at);
      if (isExpired) {
        await supabaseAdmin.from("password_resets").delete().eq("token", token);
        return res.status(400).json({ error: "Token expirado." });
      }

      // 2. Buscar usuário pelo e-mail
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
      if (userError) throw userError;

      const user = userData.users.find((u: any) => u.email?.toLowerCase() === reset.email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      // 3. Atualizar senha via Admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: novaSenha
      });

      if (updateError) throw updateError;

      // 4. Deletar token usado
      await supabaseAdmin.from("password_resets").delete().eq("token", token);

      res.json({ success: true, message: "Senha atualizada com sucesso." });
    } catch (error: any) {
      console.error("Erro ao resetar senha:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Iniciando Vite em modo middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use((req, res, next) => {
      console.log(`[VITE] Request: ${req.method} ${req.url}`);
      vite.middlewares(req, res, next);
    });

    app.use, async (req, res, next) => {
      const url = req.originalUrl;
      console.log(`[SERVER] Serving index.html for ${url}`);
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

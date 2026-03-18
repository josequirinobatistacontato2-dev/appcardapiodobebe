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

  app.get("/test-server", (req, res) => {
    res.send("Server is running correctly on port 3000");
  });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zisijswmqoxtfxlgjwgr.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppc2lqc3dtcW94dGZ4bGdqd2dyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM0MzYxMSwiZXhwIjoyMDg2OTE5NjExfQ.D3PUlmBb_q6M6G8O30AHN_md52d6V5Hou2NH1Xz8oT0';
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("AVISO: SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente. Usando fallback.");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const resendKey = process.env.RESEND_API_KEY || 're_EPhXPhdr_C2o2bsnSa2CWTNsfQ7wJT3A2';
  const resend = resendKey ? new Resend(resendKey) : null;

  // API: Solicitar Reset de Senha (Unificado)
  app.post("/api/reset-password", async (req, res) => {
    console.log(`[SERVER] Recebida requisição em /api/reset-password: ${req.method} ${JSON.stringify(req.body)}`);
    const { email, token, novaSenha } = req.body;

    // Fluxo 1: Resetar senha com token
    if (token && novaSenha) {
      try {
        console.log(`[AUTH] Tentando resetar senha com token: ${token.substring(0, 8)}...`);
        
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

        return res.json({ success: true, message: "Senha atualizada com sucesso." });
      } catch (error: any) {
        console.error("Erro ao resetar senha com token:", error);
        return res.status(500).json({ error: error.message });
      }
    }

    // Fluxo 2: Solicitar reset por e-mail
    if (email) {
      const emailLimpo = email.trim().toLowerCase();
      try {
        console.log(`[AUTH] Solicitando reset para: ${emailLimpo}`);
        
        // 1. Gerar token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 3600000); // 1 hora

        // 2. Salvar na tabela password_resets
        const { error: dbError } = await supabaseAdmin
          .from("password_resets")
          .insert([{ email: emailLimpo, token, expires_at: expiresAt.toISOString() }]);

        if (dbError) throw dbError;

        // 3. Enviar e-mail
        const rawAppUrl = process.env.APP_URL || process.env.URL_DO_APLICATIVO || 'http://localhost:3000';
        const appUrl = rawAppUrl.replace(/\/$/, '');
        const resetLink = `${appUrl}/reset?token=${token}`;
        
        console.log(`[AUTH] Link de recuperação gerado: ${resetLink}`);

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

        return res.json({ success: true, message: "E-mail enviado com sucesso." });
      } catch (error: any) {
        console.error("Erro ao solicitar reset:", error);
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(400).json({ error: "E-mail ou Token/Senha ausentes." });
  });

  // API: Solicitar Reset de Senha (Antigo, mantido para compatibilidade)
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
      const rawAppUrl = process.env.APP_URL || process.env.URL_DO_APLICATIVO || 'http://localhost:3000';
      const appUrl = rawAppUrl.replace(/\/$/, '');
      const resetLink = `${appUrl}/reset?token=${token}`;
      
      console.log(`[AUTH] Link de recuperação gerado: ${resetLink}`);

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

  // 404 para rotas de API não encontradas
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.url}` });
  });

  console.log(`[SERVER] Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] APP_URL: ${process.env.APP_URL || 'Não definida'}`);
  console.log(`[SERVER] URL_DO_APLICATIVO: ${process.env.URL_DO_APLICATIVO || 'Não definida'}`);
  // Forçamos modo desenvolvimento se não estiver explicitamente em produção
  const isProd = process.env.NODE_ENV === "production";
  
  // Rota específica para reset para evitar problemas de diretório
  app.get("/reset", async (req, res, next) => {
    console.log(`[SERVER] Acessando rota /reset. Token presente: ${!!req.query.token}`);
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      const indexPath = path.join(process.cwd(), "dist", "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    next();
  });

  // Vite middleware
  if (!isProd) {
    console.log("[SERVER] Iniciando Vite em modo middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Fallback para index.html (Vite spa mode deve cuidar disso, mas garantimos)
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
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

  // Error handler global
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[SERVER] Erro na requisição:", err);
    res.status(500).json({ error: "Erro interno do servidor", details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Health check disponível em http://0.0.0.0:${PORT}/api/health`);
  });
}

console.log("[SERVER] Iniciando script server.ts...");
startServer().catch(err => {
  console.error("[SERVER] Erro fatal ao iniciar servidor:", err);
  process.exit(1);
});

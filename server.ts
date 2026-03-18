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

  // API: Solicitar Reset de Senha (Unificado) - REMOVIDO PARA USAR O SISTEMA NATIVO DO SUPABASE
  // O frontend agora chama supabase.auth.resetPasswordForEmail diretamente
  app.post("/api/reset-password", async (req, res) => {
    res.status(410).json({ error: "Este endpoint foi desativado. Use o sistema nativo do Supabase Auth." });
  });

  // API: Solicitar Reset de Senha (Antigo) - REMOVIDO
  app.post("/api/auth/request-reset", async (req, res) => {
    res.status(410).json({ error: "Este endpoint foi desativado." });
  });

  // API: Validar Token e Resetar Senha (Antigo) - REMOVIDO
  app.post("/api/auth/reset-password", async (req, res) => {
    res.status(410).json({ error: "Este endpoint foi desativado." });
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

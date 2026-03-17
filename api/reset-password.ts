import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // Garantir que sempre retorne JSON
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // Verificar se o corpo da requisição existe
  if (!req.body) {
    return res.status(400).json({ error: 'Corpo da requisição ausente.' });
  }

  const { email, token, novaSenha } = req.body;

  // Se houver token e novaSenha, estamos tentando resetar a senha (fluxo customizado)
  if (token && novaSenha) {
    return handleResetWithToken(req, res, token, novaSenha);
  }

  // Caso contrário, estamos solicitando o reset (fluxo padrão)
  if (!email) {
    return res.status(400).json({ error: 'O e-mail é obrigatório.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zisijswmqoxtfxlgjwgr.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppc2lqc3dtcW94dGZ4bGdqd2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2MTEsImV4cCI6MjA4NjkxOTYxMX0.TbdEZhZZj2CigOny6DoWnaZ9Kt3eEspJDJ9uajLjVN0';

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    console.log(`[API] Solicitando reset de senha para: ${email}`);
    
    // Determinar a URL de redirecionamento dinamicamente
    const rawAppUrl = process.env.APP_URL || process.env.URL_DO_APLICATIVO || 'https://appcardapiodobebe.com';
    const appUrl = rawAppUrl.replace(/\/$/, '');
    const redirectTo = `${appUrl}/nova-senha`;

    console.log(`[API] RedirectTo configurado como: ${redirectTo}`);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
    });

    if (error) {
      console.error('[API] Erro Supabase:', error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Instruções de recuperação enviadas para o seu e-mail.' 
    });
  } catch (err: any) {
    console.error('[API] Erro interno:', err.message);
    return res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
}

async function handleResetWithToken(req: any, res: any, token: string, novaSenha: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zisijswmqoxtfxlgjwgr.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppc2lqc3dtcW94dGZ4bGdqd2dyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM0MzYxMSwiZXhwIjoyMDg2OTE5NjExfQ.D3PUlmBb_q6M6G8O30AHN_md52d6V5Hou2NH1Xz8oT0';

  if (!supabaseServiceKey) {
    return res.status(500).json({ error: 'Configuração de administrador ausente no servidor.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // 1. Verificar token na tabela password_resets
    const { data: resetData, error: fetchError } = await supabaseAdmin
      .from("password_resets")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !resetData) {
      return res.status(400).json({ error: "Token inválido ou expirado." });
    }

    const isExpired = new Date() > new Date(resetData.expires_at);
    if (isExpired) {
      await supabaseAdmin.from("password_resets").delete().eq("token", token);
      return res.status(400).json({ error: "Token expirado." });
    }

    // 2. Buscar usuário pelo e-mail
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) throw userError;

    const user = userData.users.find((u: any) => u.email?.toLowerCase() === resetData.email.toLowerCase());
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

    return res.status(200).json({ success: true, message: "Senha atualizada com sucesso." });
  } catch (error: any) {
    console.error("[API] Erro ao resetar senha com token:", error);
    return res.status(500).json({ error: error.message });
  }
}

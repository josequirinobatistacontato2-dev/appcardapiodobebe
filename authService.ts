import { supabase } from './supabaseClient';

/**
 * Verifica se o e-mail tem permissão para acessar o sistema
 * Regra: Deve existir na tabela 'sales' e ter status 'ativo'
 */
export const verificarPermissao = async (email: string, adminEmail?: string) => {
  const emailLimpo = email.trim().toLowerCase();
  
  // BYPASS: Se for o e-mail do administrador, permite sempre
  if (adminEmail && emailLimpo === adminEmail.toLowerCase()) {
    console.log('Bypass de administrador para:', emailLimpo);
    return true;
  }

  console.log('Verificando permissão para:', emailLimpo);

  // Busca todas as vendas vinculadas a este e-mail
  const { data: sales, error } = await supabase
    .from('sales')
    .select('status, expires_at')
    .eq('email', emailLimpo);

  if (error) {
    console.error('Erro Supabase ao verificar permissão:', error);
    throw new Error('Erro técnico ao verificar acesso. Tente novamente.');
  }

  if (!sales || sales.length === 0) {
    console.warn('Nenhum registro encontrado na tabela sales para:', emailLimpo);
    throw new Error('E-mail não encontrado na base de compradores. Verifique se sua compra foi aprovada ou se usou o mesmo e-mail da Hotmart.');
  }

  // Verifica se pelo menos uma das compras está ativa e não expirada
  const temAcessoAtivo = sales.some(sale => {
    const isAtivo = sale.status === 'ativo';
    const isNotExpired = !sale.expires_at || new Date() <= new Date(sale.expires_at);
    return isAtivo && isNotExpired;
  });

  if (!temAcessoAtivo) {
    // Se encontrou o e-mail mas nenhum está ativo
    const statusAtual = sales[0].status;
    if (statusAtual === 'suspenso') {
      throw new Error('Seu acesso está suspenso. Entre em contato com o suporte.');
    }
    throw new Error('Seu acesso expirou ou ainda não foi ativado. Verifique o status na Hotmart.');
  }

  return true;
};

/**
 * Solicita o reset de senha por e-mail
 */
export const solicitarResetSenha = async (email: string, adminEmail?: string) => {
  const emailLimpo = email.trim().toLowerCase();
  
  // 1. Verificar se o usuário tem permissão/existe na tabela sales
  // Isso evita que o Supabase "finja" que enviou e-mail para quem não é cliente
  await verificarPermissao(emailLimpo, adminEmail);

  const { data, error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
    redirectTo: "https://www.appcardapiodobebe.com/#/nova-senha",
  });
  
  if (error) {
    console.error('Erro Supabase ao solicitar reset:', error);
    throw error;
  }
  
  return data;
};

/**
 * Atualiza a senha do usuário (usado na página de nova senha)
 */
export const atualizarSenha = async (novaSenha: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: novaSenha,
  });
  if (error) throw error;
  return data;
};

/**
 * Cria uma conta no Supabase Auth se o usuário tiver permissão
 */
export const criarConta = async (email: string, senha: string, nome?: string, adminEmail?: string) => {
  // 1. Verificar permissão na tabela sales antes de permitir o cadastro
  await verificarPermissao(email, adminEmail);

  // 2. Se passou na verificação, criar no Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        full_name: nome,
      },
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Realiza o login e verifica o status logo em seguida
 */
export const login = async (email: string, senha: string, adminEmail?: string) => {
  // 1. Tentar login no Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) throw error;

  // 2. Verificar se o status ainda é ativo após o login
  try {
    await verificarStatusAtivo(email, adminEmail);
  } catch (err: any) {
    // Se não estiver ativo, deslogar imediatamente
    await supabase.auth.signOut();
    throw err;
  }

  return data;
};

/**
 * Verifica se o usuário logado ainda possui status ativo
 * Se estiver suspenso, realiza o logout
 */
export const verificarStatusAtivo = async (email: string, adminEmail?: string) => {
  const emailLimpo = email.trim().toLowerCase();

  // BYPASS: Se for o e-mail do administrador, permite sempre
  if (adminEmail && emailLimpo === adminEmail.toLowerCase()) {
    return true;
  }

  const { data: sales, error } = await supabase
    .from('sales')
    .select('status, expires_at')
    .eq('email', emailLimpo);

  if (error || !sales || sales.length === 0) {
    await supabase.auth.signOut();
    const message = 'Seu acesso não foi encontrado.';
    throw new Error(message);
  }

  const temAcessoAtivo = sales.some(sale => {
    const isAtivo = sale.status === 'ativo';
    const isNotExpired = !sale.expires_at || new Date() <= new Date(sale.expires_at);
    return isAtivo && isNotExpired;
  });

  if (!temAcessoAtivo) {
    await supabase.auth.signOut();
    const message = 'Seu acesso expirou ou foi suspenso.';
    throw new Error(message);
  }

  return true;
};

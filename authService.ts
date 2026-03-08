import { supabase } from './supabaseClient';

/**
 * Verifica se o e-mail tem permissão para acessar o sistema
 * Regra: Deve existir na tabela 'sales' e ter status 'ativo'
 */
export const verificarPermissao = async (email: string) => {
  const emailLimpo = email.trim().toLowerCase();
  console.log('Verificando permissão para:', emailLimpo);

  const { data, error } = await supabase
    .from('sales')
    .select('status, expires_at')
    .eq('email', emailLimpo)
    .maybeSingle();

  if (error) {
    console.error('Erro Supabase ao verificar permissão:', error);
    throw new Error('Erro técnico ao verificar acesso. Tente novamente.');
  }

  if (!data) {
    console.warn('Nenhum registro encontrado na tabela sales para:', emailLimpo);
    throw new Error('E-mail não encontrado na base de compradores. Verifique se sua compra foi aprovada ou se usou o mesmo e-mail da Hotmart.');
  }

  // 1. Verificar se o status é suspenso
  if (data.status === 'suspenso') {
    throw new Error('Seu acesso está suspenso. Entre em contato com o suporte.');
  }

  // 2. Verificar se o acesso expirou
  if (data.expires_at && new Date() > new Date(data.expires_at)) {
    throw new Error('Seu acesso de 1 ano expirou. Realize uma nova compra para continuar.');
  }

  if (data.status !== 'ativo') {
    throw new Error('Acesso não autorizado para este status.');
  }

  return true;
};

/**
 * Solicita o reset de senha por e-mail
 */
export const solicitarResetSenha = async (email: string) => {
  const emailLimpo = email.trim().toLowerCase();
  
  // 1. Verificar se o usuário tem permissão/existe na tabela sales
  // Isso evita que o Supabase "finja" que enviou e-mail para quem não é cliente
  await verificarPermissao(emailLimpo);

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
export const criarConta = async (email: string, senha: string, nome?: string) => {
  // 1. Verificar permissão na tabela sales antes de permitir o cadastro
  await verificarPermissao(email);

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
export const login = async (email: string, senha: string) => {
  // 1. Tentar login no Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) throw error;

  // 2. Verificar se o status ainda é ativo após o login
  try {
    await verificarStatusAtivo(email);
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
export const verificarStatusAtivo = async (email: string) => {
  const { data, error } = await supabase
    .from('sales')
    .select('status, expires_at')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  const isExpired = data?.expires_at && new Date() > new Date(data.expires_at);

  if (error || !data || data.status === 'suspenso' || isExpired) {
    await supabase.auth.signOut();
    const message = isExpired 
      ? 'Seu acesso expirou.' 
      : 'Seu acesso foi suspenso ou não foi encontrado.';
    throw new Error(message);
  }

  return true;
};

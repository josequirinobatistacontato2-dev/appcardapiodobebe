import { supabase } from './supabaseClient';

// Lista de status considerados ativos para liberação de acesso
export const ACTIVE_STATUSES = [
  'ativo', 'approved', 'pago', 'concluido', 'complete',
  'ativa', 'active', 'aprovado', 'aprovada', 'completo', 'completa',
  'paga', 'finalizado', 'finalizada', 'concluida', 'disponivel', 'disponível'
];

/**
 * Verifica se um e-mail possui acesso ativo no sistema
 */
export const hasAccess = async (email: string) => {
  const emailLimpo = email.trim().toLowerCase();
  console.log("USER EMAIL:", emailLimpo);

  try {
    // Busca todas as vendas para o e-mail com status ativo
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .eq('email', emailLimpo)
      .in('status', ['ativo', 'approved', 'pago', 'concluido', 'complete']);

    console.log("SALES FOUND:", sales);

    if (error) {
      // Tentar fallback para 'e-mail'
      if (error.message.includes('column "email" does not exist')) {
        const { data: fallbackSales, error: fallbackError } = await supabase
          .from('sales')
          .select('*')
          .eq('e-mail', emailLimpo)
          .in('status', ['ativo', 'approved', 'pago', 'concluido', 'complete']);
        
        if (fallbackError) throw fallbackError;
        if (fallbackSales && fallbackSales.length > 0) return true;
      }
      throw error;
    }

    if (sales && sales.length > 0) {
      return true;
    }

    console.log('authService: Nenhuma venda ativa ou válida encontrada.');
    return false;
  } catch (err) {
    console.error('authService: Erro em hasAccess:', err);
    return false;
  }
};

/**
 * Valida permissão de acesso e lança erro detalhado se negado
 */
export const verificarPermissao = async (email: string, adminEmail?: string) => {
  const emailLimpo = email.trim().toLowerCase();
  const hardcodedAdmin = 'sertanejopremiercontato@gmail.com';
  const isEmailAdmin = emailLimpo === hardcodedAdmin || (adminEmail && emailLimpo === adminEmail.toLowerCase());

  if (isEmailAdmin) {
    console.log('Bypass de administrador (verificarPermissao) para:', emailLimpo);
    return true;
  }

  const access = await hasAccess(emailLimpo);
  
  if (!access) {
    throw new Error('ACESSO RESTRITO: Não encontramos uma assinatura ativa para este e-mail.');
  }

  return true;
};

/**
 * Solicita o reset de senha por e-mail (Sistema Nativo Supabase)
 */
export const solicitarResetSenha = async (email: string) => {
  const emailLimpo = email.trim().toLowerCase();
  console.log('authService: Iniciando solicitarResetSenha nativo para:', emailLimpo);
  
  try {
    // Usar o sistema nativo do Supabase para garantir o uso dos templates configurados no Dashboard
    const { data, error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
      redirectTo: `${window.location.origin}/nova-senha`
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('authService: Erro em solicitarResetSenha:', err);
    throw err;
  }
};

/**
 * Atualiza a senha do usuário logado (usado no fluxo de recuperação)
 */
export const atualizarSenha = async (novaSenha: string) => {
  console.log('authService: Iniciando updateUser...');
  const { data, error } = await supabase.auth.updateUser({
    password: novaSenha,
  });
  if (error) {
    console.error('authService: Erro no updateUser:', error);
    throw error;
  }
  console.log('authService: updateUser concluído com sucesso.');
  return data;
};

/**
 * Verifica se o e-mail existe na tabela sales e está apto para o primeiro acesso
 */
export const verificarVendaParaPrimeiroAcesso = async (email: string) => {
  // Apenas retorna true, a verificação de acesso será feita no Dashboard
  return true;
};

/**
 * Realiza o primeiro acesso: Cria a conta no Auth
 */
export const concluirPrimeiroAcesso = async (email: string, senha: string, nome?: string) => {
  // Cria a conta diretamente no Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: senha,
    options: {
      data: {
        full_name: nome || 'Aluno',
      },
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Realiza o login puro no Supabase Auth
 */
export const login = async (email: string, senha: string) => {
  console.log('authService: Iniciando signInWithPassword para:', email);
  // Tentar login no Auth sem travas de tabela sales
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    console.error('authService: Erro no signInWithPassword:', error);
    throw error;
  }
  
  console.log('authService: signInWithPassword concluído com sucesso para:', data.user?.email);
  return data;
};


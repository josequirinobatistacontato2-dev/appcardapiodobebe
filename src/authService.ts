import { supabase } from './supabaseClient';

const ALLOWED_PRODUCT_IDS = ['7185103', '2865044'];
const MAIN_PRODUCT_ID = ALLOWED_PRODUCT_IDS[0];

const isAllowedProduct = (id: any) => {
  const cleanId = String(id || '').trim();
  return ALLOWED_PRODUCT_IDS.includes(cleanId) || ALLOWED_PRODUCT_IDS.includes(String(parseInt(cleanId)));
};

/**
 * Verifica se o usuário possui acesso ativo ao produto principal
 */
export const hasAccess = async (email: string) => {
  const emailLimpo = email.trim().toLowerCase();
  console.log('Iniciando hasAccess para:', emailLimpo);
  
  try {
    // Buscamos todas as vendas deste e-mail para filtrar no JS, 
    // evitando problemas com colunas inexistentes no .or()
    let sales: any[] = [];
    
    // Tenta buscar pela coluna 'email'
    const { data: salesEmail, error: errorEmail } = await supabase
      .from('sales')
      .select('*')
      .eq('email', emailLimpo);
      
    if (salesEmail) sales = [...sales, ...salesEmail];
    
    // Tenta buscar pela coluna 'e-mail' (fallback comum em imports)
    const { data: salesEmailAlt, error: errorEmailAlt } = await supabase
      .from('sales')
      .select('*')
      .eq('e-mail', emailLimpo);
      
    if (salesEmailAlt) sales = [...sales, ...salesEmailAlt];

    if (sales.length === 0) {
      console.log('Nenhuma venda encontrada para o e-mail:', emailLimpo);
      return false;
    }

    console.log(`Encontradas ${sales.length} vendas para ${emailLimpo}. Exemplo de campos:`, Object.keys(sales[0]));
    console.log(`Verificando produtos permitidos: ${ALLOWED_PRODUCT_IDS.join(', ')}...`);

    // Verifica status e expiração para os produtos permitidos
    return sales.some(sale => {
      const pId = String(sale.product_id || sale.id_do_produto || '').trim();
      const isMainProduct = isAllowedProduct(pId);
      
      if (!isMainProduct) return false;

      const status = String(sale.status || '').toLowerCase();
      const expiresAt = sale.expires_at || sale.expira_em;
      
      const activeStatuses = ['ativo', 'approved', 'complete', 'active', 'aprovado', 'pago', 'finalizado', 'concluido'];
      const isActive = activeStatuses.includes(status);
      const isNotExpired = !expiresAt || new Date() <= new Date(expiresAt);
      
      return isActive && isNotExpired;
    });
  } catch (err) {
    console.error('Erro em hasAccess:', err);
    return false;
  }
};

/**
 * Verifica se o e-mail tem permissão para acessar o sistema
 * Regra: Deve possuir acesso ativo ao produto principal (7185103)
 */
export const verificarPermissao = async (email: string, adminEmail?: string) => {
  const emailLimpo = email.trim().toLowerCase();
  const hardcodedAdmin = 'sertanejopremiercontato@gmail.com';
  
  // BYPASS: Se for o e-mail do administrador, permite sempre
  const isEmailAdmin = emailLimpo === hardcodedAdmin || 
                       (adminEmail && emailLimpo === adminEmail.toLowerCase());
  
  console.log('Verificando isEmailAdmin (verificarPermissao):', { emailLimpo, hardcodedAdmin, adminEmail, isEmailAdmin });

  if (isEmailAdmin) {
    console.log('Bypass de administrador (verificarPermissao) para:', emailLimpo);
    return true;
  }

  console.log('Verificando permissão para:', emailLimpo);

  const temAcesso = await hasAccess(emailLimpo);

  if (!temAcesso) {
    console.log('Acesso negado para:', emailLimpo, '. Verificando se o e-mail existe na base...');
    
    // Busca informações para dar um erro mais preciso, tentando ambas as colunas
    let anySales: any[] = [];
    
    const { data: s1 } = await supabase.from('sales').select('*').eq('email', emailLimpo);
    if (s1) anySales = [...anySales, ...s1];
    
    const { data: s2 } = await supabase.from('sales').select('*').eq('e-mail', emailLimpo);
    if (s2) anySales = [...anySales, ...s2];

    if (anySales.length === 0) {
      console.error('E-mail não encontrado em nenhuma coluna de vendas:', emailLimpo);
      throw new Error('E-mail não encontrado na base de compradores. Verifique se sua compra foi aprovada ou se usou o mesmo e-mail da Hotmart.');
    }

    // Verifica se existe algum produto permitido em qualquer uma das vendas encontradas
    const hasMainProduct = anySales.some(s => isAllowedProduct(s.product_id || s.id_do_produto));

    if (!hasMainProduct) {
      const foundIds = anySales.map(s => s.product_id || s.id_do_produto).filter(Boolean).join(', ');
      throw new Error(`Seu e-mail foi encontrado, mas não está vinculado a um produto válido (${ALLOWED_PRODUCT_IDS.join(' ou ')}). Produtos encontrados: ${foundIds || 'Nenhum ID'}`);
    }

    // Se chegou aqui, tem um produto permitido, mas temAcesso foi false.
    // Pode ser status ou expiração.
    const mainProductSales = anySales.filter(s => isAllowedProduct(s.product_id || s.id_do_produto));

    const isSuspended = mainProductSales.some(s => String(s.status || '').toLowerCase() === 'suspenso');
    if (isSuspended) {
      throw new Error('Seu acesso está suspenso. Entre em contato com o suporte.');
    }

    const isExpired = mainProductSales.every(s => {
      const expiresAt = s.expires_at || s.expira_em;
      return expiresAt && new Date() > new Date(expiresAt);
    });
    
    if (isExpired) {
      throw new Error('Sua assinatura do produto principal expirou.');
    }

    throw new Error('Você não possui uma assinatura ativa do produto principal ou seu acesso expirou.');
  }

  return true;
};

/**
 * Solicita o reset de senha por e-mail (Sistema Próprio)
 */
export const solicitarResetSenha = async (email: string) => {
  const emailLimpo = email.trim().toLowerCase();
  console.log('authService: Iniciando solicitarResetSenha (Custom) para:', emailLimpo);
  
  try {
    const response = await fetch('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailLimpo })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro ao solicitar recuperação.');
    
    console.log('authService: Solicitação de reset enviada com sucesso para:', emailLimpo);
    return data;
  } catch (err: any) {
    console.error('authService: Erro capturado em solicitarResetSenha:', err);
    throw err;
  }
};

/**
 * Atualiza a senha do usuário usando o token customizado
 */
export const resetarSenhaComToken = async (token: string, novaSenha: string) => {
  console.log('authService: Iniciando resetarSenhaComToken...');
  
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, novaSenha })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro ao resetar senha.');
    
    console.log('authService: Senha resetada com sucesso.');
    return data;
  } catch (err: any) {
    console.error('authService: Erro em resetarSenhaComToken:', err);
    throw err;
  }
};

/**
 * Atualiza a senha do usuário logado (mantido para compatibilidade se necessário)
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
  // Tentar login no Auth sem travas de tabela sales
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) throw error;
  return data;
};

/**
 * Verifica se o usuário logado ainda possui status ativo no produto principal
 */
export const verificarStatusAtivo = async (email: string, adminEmail?: string) => {
  const emailLimpo = email.trim().toLowerCase();
  const hardcodedAdmin = 'sertanejopremiercontato@gmail.com';

  // BYPASS: Se for o e-mail do administrador, permite sempre
  const isEmailAdmin = emailLimpo === hardcodedAdmin || 
                       (adminEmail && emailLimpo === adminEmail.toLowerCase());
  
  if (isEmailAdmin) return true;

  return await hasAccess(emailLimpo);
};

/**
 * Busca os produtos vinculados ao produto principal e calcula o status de liberação
 * com base na data de compra e nos dias de carência (release_days).
 */
export const getProductsForUser = async (email: string) => {
  const emailLimpo = email.trim().toLowerCase();

  // 1. Buscar a data de compra de um produto permitido na tabela sales
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .or(`email.eq.${emailLimpo},e-mail.eq.${emailLimpo}`);

  const filteredSales = (sales || []).filter(s => isAllowedProduct(s.product_id || s.id_do_produto));

  if (salesError || !filteredSales || filteredSales.length === 0) {
    console.log('Nenhuma venda encontrada para o cálculo de liberação:', emailLimpo);
    return [];
  }

  // Pegamos a venda ativa de qualquer produto permitido
  const activeStatuses = ['ativo', 'approved', 'complete', 'active', 'aprovado', 'pago', 'finalizado', 'concluido'];
  const mainSale = filteredSales.find(s => 
    isAllowedProduct(s.product_id || s.id_do_produto) && 
    (activeStatuses.includes(String(s.status || '').toLowerCase()))
  );

  if (!mainSale) {
    console.log('Venda de produto permitido não está ativa para:', emailLimpo);
    return [];
  }

  // Usamos purchase_date ou created_at como base
  const purchaseDateStr = mainSale.purchase_date || mainSale.created_at || mainSale.criado_em;
  if (!purchaseDateStr) {
    console.error('Data de compra não encontrada para:', emailLimpo);
    return [];
  }
  
  const purchaseDate = new Date(purchaseDateStr);

  // 2. Buscar produtos vinculados na tabela products
  const { data: productsData, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('parent_product_id', ALLOWED_PRODUCT_IDS);

  if (productsError || !productsData) {
    console.error('Erro ao buscar produtos vinculados:', productsError);
    return [];
  }

  // 3. Calcular status de liberação para cada produto
  const now = new Date();
  
  return productsData.map(item => {
    // Lida com a possibilidade dos dados estarem em uma coluna 'data' ou diretamente na linha
    const product = item.data || item.value || item;
    const releaseDays = product.release_days || 0;
    
    const releaseDate = new Date(purchaseDate);
    releaseDate.setDate(releaseDate.getDate() + releaseDays);

    const isUnlocked = now >= releaseDate;

    return {
      id: product.id || item.id,
      title: product.title || product.name || 'Produto sem título',
      status: isUnlocked ? 'unlocked' : 'locked',
      releaseDate: releaseDate.toISOString(),
      daysRemaining: Math.max(0, Math.ceil((releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    };
  });
};

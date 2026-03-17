import { supabase } from '../supabaseClient';
import { isProductUnlocked } from '../utils';

export interface ProductStatus {
  id: string;
  title: string;
  unlocked: boolean;
}

/**
 * Busca os produtos e verifica quais estão desbloqueados para o usuário
 * 
 * @param email E-mail do usuário para buscar na tabela sales
 * @returns Lista de produtos com status de desbloqueio
 */
export async function getUnlockedProducts(email: string): Promise<ProductStatus[]> {
  try {
    // 1 - Buscar purchase_date na tabela sales
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('purchase_date')
      .or(`email.eq.${email},e-mail.eq.${email}`)
      .maybeSingle();

    if (salesError && salesError.code !== 'PGRST116') {
      console.error('Erro ao buscar venda:', salesError);
    }

    const purchaseDate = salesData?.purchase_date;

    // 2 - Buscar todos produtos na tabela products
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, title, release_days');

    if (productsError) {
      throw productsError;
    }

    if (!productsData) return [];

    // 3, 4, 5 - Calcular release_date, comparar e retornar lista
    return productsData.map(product => {
      let unlocked = false;
      
      if (purchaseDate) {
        // Se houver data de compra, verificamos a liberação
        unlocked = isProductUnlocked(purchaseDate, product.release_days || 0);
      } else {
        // Se não houver data de compra, só libera se release_days for 0 (opcional, dependendo da regra)
        // Mas geralmente sem compra = tudo bloqueado.
        unlocked = false;
      }

      return {
        id: product.id,
        title: product.title,
        unlocked: unlocked
      };
    });
  } catch (error) {
    console.error('Erro em getUnlockedProducts:', error);
    return [];
  }
}

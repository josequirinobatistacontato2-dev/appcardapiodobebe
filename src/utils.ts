/**
 * Verifica se um produto está desbloqueado com base na data de compra e dias de liberação
 * 
 * Regra:
 * release_date = purchase_date + release_days
 * Se hoje >= release_date retornar true
 * Se hoje < release_date retornar false
 * 
 * @param purchaseDate Data da compra (string ISO ou objeto Date)
 * @param releaseDays Quantidade de dias para liberar o conteúdo (0 = imediato)
 * @returns boolean indicando se o produto está desbloqueado
 */
export function isProductUnlocked(purchaseDate: string | Date, releaseDays: number): boolean {
  const pDate = new Date(purchaseDate);
  const now = new Date();
  
  // Calcula a data de liberação: data da compra + dias de carência
  const releaseDate = new Date(pDate.getTime());
  releaseDate.setDate(releaseDate.getDate() + releaseDays);
  
  // Compara com o momento atual
  return now >= releaseDate;
}

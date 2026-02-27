
async function checkUrl() {
  const url = 'https://zisijswmqoxtfxlgjwgr.supabase.co/functions/v1/webhook';
  console.log('Verificando URL:', url);
  
  try {
    const response = await fetch(url, { method: 'POST' });
    console.log('Status Code:', response.status);
    const text = await response.text();
    console.log('Corpo da Resposta:', text);
  } catch (error) {
    console.error('Erro ao acessar URL:', error.message);
  }
}

checkUrl();

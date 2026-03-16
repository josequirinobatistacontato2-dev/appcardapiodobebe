import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * EDGE FUNCTION: webhook
 * Local: supabase/functions/webhook/index.ts
 * 
 * Esta função recebe o webhook da Hotmart, cria o usuário no Supabase Auth
 * e registra/atualiza a venda na tabela 'sales'.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Cliente Supabase com permissões de Admin (Service Role)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  };

  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  // GET para teste de deploy
  if (req.method === "GET") {
    return new Response("🚀 Webhook Hotmart Online!", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  // Apenas processa POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const payload = await req.json();
    console.log("Webhook recebido:", JSON.stringify(payload));

    // 1. Log do payload na tabela webhook_logs (opcional)
    await supabase.from("webhook_logs").insert({
      data: { payload, timestamp: new Date().toISOString() }
    });

    // 2. Extração flexível do e-mail (vários formatos da Hotmart)
    const email = (
      payload.data?.buyer?.email || 
      payload.data?.subscriber?.email || 
      payload.buyer?.email ||
      payload.data?.email || 
      payload.data?.user?.email ||
      payload.user?.email ||
      ""
    ).trim().toLowerCase();

    if (!email) {
      console.log("Nenhum e-mail encontrado no payload. Payload:", JSON.stringify(payload));
      return new Response(JSON.stringify({ status: "ignored", message: "No email found" }), { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Extração de dados complementares
    const name = payload.data?.buyer?.name || 
                 payload.data?.subscriber?.name || 
                 payload.buyer?.name || 
                 payload.data?.name ||
                 payload.data?.user?.name ||
                 payload.user?.name ||
                 "Aluno";
                 
    const product_id = String(
      payload.data?.product?.id || 
      payload.product?.id || 
      payload.data?.product_id ||
      "0"
    );

    const purchase_date = payload.data?.purchase?.date || 
                         payload.purchase?.date || 
                         new Date().toISOString();
    
    const rawEvent = payload.event || payload.data?.event || "";
    const event = rawEvent.toUpperCase().trim();

    // 4. Lógica de Status e Expiração (+1 ano)
    let status = "";
    let expires_at: string | null = null;

    // APPROVED ou COMPLETE -> ativo
    const isActivation = event.includes("APPROVED") || event.includes("COMPLETE");
    // REFUND ou CANCEL -> suspenso
    const isSuspension = event.includes("REFUND") || event.includes("CHARGEBACK") || event.includes("CANCEL");

    if (isActivation) {
      status = "ativo";
      const expirationDate = new Date(purchase_date);
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      expires_at = expirationDate.toISOString();
    } else if (isSuspension) {
      status = "suspenso";
    } else {
      // Outros eventos (ex: boleto gerado) ignoramos mas retornamos 200
      console.log("Evento ignorado:", event);
      return new Response(JSON.stringify({ status: "ok", message: "Event ignored" }), { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Processando Webhook - Email: ${email} - Evento: ${event} - Produto: ${product_id}`);

    // 5. Criar usuário no Supabase Auth (Admin)
    // Isso garante que o usuário exista para o fluxo de "Primeiro Acesso"
    console.log('Verificando/Criando usuário no Auth:', email);
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createError) {
      if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
        console.log('Usuário já existe no Authentication.');
      } else {
        console.error('Erro ao criar usuário no Auth:', createError.message);
      }
    } else {
      console.log('Novo usuário criado com sucesso no Authentication.');
    }

    // 6. Upsert na tabela 'sales'
    // Tenta descobrir as colunas reais buscando um registro
    const { data: sample } = await supabase.from('sales').select('*').limit(1);
    const hasHyphenEmail = sample && sample.length > 0 && 'e-mail' in sample[0];
    const hasNome = sample && sample.length > 0 && 'nome' in sample[0];
    const hasIdProduto = sample && sample.length > 0 && 'id_do_produto' in sample[0];
    const hasCriadoEm = sample && sample.length > 0 && 'criado_em' in sample[0];
    const hasExpiraEm = sample && sample.length > 0 && 'expira_em' in sample[0];
    const hasPurchaseDate = sample && sample.length > 0 && 'purchase_date' in sample[0];

    const hasUpdatedAt = sample && sample.length > 0 && 'updated_at' in sample[0];

    const upsertData: any = {
      [hasHyphenEmail ? 'e-mail' : 'email']: email,
      [hasNome ? 'nome' : 'name']: name,
      [hasIdProduto ? 'id_do_produto' : 'product_id']: product_id,
      status
    };

    if (hasPurchaseDate) {
      upsertData.purchase_date = purchase_date;
    }

    if (hasUpdatedAt) {
      upsertData.updated_at = new Date().toISOString();
    }

    if (expires_at) {
      upsertData[hasExpiraEm ? 'expira_em' : 'expires_at'] = expires_at;
    }

    if (isActivation) {
      upsertData[hasCriadoEm ? 'criado_em' : 'created_at'] = new Date().toISOString();
    }

    console.log(`Realizando upsert para ${email} - Produto: ${product_id} - Status: ${status}`);
    
    // Tenta upsert composto (email + product_id)
    const onConflict = hasHyphenEmail && hasIdProduto ? 'e-mail,id_do_produto' : (hasHyphenEmail ? 'e-mail,product_id' : (hasIdProduto ? 'email,id_do_produto' : 'email,product_id'));
    
    const { error: upsertError } = await supabase
      .from("sales")
      .upsert(upsertData, { onConflict });

    if (upsertError) {
      console.warn("Erro no upsert composto:", upsertError.message);
      console.log("Tentando fallback de upsert apenas por email...");
      
      // Fallback para upsert apenas por email
      const { error: fallbackError } = await supabase
        .from("sales")
        .upsert(upsertData, { onConflict: hasHyphenEmail ? 'e-mail' : 'email' });
        
      if (fallbackError) {
        console.error("Erro no fallback de upsert por email:", fallbackError.message);
      } else {
        console.log("Sucesso no fallback de upsert por email.");
      }
    }

    console.log(`Sucesso: ${email} processado como ${status}`);

    return new Response(JSON.stringify({ status: "success", email, status, user_created: !!authUser }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Erro crítico no processamento do webhook:", error.message);
    // Sempre retornar 200 para a Hotmart para evitar retentativas infinitas
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

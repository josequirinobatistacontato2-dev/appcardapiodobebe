import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const HOTMART_TOKEN = "APP_CARDA_BEBE_2026_SEGURANCA"

serve(async (req) => {
  // 1. Validar método POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    // 2. Validar o header "x-hotmart-hottok"
    const hottok = req.headers.get('x-hotmart-hottok')
    if (hottok !== HOTMART_TOKEN) {
      console.error('Token inválido recebido')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Ler o JSON enviado pela Hotmart
    const payload = await req.json()

    // 4. Conectar no Supabase usando variáveis de ambiente do Deno
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 5. Salvar o JSON recebido na tabela webhook_logs
    const { error: logError } = await supabase
      .from('webhook_logs')
      .insert([{ data: payload }])

    if (logError) {
      console.error('Erro ao inserir log no Supabase:', logError)
    }

    // 6. Tratar eventos específicos da Hotmart
    const event = payload.event
    const buyer = payload.buyer
    const product = payload.product

    if (event === 'PURCHASE_APPROVED') {
      const { error: salesError } = await supabase
        .from('sales')
        .insert([{
          email: buyer?.email,
          name: buyer?.name,
          product_id: product?.id?.toString(),
          status: 'approved',
          raw_data: payload,
          created_at: new Date().toISOString()
        }])
      
      if (salesError) {
        console.error('Erro ao inserir venda:', salesError)
      }
    } else if (event === 'PURCHASE_REFUNDED' || event === 'CANCELLATION' || event === 'PURCHASE_CHARGEBACK') {
      const { error: updateError } = await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('email', buyer?.email)
      
      if (updateError) {
        console.error('Erro ao atualizar status de reembolso:', updateError)
      }
    }

    // 7. Retornar 200 OK
    return new Response(JSON.stringify({ message: 'Webhook processado com sucesso' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro interno na Edge Function:', err)
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

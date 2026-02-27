
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zisijswmqoxtfxlgjwgr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6KFWYlCjjniOKdAhfJDMJA_eJT88ZFE';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  const { error } = await supabase.from('webhook_logs').insert([{ data: { test: "manual" } }]);
  if (error) {
    console.error('Erro ao inserir log:', error.message);
  } else {
    console.log('Log inserido com sucesso!');
  }
}
testInsert();

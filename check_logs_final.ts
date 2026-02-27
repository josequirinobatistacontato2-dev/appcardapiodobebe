
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zisijswmqoxtfxlgjwgr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6KFWYlCjjniOKdAhfJDMJA_eJT88ZFE';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { count } = await supabase.from('webhook_logs').select('*', { count: 'exact', head: true });
  console.log('Logs:', count);
  const { data } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(1);
  if (data && data.length > 0) {
    console.log('Último Log:', JSON.stringify(data[0], null, 2));
  }
}
check();

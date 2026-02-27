
async function test() {
  const url = 'https://zisijswmqoxtfxlgjwgr.supabase.co/functions/v1/webhook';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: true })
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Body:', JSON.stringify(data, null, 2));
}
test();

import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://w6dfsk7t.us-east.insforge.app',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwODUwNTl9.TGi0qosKAdCrNLbpZMRh6rs_kb-PvxqWsphWRcBUQ48',
});

const { data, error } = await client.database.from('stock_syncs').select('*').order('synced_at', { ascending: false });

if (error) {
  console.error('Error:', error);
} else {
  console.log(`\n📊 Total syncs: ${data.length}\n`);
  data.forEach((s, i) => {
    const date = new Date(s.synced_at).toLocaleString('es-ES');
    console.log(`  ${i + 1}. ${date} → ${s.total} productos`);
  });
  console.log();
}

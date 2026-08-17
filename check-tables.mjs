import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://w6dfsk7t.us-east.insforge.app',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwODUwNTl9.TGi0qosKAdCrNLbpZMRh6rs_kb-PvxqWsphWRcBUQ48',
});

const tables = ['users', 'stores', 'stock_syncs', 'stock_snapshots', 'pedidos', 'ads_diario'];

console.log('\nTabla Status:\n');
for (const table of tables) {
  const { data, error } = await client.database.from(table).select('*').limit(1);
  if (error) {
    console.log(`  ${table}: ❌ ${error.message}`);
  } else {
    console.log(`  ${table}: ✓ accessible (${data?.length || 0} rows shown)`);
  }
}
console.log();

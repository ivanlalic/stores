import XLSX from 'xlsx';
import { createClient } from '@insforge/sdk';

const STORE_ID = '86a08ca2-32c2-4e9b-abe2-ef8baf1ef47b';
const SYNCED_AT = '2026-04-26T20:10:00.000Z';

// Service client — same pattern as createServiceClient() in server.ts
const insforge = createClient({
  baseUrl: 'https://w6dfsk7t.us-east.insforge.app',
  anonKey: 'ik_92971e8aa30996093f3f84fe2e498c82',
});

const wb = XLSX.readFile('stock26abril2026.xlsx');
const ws = wb.Sheets['scrappingDropea'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const products = rows.slice(1).filter(r => r[0] && r[4] != null).map(r => ({
  dropea_id: String(r[0]),
  sku: r[1] ? String(r[1]) : null,
  name: String(r[2] || ''),
  stock: Number(r[4]) || 0,
}));

console.log(`Productos: ${products.length}`);

// Create sync record
console.log('Creando sync...');
const { data: syncRow, error: syncErr } = await insforge.database
  .from('stock_syncs')
  .insert([{ store_id: STORE_ID, synced_at: SYNCED_AT, total: products.length }])
  .select('id')
  .single();

if (syncErr) throw new Error('Sync insert error: ' + JSON.stringify(syncErr));
const syncId = syncRow.id;
console.log(`Sync ID: ${syncId}`);

// Insert snapshots in batches of 500
const BATCH = 500;
for (let i = 0; i < products.length; i += BATCH) {
  const batch = products.slice(i, i + BATCH).map(p => ({
    sync_id: syncId,
    store_id: STORE_ID,
    dropea_id: p.dropea_id,
    sku: p.sku,
    name: p.name,
    image: null,
    stock: p.stock,
  }));
  const { error } = await insforge.database.from('stock_snapshots').insert(batch);
  if (error) throw new Error(`Snapshot insert error at ${i}: ` + JSON.stringify(error));
  console.log(`Insertados: ${Math.min(i + BATCH, products.length)}/${products.length}`);
}

console.log('\n✓ Import completo');
console.log(`Sync: ${SYNCED_AT} | ${products.length} productos`);

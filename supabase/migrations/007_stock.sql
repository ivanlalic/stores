-- Each sync run
CREATE TABLE stock_syncs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  synced_at   TIMESTAMPTZ DEFAULT NOW(),
  total       INTEGER
);
ALTER TABLE stock_syncs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_stock_syncs" ON stock_syncs FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()::text));
CREATE INDEX idx_stock_syncs_store ON stock_syncs(store_id, synced_at DESC);

-- Per-product snapshot per sync
CREATE TABLE stock_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id     UUID NOT NULL REFERENCES stock_syncs(id) ON DELETE CASCADE,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  dropea_id   TEXT NOT NULL,
  sku         TEXT,
  name        TEXT NOT NULL,
  image       TEXT,
  stock       INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE stock_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_stock_snapshots" ON stock_snapshots FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()::text));
CREATE INDEX idx_stock_snapshots_sync ON stock_snapshots(sync_id);
CREATE INDEX idx_stock_snapshots_store ON stock_snapshots(store_id);

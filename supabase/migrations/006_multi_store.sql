-- Layer 2: Multi-store support
-- Creates stores table, migrates existing data, adds store_id to all data tables

-- 1. New stores table
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dropea', 'dropi')),
  dropea_api_key_encrypted TEXT,
  fee_gestion_eur NUMERIC DEFAULT 0,
  costo_rechazo NUMERIC DEFAULT 13.76,
  dias_rolling INTEGER DEFAULT 30,
  dias_excluir INTEGER DEFAULT 4,
  dropi_email_encrypted TEXT,
  dropi_pwd_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_stores" ON stores FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_stores_user ON stores(user_id);

-- 2. Migrate existing users → default stores
INSERT INTO stores (user_id, name, type, dropea_api_key_encrypted, fee_gestion_eur, costo_rechazo, dias_rolling, dias_excluir)
SELECT
  id,
  COALESCE(store_name, 'IBericaStore'),
  'dropea',
  dropea_api_key_encrypted,
  COALESCE(fee_gestion_eur, 0),
  COALESCE(costo_rechazo, 13.76),
  COALESCE(dias_rolling, 30),
  COALESCE(dias_excluir, 4)
FROM users_config
WHERE dropea_api_key_encrypted IS NOT NULL;

INSERT INTO stores (user_id, name, type, dropi_email_encrypted, dropi_pwd_encrypted)
SELECT id, 'VittaOra', 'dropi', dropi_email_encrypted, dropi_pwd_encrypted
FROM users_config
WHERE dropi_email_encrypted IS NOT NULL;

-- 3. Add store_id to data tables (nullable first for backfill)
ALTER TABLE pedidos ADD COLUMN store_id UUID REFERENCES stores(id);
ALTER TABLE dropi_pedidos ADD COLUMN store_id UUID REFERENCES stores(id);
ALTER TABLE ads_diario ADD COLUMN store_id UUID REFERENCES stores(id);
ALTER TABLE dropi_ads_diario ADD COLUMN store_id UUID REFERENCES stores(id);

-- 4. Backfill store_id
UPDATE pedidos p
SET store_id = s.id
FROM stores s
WHERE s.user_id = p.user_id AND s.type = 'dropea';

UPDATE dropi_pedidos p
SET store_id = s.id
FROM stores s
WHERE s.user_id = p.user_id AND s.type = 'dropi';

UPDATE ads_diario a
SET store_id = s.id
FROM stores s
WHERE s.user_id = a.user_id AND s.type = 'dropea';

UPDATE dropi_ads_diario a
SET store_id = s.id
FROM stores s
WHERE s.user_id = a.user_id AND s.type = 'dropi';

-- 5. Make NOT NULL
ALTER TABLE pedidos ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE dropi_pedidos ALTER COLUMN store_id SET NOT NULL;

-- ads tables stay nullable (a user might have ads data but no store yet in edge cases)

-- 6. Update unique constraints
ALTER TABLE pedidos DROP CONSTRAINT pedidos_user_id_dropea_id_key;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_store_dropea_id UNIQUE (store_id, dropea_id);

ALTER TABLE dropi_pedidos DROP CONSTRAINT dropi_pedidos_user_id_order_id_key;
ALTER TABLE dropi_pedidos ADD CONSTRAINT dropi_pedidos_store_order_id UNIQUE (store_id, order_id);

ALTER TABLE ads_diario DROP CONSTRAINT ads_diario_user_id_fecha_key;
ALTER TABLE ads_diario ADD CONSTRAINT ads_diario_store_fecha UNIQUE (store_id, fecha);

ALTER TABLE dropi_ads_diario DROP CONSTRAINT dropi_ads_diario_user_id_fecha_key;
ALTER TABLE dropi_ads_diario ADD CONSTRAINT dropi_ads_diario_store_fecha UNIQUE (store_id, fecha);

-- 7. Add indexes on store_id
CREATE INDEX idx_pedidos_store_fecha ON pedidos(store_id, fecha);
CREATE INDEX idx_dropi_pedidos_store_fecha ON dropi_pedidos(store_id, fecha);
CREATE INDEX idx_ads_store_fecha ON ads_diario(store_id, fecha);
CREATE INDEX idx_dropi_ads_store_fecha ON dropi_ads_diario(store_id, fecha);

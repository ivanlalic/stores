-- Update foreign key constraints to support ON DELETE CASCADE when deleting a store
-- This allows deleting a store and automatically cleaning up its orders and ad spends

-- 1. Table: pedidos
ALTER TABLE pedidos 
  DROP CONSTRAINT IF EXISTS pedidos_store_id_fkey;
ALTER TABLE pedidos 
  ADD CONSTRAINT pedidos_store_id_fkey 
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 2. Table: dropi_pedidos
ALTER TABLE dropi_pedidos 
  DROP CONSTRAINT IF EXISTS dropi_pedidos_store_id_fkey;
ALTER TABLE dropi_pedidos 
  ADD CONSTRAINT dropi_pedidos_store_id_fkey 
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 3. Table: ads_diario
ALTER TABLE ads_diario 
  DROP CONSTRAINT IF EXISTS ads_diario_store_id_fkey;
ALTER TABLE ads_diario 
  ADD CONSTRAINT ads_diario_store_id_fkey 
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 4. Table: dropi_ads_diario
ALTER TABLE dropi_ads_diario 
  DROP CONSTRAINT IF EXISTS dropi_ads_diario_store_id_fkey;
ALTER TABLE dropi_ads_diario 
  ADD CONSTRAINT dropi_ads_diario_store_id_fkey 
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

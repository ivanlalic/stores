-- Dropi/Vittaora orders
CREATE TABLE dropi_pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  shopify_order_id BIGINT,
  fecha DATE NOT NULL,
  nombre TEXT,
  productos TEXT,
  venta NUMERIC DEFAULT 0,
  neto NUMERIC DEFAULT 0,
  status TEXT,
  es_enviado BOOLEAN DEFAULT FALSE,
  es_entregado BOOLEAN DEFAULT FALSE,
  es_rechazado BOOLEAN DEFAULT FALSE,
  es_cancelado BOOLEAN DEFAULT FALSE,
  tracking_code TEXT,
  tracking_url TEXT,
  shipping_company TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, order_id)
);

CREATE INDEX idx_dropi_pedidos_user_fecha ON dropi_pedidos(user_id, fecha);
CREATE INDEX idx_dropi_pedidos_user_status ON dropi_pedidos(user_id, status);

ALTER TABLE dropi_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own dropi orders" ON dropi_pedidos FOR ALL USING (auth.uid() = user_id);

-- Dropi daily ad spend
CREATE TABLE dropi_ads_diario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fecha DATE NOT NULL,
  meta_ads NUMERIC DEFAULT 0,
  tiktok_ads NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fecha)
);

CREATE INDEX idx_dropi_ads_user_fecha ON dropi_ads_diario(user_id, fecha);

ALTER TABLE dropi_ads_diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own dropi ads" ON dropi_ads_diario FOR ALL USING (auth.uid() = user_id);

-- Dropi credentials on users_config
ALTER TABLE users_config
  ADD COLUMN IF NOT EXISTS dropi_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS dropi_pwd_encrypted TEXT;

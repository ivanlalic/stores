-- Users config (stores encrypted API key and fee settings)
CREATE TABLE users_config (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  dropea_api_key_encrypted TEXT,
  fee_gestion_pct NUMERIC DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos (orders synced from Dropea)
CREATE TABLE pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  orden TEXT,
  fecha DATE NOT NULL,
  dropea_id TEXT NOT NULL,
  nombre TEXT,
  telefono TEXT,
  pedido TEXT,
  venta NUMERIC DEFAULT 0,
  neto NUMERIC DEFAULT 0,
  status TEXT,
  es_enviado BOOLEAN DEFAULT FALSE,
  es_entregado BOOLEAN DEFAULT FALSE,
  es_rechazado BOOLEAN DEFAULT FALSE,
  es_cancelado BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dropea_id)
);

-- Ads spending per day
CREATE TABLE ads_diario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fecha DATE NOT NULL,
  meta_ads NUMERIC DEFAULT 0,
  tiktok_ads NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fecha)
);

-- Indexes
CREATE INDEX idx_pedidos_user_fecha ON pedidos(user_id, fecha);
CREATE INDEX idx_pedidos_user_status ON pedidos(user_id, status);
CREATE INDEX idx_ads_user_fecha ON ads_diario(user_id, fecha);

-- Row Level Security
ALTER TABLE users_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own config" ON users_config FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users see own pedidos" ON pedidos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own ads" ON ads_diario FOR ALL USING (auth.uid() = user_id);

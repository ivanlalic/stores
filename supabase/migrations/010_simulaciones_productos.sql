-- Table for product simulations
CREATE TABLE simulaciones_productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio_venta NUMERIC NOT NULL DEFAULT 0.00,
  costo_unitario NUMERIC NOT NULL DEFAULT 0.00,
  unidades_por_venta INT NOT NULL DEFAULT 1,
  costo_envio_cod NUMERIC NOT NULL DEFAULT 0.00,
  cpa_promedio NUMERIC NOT NULL DEFAULT 0.00,
  tasa_entrega_manual NUMERIC, -- NULL if using automatic real-data stats
  costo_rechazo NUMERIC NOT NULL DEFAULT 14.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, nombre)
);

-- Enable Row Level Security (RLS)
ALTER TABLE simulaciones_productos ENABLE ROW LEVEL SECURITY;

-- Security Policies
CREATE POLICY "Users can manage their own simulations" ON simulaciones_productos
  FOR ALL
  USING (auth.uid() = user_id);

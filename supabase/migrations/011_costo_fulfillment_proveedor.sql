-- Add fulfillment_proveedor column to simulaciones_productos table
ALTER TABLE simulaciones_productos 
ADD COLUMN IF NOT EXISTS costo_fulfillment_proveedor NUMERIC NOT NULL DEFAULT 0.00;

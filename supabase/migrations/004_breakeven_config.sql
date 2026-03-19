-- Add break-even configuration columns to users_config
ALTER TABLE users_config
  ADD COLUMN IF NOT EXISTS costo_rechazo NUMERIC DEFAULT 13.00,
  ADD COLUMN IF NOT EXISTS dias_rolling INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS dias_excluir INTEGER DEFAULT 4;

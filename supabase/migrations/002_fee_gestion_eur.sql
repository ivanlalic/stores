-- Change fee from percentage to fixed EUR per shipped order
ALTER TABLE users_config RENAME COLUMN fee_gestion_pct TO fee_gestion_eur;
ALTER TABLE users_config ALTER COLUMN fee_gestion_eur SET DEFAULT 0.50;

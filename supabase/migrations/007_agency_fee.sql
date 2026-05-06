-- Agency fee % per ad platform, stored per day
-- Totals in meta_ads/tiktok_ads already include the fee; this column records the % used
ALTER TABLE ads_diario ADD COLUMN IF NOT EXISTS meta_agency_fee_pct NUMERIC DEFAULT 0;
ALTER TABLE ads_diario ADD COLUMN IF NOT EXISTS tiktok_agency_fee_pct NUMERIC DEFAULT 0;

ALTER TABLE dropi_ads_diario ADD COLUMN IF NOT EXISTS meta_agency_fee_pct NUMERIC DEFAULT 0;
ALTER TABLE dropi_ads_diario ADD COLUMN IF NOT EXISTS tiktok_agency_fee_pct NUMERIC DEFAULT 0;

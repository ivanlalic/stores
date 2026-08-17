-- Canales de ads configurables por tienda
-- stores.ads_channels: [{ "name": "...", "fee_pct": 6 }, ...]
-- ads_diario.channels: [{ "name": "...", "base": 0.00, "fee_pct": 6, "total": 0.00 }, ...]
--
-- Solo se configura y migra IBericaStore (meta_ads->Meta UpRoas, tiktok_ads->Meta SM).
-- Nutrex ES y Nutrex PT se dejan intactos: su formato antiguo (meta_ads/tiktok_ads)
-- sigue funcionando por fallback en el código.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS ads_channels jsonb;
ALTER TABLE ads_diario ADD COLUMN IF NOT EXISTS channels jsonb;

-- Config de canales para IBericaStore
UPDATE stores
SET ads_channels = '[{"name":"Meta UpRoas","fee_pct":6},{"name":"Meta SM","fee_pct":8},{"name":"Meta AdsNitro","fee_pct":6}]'::jsonb
WHERE id = '86a08ca2-32c2-4e9b-abe2-ef8baf1ef47b';

-- Migrar histórico de IBericaStore: meta_ads -> Meta UpRoas (mismo %), tiktok_ads -> Meta SM (mismo %).
-- base = total / (1 + fee/100) preservando el % de comisión de cada registro.
UPDATE ads_diario
SET channels = jsonb_build_array(
  jsonb_build_object(
    'name', 'Meta UpRoas',
    'base', round((COALESCE(meta_ads,0) / (1 + COALESCE(meta_agency_fee_pct,0)/100))::numeric, 2),
    'fee_pct', COALESCE(meta_agency_fee_pct,0),
    'total', COALESCE(meta_ads,0)
  ),
  jsonb_build_object(
    'name', 'Meta SM',
    'base', round((COALESCE(tiktok_ads,0) / (1 + COALESCE(tiktok_agency_fee_pct,0)/100))::numeric, 2),
    'fee_pct', COALESCE(tiktok_agency_fee_pct,0),
    'total', COALESCE(tiktok_ads,0)
  )
)
WHERE store_id = '86a08ca2-32c2-4e9b-abe2-ef8baf1ef47b'
  AND (COALESCE(meta_ads,0) + COALESCE(tiktok_ads,0)) > 0;

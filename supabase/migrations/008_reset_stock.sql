-- Reset all stock syncs and snapshots to start fresh
-- Run this to clear stock data and re-sync from scratch

DELETE FROM stock_snapshots;
DELETE FROM stock_syncs;

-- Mato vienetas kainyno ir pasiūlymo pozicijoms (vnt, m, kpl, val)
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'vnt';
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'vnt';

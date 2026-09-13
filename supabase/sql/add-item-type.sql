-- Pridéti tipo lauką į price_items lentelę
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS item_type TEXT CHECK (item_type IN ('service', 'product')) DEFAULT 'service';

-- Pakeisti price_items.category_id į nullable
ALTER TABLE price_items ALTER COLUMN category_id DROP NOT NULL;

-- Pridėti warehouse_item_id į quote_items, kad būtų galima sekti sandėlio prekes
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS warehouse_item_id UUID REFERENCES warehouse_items(id) ON DELETE SET NULL;

-- Žymė ar medžiagos kiekis jau nusirašė iš sandėlio (apsauga nuo dvigubo nurašymo)
ALTER TABLE project_materials ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN DEFAULT FALSE;

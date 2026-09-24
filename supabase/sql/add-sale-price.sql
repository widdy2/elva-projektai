-- Pardavimo kaina objekto medžiagoms (pirkimo kaina lieka unit_price).
-- Sąskaitos ir aktai naudoja sale_price; jei NULL — fallback į unit_price.
ALTER TABLE project_materials ADD COLUMN IF NOT EXISTS sale_price NUMERIC;
UPDATE project_materials SET sale_price = unit_price WHERE sale_price IS NULL;

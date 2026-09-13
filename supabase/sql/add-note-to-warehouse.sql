-- Pastaba sandėlio prekėms (pvz. objekto pavadinimas iš tiekėjo sąskaitos)
ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS note TEXT;

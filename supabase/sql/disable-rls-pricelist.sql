-- Išjungti RLS price_categories ir price_items lentelėms (laikinai testavimui)
ALTER TABLE price_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE price_items DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- DIAGNOSTIKA: paleisk šiuos SELECT pirmiausia, pažiūrėk rezultatus
-- ============================================================

-- 1) Ar duomenys vis dar yra DB? (SQL Editor rodo be RLS)
SELECT 'projects' AS tbl, count(*) FROM projects
UNION ALL SELECT 'clients', count(*) FROM clients
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'organizations', count(*) FROM organizations;

-- 2) Ar tavo profilis turi organization_id?
SELECT id, organization_id, role, full_name FROM profiles;

-- 3) Kurios lentelės turi įjungtą RLS?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- TAISYMAS
-- ============================================================
-- Variantas A (greitas, kaip buvo anksčiau): išjungti RLS lentelėms,
-- kurios anksčiau veikė be RLS. Paleisk jei 3-ias SELECT parodė
-- rowsecurity = true ties projects/clients/profiles/organizations.

ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_works DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quote_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warehouse_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS work_time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_acts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_sequences DISABLE ROW LEVEL SECURITY;

-- Variantas B (saugus): palikti RLS įjungtą, bet pataisyti profilį,
-- kad organization_id atitiktų duomenis. Užpildyk reikšmes ir paleisk:
-- UPDATE profiles
-- SET organization_id = (SELECT organization_id FROM projects LIMIT 1)
-- WHERE id = auth.uid() OR organization_id IS NULL;

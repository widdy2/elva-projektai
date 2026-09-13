-- Pridėti budget stulpelį į projects lentelę (jei neegzistuoja)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2) DEFAULT 0;

-- Atnaujinti Supabase schema cache
NOTIFY pgrst, 'reload schema';

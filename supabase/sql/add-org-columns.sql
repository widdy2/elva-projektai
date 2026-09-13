-- Pridėti trūkstamus stulpelius į organizations lentelę
-- (reikalingi Settings formai ir PDF/laiškų šablonams)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vat_code TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#3b82f6';

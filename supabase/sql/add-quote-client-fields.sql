-- Pridéti kliento duomenų laukus į quotes lentelę
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_phone TEXT;

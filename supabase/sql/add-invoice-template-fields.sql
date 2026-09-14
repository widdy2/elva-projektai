-- Sąskaitos šablonui pagal ELVA pavyzdį reikalingi laukai

-- Organizacijos banko rekvizitai (pardavėjo blokas sąskaitoje)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- Kliento įmonės kodai (užsakovo blokas sąskaitoje)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_code TEXT;

-- Sąskaitos pozicijos tipas: 'work' (darbai) arba 'material' (medžiagos)
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'work';

-- Mato vienetas darbams (vnt, m, val, kpl)
ALTER TABLE project_works ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'vnt';

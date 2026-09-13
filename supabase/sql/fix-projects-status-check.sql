-- Pašalinti seną status constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Atnaujinti esamas eilutes į teisingas reikšmes
UPDATE projects SET status = 'planning' WHERE status NOT IN ('planning', 'in_progress', 'completed', 'on_hold');

-- Sukurti naują constraint su teisingomis reikšmėmis
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold'));

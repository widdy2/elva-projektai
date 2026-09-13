-- Testinė organizacija
INSERT INTO organizations (id, name, address, phone, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Organization',
  'Vilnius, Test g. 1',
  '+370 600 00000',
  'test@test.lt'
)
ON CONFLICT (id) DO NOTHING;

-- Testinis klientas
INSERT INTO clients (organization_id, name, email, phone, address)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Jonas Petraitis',
  'jonas@test.lt',
  '+370 600 12345',
  'Vilnius, Gedimino pr. 1'
)
ON CONFLICT DO NOTHING;

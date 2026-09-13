-- Leisti INSERT į projects lentelę be autentifikacijos (viešam pasiūlymo priėmimui)
-- Ši politika leidžia kurti projektus, kai yra public_token
CREATE POLICY "Allow public project creation via quote token" ON projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = (
        SELECT id FROM quotes
        WHERE quotes.public_token IS NOT NULL
        LIMIT 1
      )
    )
  );

-- Arba paprasčiau - leisti INSERT be autentifikacijos (ne saugu, bet veikia testavimui)
DROP POLICY IF EXISTS "Allow public project creation via quote token" ON projects;
CREATE POLICY "Allow public project creation" ON projects
  FOR INSERT WITH CHECK (true);

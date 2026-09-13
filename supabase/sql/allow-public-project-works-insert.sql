-- Leisti INSERT į project_works lentelę be autentifikacijos (viešam pasiūlymo priėmimui)
DROP POLICY IF EXISTS "Allow public project works creation" ON project_works;
CREATE POLICY "Allow public project works creation" ON project_works
  FOR INSERT WITH CHECK (true);

-- Leisti INSERT į clients lentelę be autentifikacijos (viešam pasiūlymo priėmimui)
DROP POLICY IF EXISTS "Allow public client creation" ON clients;
CREATE POLICY "Allow public client creation" ON clients
  FOR INSERT WITH CHECK (true);

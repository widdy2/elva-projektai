-- Panaikinti egzistuojančias RLS taisykles
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Users can update own organization" ON organizations;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;
DROP POLICY IF EXISTS "Users can view own price categories" ON price_categories;
DROP POLICY IF EXISTS "Users can insert own price categories" ON price_categories;
DROP POLICY IF EXISTS "Users can update own price categories" ON price_categories;
DROP POLICY IF EXISTS "Users can delete own price categories" ON price_categories;
DROP POLICY IF EXISTS "Users can view own price items" ON price_items;
DROP POLICY IF EXISTS "Users can insert own price items" ON price_items;
DROP POLICY IF EXISTS "Users can update own price items" ON price_items;
DROP POLICY IF EXISTS "Users can delete own price items" ON price_items;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Users can view own project works" ON project_works;
DROP POLICY IF EXISTS "Users can insert own project works" ON project_works;
DROP POLICY IF EXISTS "Users can update own project works" ON project_works;
DROP POLICY IF EXISTS "Users can delete own project works" ON project_works;
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can view own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can insert own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can update own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can delete own quote items" ON quote_items;

-- Sukurti RLS taisykles iš naujo
CREATE POLICY "Users can view own organization" ON organizations
  FOR SELECT USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own organization" ON organizations
  FOR UPDATE USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can view own clients" ON clients
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own clients" ON clients
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own clients" ON clients
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own clients" ON clients
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own price categories" ON price_categories
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own price categories" ON price_categories
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own price categories" ON price_categories
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own price categories" ON price_categories
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own price items" ON price_items
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own price items" ON price_items
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own price items" ON price_items
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own price items" ON price_items
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own project works" ON project_works
  FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own project works" ON project_works
  FOR INSERT WITH CHECK (project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own project works" ON project_works
  FOR UPDATE USING (project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own project works" ON project_works
  FOR DELETE USING (project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can view own quotes" ON quotes
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own quotes" ON quotes
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own quotes" ON quotes
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own quotes" ON quotes
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own quote items" ON quote_items
  FOR SELECT USING (quote_id IN (SELECT id FROM quotes WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert own quote items" ON quote_items
  FOR INSERT WITH CHECK (quote_id IN (SELECT id FROM quotes WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update own quote items" ON quote_items
  FOR UPDATE USING (quote_id IN (SELECT id FROM quotes WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete own quote items" ON quote_items
  FOR DELETE USING (quote_id IN (SELECT id FROM quotes WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

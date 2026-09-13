-- Warehouse items lentelė (centrinis sandėlis)
CREATE TABLE IF NOT EXISTS warehouse_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'vnt',
  quantity DECIMAL(10, 2) DEFAULT 0,
  unit_price DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_organization ON warehouse_items(organization_id);

-- Project materials lentelė (medžiagos prie objekto)
CREATE TABLE IF NOT EXISTS project_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  warehouse_item_id UUID REFERENCES warehouse_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'vnt',
  planned_quantity DECIMAL(10, 2) DEFAULT 0,
  purchased_quantity DECIMAL(10, 2) DEFAULT 0,
  used_quantity DECIMAL(10, 2) DEFAULT 0,
  unit_price DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_materials_project ON project_materials(project_id);

-- RLS warehouse_items
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warehouse items of their organization" ON warehouse_items
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert warehouse items" ON warehouse_items
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update warehouse items" ON warehouse_items
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete warehouse items" ON warehouse_items
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS project_materials
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view materials of their organization projects" ON project_materials
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert materials to their organization projects" ON project_materials
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update materials of their organization projects" ON project_materials
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete materials of their organization projects" ON project_materials
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

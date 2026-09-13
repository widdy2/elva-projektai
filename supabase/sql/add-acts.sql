-- Project acts lentelė (atliktų darbų aktai)
CREATE TABLE IF NOT EXISTS project_acts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  act_number TEXT NOT NULL,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'signed')),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_acts_project ON project_acts(project_id);

-- Nuosekli akto numeracija per organizaciją
CREATE OR REPLACE FUNCTION generate_act_number(p_project_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_org_id UUID;
  v_year TEXT;
  v_seq INT;
BEGIN
  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(act_number, '-', 3) AS INT)
  ), 0) + 1 INTO v_seq
  FROM project_acts pa
  JOIN projects p ON p.id = pa.project_id
  WHERE p.organization_id = v_org_id
    AND pa.act_number LIKE 'AKT-' || v_year || '-%';

  RETURN 'AKT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS project_acts
ALTER TABLE project_acts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view acts of their organization projects" ON project_acts
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert acts to their organization projects" ON project_acts
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update acts of their organization projects" ON project_acts
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

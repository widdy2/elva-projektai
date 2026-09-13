-- Projekto lygmens laiko sekimas: work_time_entries gauna project_id,
-- work_id tampa neprivalomas (laikmatis gali būti susietas su projektu, ne darbu)
ALTER TABLE work_time_entries ALTER COLUMN work_id DROP NOT NULL;
ALTER TABLE work_time_entries ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_work_time_entries_project ON work_time_entries(project_id);

-- RLS politikos: atnaujiname, kad veiktų ir su project_id (be work_id)
DROP POLICY IF EXISTS "Users can view time entries of their organization" ON work_time_entries;
DROP POLICY IF EXISTS "Users can insert time entries" ON work_time_entries;

CREATE POLICY "Users can view time entries of their organization" ON work_time_entries
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR work_id IN (
      SELECT pw.id FROM project_works pw
      JOIN projects p ON p.id = pw.project_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert time entries" ON work_time_entries
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR work_id IN (
      SELECT pw.id FROM project_works pw
      JOIN projects p ON p.id = pw.project_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

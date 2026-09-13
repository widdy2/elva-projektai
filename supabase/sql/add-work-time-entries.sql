-- Work time entries lentelė (laiko sekimas darbams)
CREATE TABLE IF NOT EXISTS work_time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id UUID REFERENCES project_works(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  hourly_rate DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_time_entries_work ON work_time_entries(work_id);
CREATE INDEX IF NOT EXISTS idx_work_time_entries_user ON work_time_entries(user_id);

-- RLS
ALTER TABLE work_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view time entries of their organization" ON work_time_entries
  FOR SELECT USING (
    work_id IN (
      SELECT pw.id FROM project_works pw
      JOIN projects p ON p.id = pw.project_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert time entries" ON work_time_entries
  FOR INSERT WITH CHECK (
    work_id IN (
      SELECT pw.id FROM project_works pw
      JOIN projects p ON p.id = pw.project_id
      WHERE p.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own time entries" ON work_time_entries
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own time entries" ON work_time_entries
  FOR DELETE USING (
    user_id = auth.uid()
  );

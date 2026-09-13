-- Project photos lentelė
CREATE TABLE IF NOT EXISTS project_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_photos_project ON project_photos(project_id);

-- RLS
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view photos of their organization projects" ON project_photos
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert photos to their organization projects" ON project_photos
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete photos of their organization projects" ON project_photos
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Storage bucket projekto nuotraukoms
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload project photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-photos');

CREATE POLICY "Anyone can view project photos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'project-photos');

CREATE POLICY "Authenticated users can delete project photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-photos');

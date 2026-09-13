-- Storage bucket organizacijos logotipams
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload org logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "Authenticated users can update org logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "Anyone can view org logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'org-logos');

CREATE POLICY "Authenticated users can delete org logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos');
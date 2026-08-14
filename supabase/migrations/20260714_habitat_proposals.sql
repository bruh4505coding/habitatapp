-- ============================================================
-- HABITAT PROPOSALS (KML boundary submissions for admin review)
-- ============================================================

CREATE TABLE IF NOT EXISTS habitat_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  habitat_type text NOT NULL,
  steward_group_name text NOT NULL,
  condition_rating integer
    CHECK (condition_rating IS NULL OR condition_rating BETWEEN 1 AND 5),
  boundary_geojson jsonb NOT NULL,
  kml_file_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_habitat_id uuid REFERENCES habitats(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habitat_proposals_status ON habitat_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_habitat_proposals_submitter ON habitat_proposals (submitted_by, created_at DESC);

ALTER TABLE habitat_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own habitat proposals"
ON habitat_proposals FOR SELECT
TO authenticated
USING (submitted_by = auth.uid() OR is_role('admin'));

CREATE POLICY "Authenticated users can submit habitat proposals"
ON habitat_proposals FOR INSERT
TO authenticated
WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Admins can update habitat proposals"
ON habitat_proposals FOR UPDATE
TO authenticated
USING (is_role('admin'))
WITH CHECK (is_role('admin'));

CREATE TRIGGER set_updated_at_habitat_proposals
BEFORE UPDATE ON habitat_proposals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage for raw KML uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('habitat-proposals', 'habitat-proposals', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own proposal KML"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'habitat-proposals'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users and admins can read proposal KML"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'habitat-proposals'
  AND (
    is_role('admin')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

NOTIFY pgrst, 'reload schema';

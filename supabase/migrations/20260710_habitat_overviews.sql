-- ============================================================
-- HABITAT OVERVIEW (Card 1 curated content per group + habitat)
-- ============================================================

CREATE TABLE IF NOT EXISTS habitat_overviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steward_group_id uuid NOT NULL REFERENCES steward_groups(id) ON DELETE CASCADE,
  habitat_id uuid NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  condition_rating integer
    CHECK (condition_rating IS NULL OR condition_rating BETWEEN 1 AND 5),
  management_type text
    CHECK (management_type IS NULL OR management_type IN (
      'national_park',
      'protected',
      'park',
      'federal_land',
      'other'
    )),
  management_custom text,
  feature_image_url text,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (steward_group_id, habitat_id)
);

CREATE INDEX IF NOT EXISTS idx_habitat_overviews_habitat ON habitat_overviews (habitat_id);

ALTER TABLE habitat_overviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read habitat overviews"
ON habitat_overviews FOR SELECT
USING (true);

CREATE POLICY "Group leads can insert habitat overviews"
ON habitat_overviews FOR INSERT
TO authenticated
WITH CHECK (
  (is_group_lead(steward_group_id) OR is_role('admin'))
  AND group_manages_habitat(steward_group_id, habitat_id)
);

CREATE POLICY "Group leads can update habitat overviews"
ON habitat_overviews FOR UPDATE
TO authenticated
USING (is_group_lead(steward_group_id) OR is_role('admin'))
WITH CHECK (
  (is_group_lead(steward_group_id) OR is_role('admin'))
  AND group_manages_habitat(steward_group_id, habitat_id)
);

CREATE TRIGGER set_updated_at_habitat_overviews
BEFORE UPDATE ON habitat_overviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket for habitat overview images/documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('habitat-overview', 'habitat-overview', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read habitat overview files"
ON storage.objects FOR SELECT
USING (bucket_id = 'habitat-overview');

CREATE POLICY "Group leads can upload habitat overview files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'habitat-overview');

CREATE POLICY "Group leads can update habitat overview files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'habitat-overview');

CREATE POLICY "Group leads can delete habitat overview files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'habitat-overview');

NOTIFY pgrst, 'reload schema';

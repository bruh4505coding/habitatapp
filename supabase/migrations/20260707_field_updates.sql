-- ============================================================
-- FIELD UPDATES
-- Table: field_updates
-- ============================================================

CREATE TABLE IF NOT EXISTS field_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steward_group_id uuid NOT NULL REFERENCES steward_groups(id) ON DELETE CASCADE,
  habitat_id uuid REFERENCES habitats(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL
    CHECK (category IN (
      'habitat_condition',
      'invasive_species',
      'erosion',
      'water',
      'plants',
      'wildlife',
      'safety',
      'restoration',
      'other'
    )),
  photo_url text,
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_updates_group ON field_updates (steward_group_id);
CREATE INDEX IF NOT EXISTS idx_field_updates_group_created ON field_updates (steward_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_updates_public ON field_updates (steward_group_id, visibility)
  WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_field_updates_habitat ON field_updates (habitat_id) WHERE habitat_id IS NOT NULL;

-- ------------------------------------------------------------
-- RLS: field_updates
-- ------------------------------------------------------------

ALTER TABLE field_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public field updates readable by anyone"
ON field_updates FOR SELECT
USING (visibility = 'public');

CREATE POLICY "Private field updates readable by group members"
ON field_updates FOR SELECT
TO authenticated
USING (
  visibility = 'private'
  AND (is_group_member(steward_group_id) OR is_role('admin'))
);

CREATE POLICY "Group members can create field updates"
ON field_updates FOR INSERT
TO authenticated
WITH CHECK (
  is_group_member(steward_group_id)
  AND user_id = auth.uid()
  AND (
    habitat_id IS NULL
    OR group_manages_habitat(steward_group_id, habitat_id)
  )
);

CREATE POLICY "Authors and leads can update field updates"
ON field_updates FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR is_group_lead(steward_group_id)
  OR is_role('admin')
)
WITH CHECK (
  user_id = auth.uid()
  OR is_group_lead(steward_group_id)
  OR is_role('admin')
);

CREATE POLICY "Authors and leads can delete field updates"
ON field_updates FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR is_group_lead(steward_group_id)
  OR is_role('admin')
);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- HABITAT PROPOSALS: multiple habitat labels (up to 10)
-- ============================================================

ALTER TABLE habitat_proposals
  ADD COLUMN IF NOT EXISTS habitat_labels jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE habitat_proposals
SET habitat_labels = jsonb_build_array(habitat_type)
WHERE habitat_type IS NOT NULL
  AND habitat_type <> ''
  AND (habitat_labels IS NULL OR habitat_labels = '[]'::jsonb);

ALTER TABLE habitat_proposals
  DROP CONSTRAINT IF EXISTS habitat_proposals_labels_check;

ALTER TABLE habitat_proposals
  ADD CONSTRAINT habitat_proposals_labels_check
  CHECK (
    jsonb_typeof(habitat_labels) = 'array'
    AND jsonb_array_length(habitat_labels) <= 10
  );

NOTIFY pgrst, 'reload schema';

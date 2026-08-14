-- ============================================================
-- HABITAT OVERVIEW: Characteristic flora + fauna lists
-- ============================================================

ALTER TABLE habitat_overviews
  ADD COLUMN IF NOT EXISTS characteristic_flora jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS characteristic_fauna jsonb NOT NULL DEFAULT '[]';

ALTER TABLE habitat_overviews DROP CONSTRAINT IF EXISTS habitat_overviews_flora_max;
ALTER TABLE habitat_overviews ADD CONSTRAINT habitat_overviews_flora_max
  CHECK (jsonb_typeof(characteristic_flora) = 'array' AND jsonb_array_length(characteristic_flora) <= 40);

ALTER TABLE habitat_overviews DROP CONSTRAINT IF EXISTS habitat_overviews_fauna_max;
ALTER TABLE habitat_overviews ADD CONSTRAINT habitat_overviews_fauna_max
  CHECK (jsonb_typeof(characteristic_fauna) = 'array' AND jsonb_array_length(characteristic_fauna) <= 40);

NOTIFY pgrst, 'reload schema';

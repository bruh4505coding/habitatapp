-- ============================================================
-- HABITAT OVERVIEW: Learn links + Events (Card 3 right column)
-- ============================================================

ALTER TABLE habitat_overviews
  ADD COLUMN IF NOT EXISTS learn_links jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '[]';

ALTER TABLE habitat_overviews DROP CONSTRAINT IF EXISTS habitat_overviews_learn_links_max;
ALTER TABLE habitat_overviews ADD CONSTRAINT habitat_overviews_learn_links_max
  CHECK (jsonb_typeof(learn_links) = 'array' AND jsonb_array_length(learn_links) <= 12);

ALTER TABLE habitat_overviews DROP CONSTRAINT IF EXISTS habitat_overviews_events_max;
ALTER TABLE habitat_overviews ADD CONSTRAINT habitat_overviews_events_max
  CHECK (jsonb_typeof(events) = 'array' AND jsonb_array_length(events) <= 12);

NOTIFY pgrst, 'reload schema';

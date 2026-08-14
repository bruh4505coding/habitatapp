-- Steward-controlled appearance for each habitat overview.
ALTER TABLE habitat_overviews
  ADD COLUMN IF NOT EXISTS palette_key text NOT NULL DEFAULT 'forest',
  ADD COLUMN IF NOT EXISTS banner_image_url text;

ALTER TABLE habitat_overviews
  DROP CONSTRAINT IF EXISTS habitat_overviews_palette_key_check;

ALTER TABLE habitat_overviews
  ADD CONSTRAINT habitat_overviews_palette_key_check
  CHECK (palette_key IN (
    'forest',
    'sage',
    'desert',
    'ocean',
    'wildflower',
    'slate'
  ));

NOTIFY pgrst, 'reload schema';

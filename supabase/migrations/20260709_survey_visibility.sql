-- ============================================================
-- SURVEY VISIBILITY
-- Adds public/private visibility to surveys.
-- ============================================================

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS idx_surveys_public ON surveys (habitat_id, visibility)
  WHERE visibility = 'public';

-- Allow anyone to read surveys explicitly marked public.
-- (Existing "Group members can read surveys" still covers members reading all.)
DROP POLICY IF EXISTS "Public surveys readable by anyone" ON surveys;
CREATE POLICY "Public surveys readable by anyone"
ON surveys FOR SELECT
USING (visibility = 'public');

-- Refine last-survey trigger: only completed (today/past) surveys should
-- advance habitats.last_survey_at. Upcoming (future-dated) surveys are
-- scheduled, not completed, so they must not bump the date.
CREATE OR REPLACE FUNCTION bump_habitat_last_survey()
RETURNS trigger AS $$
BEGIN
  IF NEW.survey_date <= current_date THEN
    UPDATE habitats
    SET last_survey_at = NEW.survey_date
    WHERE id = NEW.habitat_id
      AND (last_survey_at IS NULL OR last_survey_at < NEW.survey_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';

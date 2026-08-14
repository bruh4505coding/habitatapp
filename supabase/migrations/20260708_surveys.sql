-- ============================================================
-- HABITAT SURVEYS
-- Table: surveys
-- Also adds habitats.last_survey_at, updated via trigger.
-- ============================================================

-- ------------------------------------------------------------
-- Add last_survey_at to habitats (idempotent)
-- ------------------------------------------------------------

ALTER TABLE habitats ADD COLUMN IF NOT EXISTS last_survey_at date;

-- ------------------------------------------------------------
-- surveys
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steward_group_id uuid NOT NULL REFERENCES steward_groups(id) ON DELETE CASCADE,
  habitat_id uuid NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  survey_type text NOT NULL
    CHECK (survey_type IN (
      'general_habitat_check',
      'invasive_species_survey',
      'post_fire_recovery',
      'water_seep_check',
      'erosion_survey',
      'rare_plant_survey',
      'pollinator_survey',
      'restoration_monitoring'
    )),
  survey_date date NOT NULL DEFAULT current_date,
  weather text,
  habitat_condition_notes text,
  threats_observed text,
  recommendations text,
  pristineness_rating integer
    CHECK (pristineness_rating IS NULL OR pristineness_rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surveys_habitat ON surveys (habitat_id, survey_date DESC);
CREATE INDEX IF NOT EXISTS idx_surveys_group ON surveys (steward_group_id);
CREATE INDEX IF NOT EXISTS idx_surveys_type ON surveys (habitat_id, survey_type);

-- ------------------------------------------------------------
-- RLS: surveys (stewardship workspace data — members only)
-- ------------------------------------------------------------

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can read surveys"
ON surveys FOR SELECT
TO authenticated
USING (is_group_member(steward_group_id) OR is_role('admin'));

CREATE POLICY "Group members can create surveys"
ON surveys FOR INSERT
TO authenticated
WITH CHECK (
  is_group_member(steward_group_id)
  AND created_by = auth.uid()
  AND group_manages_habitat(steward_group_id, habitat_id)
);

CREATE POLICY "Authors and leads can update surveys"
ON surveys FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR is_group_lead(steward_group_id)
  OR is_role('admin')
)
WITH CHECK (
  created_by = auth.uid()
  OR is_group_lead(steward_group_id)
  OR is_role('admin')
);

CREATE POLICY "Authors and leads can delete surveys"
ON surveys FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR is_group_lead(steward_group_id)
  OR is_role('admin')
);

-- ------------------------------------------------------------
-- Trigger: keep habitats.last_survey_at up to date
-- SECURITY DEFINER so group members can bump the date even
-- though direct habitat updates are admin-only.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION bump_habitat_last_survey()
RETURNS trigger AS $$
BEGIN
  UPDATE habitats
  SET last_survey_at = NEW.survey_date
  WHERE id = NEW.habitat_id
    AND (last_survey_at IS NULL OR last_survey_at < NEW.survey_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS surveys_bump_last_survey ON surveys;
CREATE TRIGGER surveys_bump_last_survey
AFTER INSERT ON surveys
FOR EACH ROW EXECUTE FUNCTION bump_habitat_last_survey();

NOTIFY pgrst, 'reload schema';

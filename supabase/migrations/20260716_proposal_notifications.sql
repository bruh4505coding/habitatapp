-- ============================================================
-- PROPOSAL DECISION NOTIFICATIONS (read/unread for submitters)
-- ============================================================

ALTER TABLE habitat_proposals
  ADD COLUMN IF NOT EXISTS decision_read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_habitat_proposals_unread_decisions
  ON habitat_proposals (submitted_by, reviewed_at DESC)
  WHERE status IN ('approved', 'rejected') AND decision_read_at IS NULL;

CREATE OR REPLACE FUNCTION mark_proposal_decision_read(p_proposal_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE habitat_proposals
  SET decision_read_at = now()
  WHERE id = p_proposal_id
    AND submitted_by = auth.uid()
    AND status IN ('approved', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_proposal_decisions_read()
RETURNS void AS $$
BEGIN
  UPDATE habitat_proposals
  SET decision_read_at = now()
  WHERE submitted_by = auth.uid()
    AND status IN ('approved', 'rejected')
    AND decision_read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_proposal_decision_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_proposal_decisions_read() TO authenticated;

NOTIFY pgrst, 'reload schema';

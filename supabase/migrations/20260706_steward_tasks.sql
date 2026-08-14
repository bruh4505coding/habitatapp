-- ============================================================
-- STEWARD GROUP TASKS
-- Table: steward_tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS steward_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steward_group_id uuid NOT NULL REFERENCES steward_groups(id) ON DELETE CASCADE,
  habitat_id uuid REFERENCES habitats(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'to_do'
    CHECK (status IN ('to_do', 'in_progress', 'blocked', 'completed', 'archived')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_steward_tasks_group ON steward_tasks (steward_group_id);
CREATE INDEX IF NOT EXISTS idx_steward_tasks_status ON steward_tasks (steward_group_id, status);
CREATE INDEX IF NOT EXISTS idx_steward_tasks_habitat ON steward_tasks (habitat_id) WHERE habitat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_steward_tasks_assigned ON steward_tasks (assigned_to) WHERE assigned_to IS NOT NULL;

-- ------------------------------------------------------------
-- RLS: steward_tasks
-- ------------------------------------------------------------

ALTER TABLE steward_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can read tasks"
ON steward_tasks FOR SELECT
TO authenticated
USING (is_group_member(steward_group_id) OR is_role('admin'));

CREATE POLICY "Group members can create tasks"
ON steward_tasks FOR INSERT
TO authenticated
WITH CHECK (
  is_group_member(steward_group_id)
  AND created_by = auth.uid()
  AND (
    habitat_id IS NULL
    OR group_manages_habitat(steward_group_id, habitat_id)
  )
);

CREATE POLICY "Group members can update tasks"
ON steward_tasks FOR UPDATE
TO authenticated
USING (is_group_member(steward_group_id) OR is_role('admin'))
WITH CHECK (
  is_group_member(steward_group_id) OR is_role('admin')
);

CREATE POLICY "Group leads can delete tasks"
ON steward_tasks FOR DELETE
TO authenticated
USING (is_group_lead(steward_group_id) OR is_role('admin'));

CREATE TRIGGER set_updated_at_steward_tasks
BEFORE UPDATE ON steward_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';

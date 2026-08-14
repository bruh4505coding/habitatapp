-- Approving a proposal is an administrative action, not group membership.
-- Let an admin create the steward group on behalf of the proposal submitter.
-- The existing creator trigger will add that submitter (not the reviewer)
-- to the group as its initial manager.

DROP POLICY IF EXISTS "Authenticated users can create groups" ON steward_groups;

CREATE POLICY "Users and admins can create groups"
ON steward_groups FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  OR is_role('admin')
);

NOTIFY pgrst, 'reload schema';

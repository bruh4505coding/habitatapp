-- ============================================================
-- Allow reading active members (and their profiles) of public groups
-- so the steward Team section can list the full roster.
-- ============================================================

CREATE OR REPLACE FUNCTION is_active_public_group_member(p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm
    JOIN steward_groups sg ON sg.id = gm.group_id
    WHERE gm.user_id = p_user_id
      AND gm.status = 'active'
      AND sg.is_public = true
      AND sg.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Anyone can read memberships of public groups" ON group_members;
CREATE POLICY "Anyone can read memberships of public groups"
ON group_members FOR SELECT
USING (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM steward_groups sg
    WHERE sg.id = group_id
      AND sg.is_public = true
      AND sg.status = 'active'
  )
);

DROP POLICY IF EXISTS "Public group member profiles readable" ON profiles;
CREATE POLICY "Public group member profiles readable"
ON profiles FOR SELECT
USING (is_active_public_group_member(id));

NOTIFY pgrst, 'reload schema';

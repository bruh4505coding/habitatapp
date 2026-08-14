-- ============================================================
-- SIMPLIFY ROLES
-- Platform: user | admin  (remove observer, contributor, verifier)
-- Group: member | lead | manager  (rename admin → manager)
-- ============================================================

-- ------------------------------------------------------------
-- Platform roles (profiles.role)
-- Drop constraint FIRST so 'user' is allowed during the UPDATE
-- ------------------------------------------------------------

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE profiles
SET role = 'user'
WHERE role IN ('observer', 'contributor', 'verifier');

ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin'));

DROP POLICY IF EXISTS "Verifiers can read all profiles" ON profiles;

-- ------------------------------------------------------------
-- Group roles (group_members.role): admin → manager
-- ------------------------------------------------------------

ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_role_check;

UPDATE group_members
SET role = 'manager'
WHERE role = 'admin';

ALTER TABLE group_members ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('member', 'lead', 'manager'));

CREATE OR REPLACE FUNCTION is_group_lead(p_group_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role IN ('lead', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_group_manager(p_group_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role = 'manager'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION add_creator_as_group_admin()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO group_members (group_id, user_id, role, status)
    VALUES (NEW.id, NEW.created_by, 'manager', 'active')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- Profile public presence — drop contributions (feature removed)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION profile_has_public_presence(p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM surveys
    WHERE created_by = p_user_id AND visibility = 'public'
  )
  OR EXISTS (
    SELECT 1 FROM field_updates
    WHERE user_id = p_user_id AND visibility = 'public'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

NOTIFY pgrst, 'reload schema';

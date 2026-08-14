-- ============================================================
-- STEWARD GROUPS + MEMBERSHIP (Phase 1)
-- Tables: steward_groups, group_members, habitat_group_access
-- ============================================================

-- ------------------------------------------------------------
-- 1. steward_groups
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS steward_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  mission text,
  region text,
  logo_url text,
  contact_email text,
  is_public boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_steward_groups_slug ON steward_groups (slug);
CREATE INDEX IF NOT EXISTS idx_steward_groups_public
  ON steward_groups (is_public) WHERE is_public = true;

-- ------------------------------------------------------------
-- 2. group_members
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES steward_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'lead', 'admin')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id);

-- ------------------------------------------------------------
-- 3. habitat_group_access
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS habitat_group_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES steward_groups(id) ON DELETE CASCADE,
  habitat_id uuid NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'steward'
    CHECK (relationship IN ('steward', 'partner', 'monitor')),
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  granted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, habitat_id)
);

CREATE INDEX IF NOT EXISTS idx_habitat_group_access_habitat ON habitat_group_access (habitat_id);
CREATE INDEX IF NOT EXISTS idx_habitat_group_access_group ON habitat_group_access (group_id);

-- ------------------------------------------------------------
-- Helper functions (RLS)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_group_member(p_group_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_group_lead(p_group_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role IN ('lead', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION group_manages_habitat(p_group_id uuid, p_habitat_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM habitat_group_access hga
    WHERE hga.group_id = p_group_id
      AND hga.habitat_id = p_habitat_id
      AND hga.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_habitat_workspace_access(p_habitat_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm
    JOIN habitat_group_access hga ON hga.group_id = gm.group_id
    WHERE gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND hga.habitat_id = p_habitat_id
      AND hga.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- RLS: steward_groups
-- ------------------------------------------------------------

ALTER TABLE steward_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public groups readable by anyone"
ON steward_groups FOR SELECT
USING (is_public = true AND status = 'active');

CREATE POLICY "Members can read their groups"
ON steward_groups FOR SELECT
TO authenticated
USING (is_group_member(id));

CREATE POLICY "Platform admins can read all groups"
ON steward_groups FOR SELECT
TO authenticated
USING (is_role('admin'));

CREATE POLICY "Authenticated users can create groups"
ON steward_groups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group leads and platform admins can update groups"
ON steward_groups FOR UPDATE
TO authenticated
USING (is_group_lead(id) OR is_role('admin'));

CREATE POLICY "Platform admins can delete groups"
ON steward_groups FOR DELETE
TO authenticated
USING (is_role('admin'));

CREATE TRIGGER set_updated_at_steward_groups
BEFORE UPDATE ON steward_groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- RLS: group_members
-- ------------------------------------------------------------

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read membership roster of their groups"
ON group_members FOR SELECT
TO authenticated
USING (is_group_member(group_id) OR user_id = auth.uid());

CREATE POLICY "Platform admins can read all memberships"
ON group_members FOR SELECT
TO authenticated
USING (is_role('admin'));

CREATE POLICY "Group leads can insert members"
ON group_members FOR INSERT
TO authenticated
WITH CHECK (is_group_lead(group_id) OR is_role('admin'));

CREATE POLICY "Group leads can update members"
ON group_members FOR UPDATE
TO authenticated
USING (is_group_lead(group_id) OR is_role('admin'));

CREATE POLICY "Group leads can remove members"
ON group_members FOR DELETE
TO authenticated
USING (is_group_lead(group_id) OR is_role('admin') OR user_id = auth.uid());

-- ------------------------------------------------------------
-- RLS: habitat_group_access
-- ------------------------------------------------------------

ALTER TABLE habitat_group_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active habitat-group links"
ON habitat_group_access FOR SELECT
USING (status = 'active');

CREATE POLICY "Group leads can manage habitat access"
ON habitat_group_access FOR INSERT
TO authenticated
WITH CHECK (is_group_lead(group_id) OR is_role('admin'));

CREATE POLICY "Group leads can update habitat access"
ON habitat_group_access FOR UPDATE
TO authenticated
USING (is_group_lead(group_id) OR is_role('admin'));

CREATE POLICY "Group leads can revoke habitat access"
ON habitat_group_access FOR DELETE
TO authenticated
USING (is_group_lead(group_id) OR is_role('admin'));

-- ------------------------------------------------------------
-- Auto-add group creator as admin member
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION add_creator_as_group_admin()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO group_members (group_id, user_id, role, status)
    VALUES (NEW.id, NEW.created_by, 'admin', 'active')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER steward_group_creator_membership_trigger
AFTER INSERT ON steward_groups
FOR EACH ROW EXECUTE FUNCTION add_creator_as_group_admin();

NOTIFY pgrst, 'reload schema';

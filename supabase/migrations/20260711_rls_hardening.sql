-- ============================================================
-- RLS HARDENING
-- 1. Restrict profile reads (no more blanket authenticated read)
-- 2. Lock down habitat-overview storage uploads to group leads
-- ============================================================

-- ------------------------------------------------------------
-- Profile helpers
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION shares_steward_group_with(p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm_self
    JOIN group_members gm_peer ON gm_peer.group_id = gm_self.group_id
    WHERE gm_self.user_id = auth.uid()
      AND gm_peer.user_id = p_user_id
      AND gm_self.status = 'active'
      AND gm_peer.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION profile_has_public_presence(p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM surveys
    WHERE created_by = p_user_id AND visibility = 'public'
  )
  OR EXISTS (
    SELECT 1 FROM field_updates
    WHERE user_id = p_user_id AND visibility = 'public'
  )
  OR EXISTS (
    SELECT 1 FROM field_updates
    WHERE user_id = p_user_id AND visibility = 'public'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ------------------------------------------------------------
-- Profiles: replace blanket read
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Logged in users can read profiles" ON profiles;

CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_role('admin'));

CREATE POLICY "Verifiers can read all profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_role('verifier'));

CREATE POLICY "Steward group peers can read profiles"
ON profiles FOR SELECT
TO authenticated
USING (shares_steward_group_with(id));

CREATE POLICY "Public content authors profiles readable"
ON profiles FOR SELECT
USING (profile_has_public_presence(id));

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- Storage: habitat-overview path is {groupId}/{habitatId}/{file}
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION storage_habitat_overview_group_id(object_name text)
RETURNS uuid AS $$
BEGIN
  RETURN split_part(object_name, '/', 1)::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_habitat_overview_habitat_id(object_name text)
RETURNS uuid AS $$
BEGIN
  RETURN split_part(object_name, '/', 2)::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION can_manage_habitat_overview_storage(object_name text)
RETURNS boolean AS $$
  SELECT
    storage_habitat_overview_group_id(object_name) IS NOT NULL
    AND storage_habitat_overview_habitat_id(object_name) IS NOT NULL
    AND (
      is_group_lead(storage_habitat_overview_group_id(object_name))
      OR is_role('admin')
    )
    AND group_manages_habitat(
      storage_habitat_overview_group_id(object_name),
      storage_habitat_overview_habitat_id(object_name)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Group leads can upload habitat overview files" ON storage.objects;
DROP POLICY IF EXISTS "Group leads can update habitat overview files" ON storage.objects;
DROP POLICY IF EXISTS "Group leads can delete habitat overview files" ON storage.objects;

CREATE POLICY "Group leads can upload habitat overview files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'habitat-overview'
  AND can_manage_habitat_overview_storage(name)
);

CREATE POLICY "Group leads can update habitat overview files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'habitat-overview'
  AND can_manage_habitat_overview_storage(name)
);

CREATE POLICY "Group leads can delete habitat overview files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'habitat-overview'
  AND can_manage_habitat_overview_storage(name)
);

NOTIFY pgrst, 'reload schema';

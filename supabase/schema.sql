-- ============================================================
-- UPDATED_AT TRIGGER (reused across habitats, observations, contributions)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- TABLE 1: profiles
-- ============================================================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  bio text,
  profile_picture_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION (placed after profiles table exists)
-- ============================================================

CREATE OR REPLACE FUNCTION is_role(required_role text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = required_role
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_role('admin'));

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  role = (SELECT role FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
TO authenticated
USING (is_role('admin'));


-- ============================================================
-- TABLE 2: habitats
-- ============================================================

CREATE TABLE habitats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  boundary jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE habitats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read habitats"
ON habitats FOR SELECT
USING (true);

CREATE POLICY "Admins can create habitats"
ON habitats FOR INSERT
TO authenticated
WITH CHECK (is_role('admin'));

CREATE POLICY "Admins can update habitats"
ON habitats FOR UPDATE
TO authenticated
USING (is_role('admin'));

CREATE POLICY "Admins can delete habitats"
ON habitats FOR DELETE
TO authenticated
USING (is_role('admin'));

CREATE TRIGGER set_updated_at_habitats
BEFORE UPDATE ON habitats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- TABLE 3: observations
-- ============================================================

CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habitat_id uuid NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  species text NOT NULL,
  notes text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read observations"
ON observations FOR SELECT
USING (true);

CREATE POLICY "Logged in users can create observations"
ON observations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own observations"
ON observations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users or admins can delete observations"
ON observations FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR is_role('admin'));

CREATE TRIGGER set_updated_at_observations
BEFORE UPDATE ON observations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- TABLE 4: contributions
-- ============================================================

CREATE TABLE contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habitat_id uuid NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL CHECK (type IN ('Restoration', 'Monitoring', 'Cleanup', 'Planting', 'Survey')),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read contributions"
ON contributions FOR SELECT
USING (true);

CREATE POLICY "Logged in users can create contributions"
ON contributions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contributions"
ON contributions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users or admins can delete contributions"
ON contributions FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR is_role('admin'));

CREATE TRIGGER set_updated_at_contributions
BEFORE UPDATE ON contributions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- TABLE 5: boundary_edits
-- ============================================================

CREATE TABLE boundary_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habitat_id uuid NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  proposed_boundary jsonb NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE boundary_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verifiers and admins can read boundary edits"
ON boundary_edits FOR SELECT
TO authenticated
USING (is_role('verifier') OR is_role('admin'));

CREATE POLICY "Logged in users can submit boundary edits"
ON boundary_edits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete boundary edits"
ON boundary_edits FOR DELETE
TO authenticated
USING (is_role('admin'));


-- ============================================================
-- TABLE 6: submissions
-- ============================================================

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boundary_edit_id uuid NOT NULL REFERENCES boundary_edits(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitters can read own submission status"
ON submissions FOR SELECT
TO authenticated
USING (
  boundary_edit_id IN (
    SELECT id FROM boundary_edits WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Verifiers and admins can read all submissions"
ON submissions FOR SELECT
TO authenticated
USING (is_role('verifier') OR is_role('admin'));

CREATE POLICY "Verifiers and admins can update submissions"
ON submissions FOR UPDATE
TO authenticated
USING (is_role('verifier') OR is_role('admin'));

CREATE POLICY "Admins can delete submissions"
ON submissions FOR DELETE
TO authenticated
USING (is_role('admin'));


-- ============================================================
-- TRIGGER: auto-create submission when boundary edit is inserted
-- ============================================================

CREATE OR REPLACE FUNCTION create_submission_on_boundary_edit()
RETURNS trigger AS $$
BEGIN
  INSERT INTO submissions (boundary_edit_id, status)
  VALUES (NEW.id, 'pending');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER boundary_edit_submission_trigger
AFTER INSERT ON boundary_edits
FOR EACH ROW
EXECUTE FUNCTION create_submission_on_boundary_edit();

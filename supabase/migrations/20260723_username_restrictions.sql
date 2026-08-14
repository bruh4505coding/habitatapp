-- Case-insensitive unique usernames + max 2 username changes per calendar month.

CREATE TABLE IF NOT EXISTS username_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_username text NOT NULL,
  new_username text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_username_change_log_user_month
  ON username_change_log (user_id, changed_at DESC);

ALTER TABLE username_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own username changes" ON username_change_log;
CREATE POLICY "Users can read own username changes"
ON username_change_log FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_role('admin'));

-- Prefer case-insensitive uniqueness. Keep exact UNIQUE if present;
-- this index catches "Alex" vs "alex".
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON profiles (lower(username));

CREATE OR REPLACE FUNCTION public.normalize_username(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(raw);
$$;

CREATE OR REPLACE FUNCTION public.is_username_available(desired text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT length(trim(desired)) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM profiles
      WHERE lower(username) = lower(trim(desired))
        AND id IS DISTINCT FROM auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.username_changes_used_this_month()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::integer
  FROM username_change_log
  WHERE user_id = auth.uid()
    AND changed_at >= date_trunc('month', timezone('utc', now()));
$$;

CREATE OR REPLACE FUNCTION public.username_changes_remaining()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT GREATEST(0, 2 - public.username_changes_used_this_month());
$$;

CREATE OR REPLACE FUNCTION public.enforce_username_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  change_count integer;
BEGIN
  NEW.username := public.normalize_username(NEW.username);

  IF NEW.username IS NULL OR NEW.username = '' THEN
    RAISE EXCEPTION 'Username cannot be empty'
      USING ERRCODE = 'check_violation';
  END IF;

  IF char_length(NEW.username) < 3 OR char_length(NEW.username) > 30 THEN
    RAISE EXCEPTION 'Username must be 3–30 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.username !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username may only use letters, numbers, underscores, and hyphens'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM profiles
    WHERE lower(username) = lower(NEW.username)
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Username is already taken'
      USING ERRCODE = 'unique_violation';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.username IS DISTINCT FROM OLD.username THEN
    SELECT count(*)::integer INTO change_count
    FROM username_change_log
    WHERE user_id = NEW.id
      AND changed_at >= date_trunc('month', timezone('utc', now()));

    IF change_count >= 2 THEN
      RAISE EXCEPTION 'Username can only be changed twice per month'
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO username_change_log (user_id, old_username, new_username)
    VALUES (NEW.id, OLD.username, NEW.username);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_username_rules ON profiles;
CREATE TRIGGER profiles_enforce_username_rules
BEFORE INSERT OR UPDATE OF username ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_username_rules();

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.username_changes_used_this_month() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.username_changes_remaining() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.username_changes_used_this_month() TO authenticated;
GRANT EXECUTE ON FUNCTION public.username_changes_remaining() TO authenticated;

NOTIFY pgrst, 'reload schema';

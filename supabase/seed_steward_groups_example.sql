-- ============================================================
-- OPTIONAL: Example seed data for steward groups
-- Run AFTER 20260705_steward_groups.sql
-- Replace YOUR_USER_ID and YOUR_HABITAT_ID with real UUIDs from Supabase.
-- ============================================================

-- Find your user id:
--   SELECT id, email FROM profiles;
-- Find a habitat id:
--   SELECT id, name FROM habitats;

INSERT INTO steward_groups (slug, name, mission, region, is_public, created_by)
VALUES (
  'chaparral-stewards',
  'Chaparral Stewards',
  'We monitor and restore chaparral habitats across the Santa Monica Mountains.',
  'Santa Monica Mountains',
  true,
  'YOUR_USER_ID'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO habitat_group_access (group_id, habitat_id, relationship, is_primary, granted_by)
SELECT
  sg.id,
  'YOUR_HABITAT_ID'::uuid,
  'steward',
  true,
  'YOUR_USER_ID'::uuid
FROM steward_groups sg
WHERE sg.slug = 'chaparral-stewards'
ON CONFLICT (group_id, habitat_id) DO NOTHING;

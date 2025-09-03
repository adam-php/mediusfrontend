-- SQL queries to fix swapped username/email data in profiles table
-- Run these in your Supabase SQL editor

-- First, let's see what profiles might have swapped data
-- Find profiles where username contains @ (looks like an email)
SELECT
  id,
  username,
  email,
  created_at
FROM profiles
WHERE username LIKE '%@%'
ORDER BY created_at DESC;

-- Find profiles where email doesn't contain @ (looks like a username)
SELECT
  id,
  username,
  email,
  created_at
FROM profiles
WHERE email IS NOT NULL
  AND email NOT LIKE '%@%'
ORDER BY created_at DESC;

-- Find profiles where BOTH username and email look wrong
SELECT
  id,
  username,
  email,
  created_at
FROM profiles
WHERE username LIKE '%@%'
  AND email IS NOT NULL
  AND email NOT LIKE '%@%'
ORDER BY created_at DESC;

-- BACKUP: Create a backup table before making changes
CREATE TABLE profiles_backup AS
SELECT * FROM profiles;

-- FIX 1: Swap data where username contains @ and email doesn't
-- This assumes the username field contains the email and email field contains the username
UPDATE profiles
SET
  username = LOWER(TRIM(email)),
  email = username
WHERE username LIKE '%@%'
  AND email IS NOT NULL
  AND email NOT LIKE '%@%';

-- FIX 2: If only username contains @ but email is NULL or valid,
-- move the username content to email and set username to NULL
UPDATE profiles
SET
  email = username,
  username = NULL
WHERE username LIKE '%@%'
  AND (email IS NULL OR email LIKE '%@%');

-- FIX 3: Clean up any remaining issues
-- Set username to lowercase and trim whitespace
UPDATE profiles
SET username = LOWER(TRIM(username))
WHERE username IS NOT NULL;

-- Verify the fixes
SELECT
  id,
  username,
  email,
  created_at
FROM profiles
WHERE id IN (
  SELECT id FROM profiles_backup
  WHERE username LIKE '%@%'
     OR (email IS NOT NULL AND email NOT LIKE '%@%')
)
ORDER BY created_at DESC;

-- Count how many profiles were affected
SELECT
  'Original problematic profiles' as description,
  COUNT(*) as count
FROM profiles_backup
WHERE username LIKE '%@%'
   OR (email IS NOT NULL AND email NOT LIKE '%@%')

UNION ALL

SELECT
  'Remaining problematic profiles' as description,
  COUNT(*) as count
FROM profiles
WHERE username LIKE '%@%'
   OR (email IS NOT NULL AND email NOT LIKE '%@%');

-- Optional: Drop the backup table after verifying fixes
-- DROP TABLE profiles_backup;

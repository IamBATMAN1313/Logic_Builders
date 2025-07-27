-- Migration: Change admin_users.admin_id from INTEGER to UUID
-- This script will migrate the admin_users table to use UUID for admin_id
-- and update all dependent tables

BEGIN;

-- Step 1: Store the mapping of old admin_id to new UUID
CREATE TEMP TABLE admin_id_mapping (
  old_admin_id INTEGER,
  new_admin_id UUID,
  user_id UUID
);

-- Generate new UUIDs for each existing admin
INSERT INTO admin_id_mapping (old_admin_id, new_admin_id, user_id)
SELECT admin_id, gen_random_uuid(), NULL FROM admin_users;

-- Step 2: Create general_user accounts for admins that don't have them
INSERT INTO general_user (id, username, email, password_hash, full_name, created_at, updated_at)
SELECT 
  mapping.new_admin_id, -- Use the new admin UUID as the general_user ID
  LOWER(REPLACE(au.name, ' ', '')) || '_admin',
  COALESCE(au.email, LOWER(REPLACE(au.name, ' ', '')) || '@logicbuilders.com'),
  au.password,
  au.name,
  COALESCE(au.created_at, NOW()),
  COALESCE(au.updated_at, NOW())
FROM admin_users au
JOIN admin_id_mapping mapping ON au.admin_id = mapping.old_admin_id
LEFT JOIN general_user gu ON (LOWER(gu.full_name) = LOWER(au.name) OR LOWER(gu.email) = LOWER(au.email))
WHERE gu.id IS NULL
ON CONFLICT (email) DO NOTHING;

-- Update mapping with user_id (use the same UUID for both admin_id and user_id)
UPDATE admin_id_mapping 
SET user_id = new_admin_id;

-- Step 3: Drop foreign key constraints temporarily
ALTER TABLE admin_signup_requests DROP CONSTRAINT IF EXISTS admin_signup_requests_approved_by_fkey;
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;
ALTER TABLE admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_admin_id_fkey;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_created_by_fkey;

-- Step 4: Update dependent tables with new UUIDs
-- Update admin_signup_requests
ALTER TABLE admin_signup_requests ADD COLUMN new_approved_by UUID;
UPDATE admin_signup_requests 
SET new_approved_by = mapping.new_admin_id
FROM admin_id_mapping mapping
WHERE admin_signup_requests.approved_by = mapping.old_admin_id;

-- Update admin_logs
ALTER TABLE admin_logs ADD COLUMN new_admin_id UUID;
UPDATE admin_logs 
SET new_admin_id = mapping.new_admin_id
FROM admin_id_mapping mapping
WHERE admin_logs.admin_id = mapping.old_admin_id;

-- Update admin_notifications
ALTER TABLE admin_notifications ADD COLUMN new_admin_id UUID;
UPDATE admin_notifications 
SET new_admin_id = mapping.new_admin_id
FROM admin_id_mapping mapping
WHERE admin_notifications.admin_id = mapping.old_admin_id;

-- Update promotions
ALTER TABLE promotions ADD COLUMN new_created_by UUID;
UPDATE promotions 
SET new_created_by = mapping.new_admin_id
FROM admin_id_mapping mapping
WHERE promotions.created_by = mapping.old_admin_id;

-- Step 5: Replace old columns with new ones in dependent tables
-- admin_signup_requests
ALTER TABLE admin_signup_requests DROP COLUMN approved_by;
ALTER TABLE admin_signup_requests RENAME COLUMN new_approved_by TO approved_by;

-- admin_logs
ALTER TABLE admin_logs DROP COLUMN admin_id;
ALTER TABLE admin_logs RENAME COLUMN new_admin_id TO admin_id;

-- admin_notifications
ALTER TABLE admin_notifications DROP COLUMN admin_id;
ALTER TABLE admin_notifications RENAME COLUMN new_admin_id TO admin_id;

-- promotions
ALTER TABLE promotions DROP COLUMN created_by;
ALTER TABLE promotions RENAME COLUMN new_created_by TO created_by;

-- Step 6: Update admin_users table
-- Add new columns
ALTER TABLE admin_users ADD COLUMN new_admin_id UUID;
ALTER TABLE admin_users ADD COLUMN user_id UUID;

-- Update with mapped values
UPDATE admin_users 
SET new_admin_id = mapping.new_admin_id,
    user_id = mapping.user_id
FROM admin_id_mapping mapping
WHERE admin_users.admin_id = mapping.old_admin_id;

-- Drop the old primary key
ALTER TABLE admin_users DROP CONSTRAINT admin_users_pkey;

-- Drop old column and rename new one
ALTER TABLE admin_users DROP COLUMN admin_id;
ALTER TABLE admin_users RENAME COLUMN new_admin_id TO admin_id;

-- Make the new columns NOT NULL
ALTER TABLE admin_users ALTER COLUMN admin_id SET NOT NULL;
ALTER TABLE admin_users ALTER COLUMN user_id SET NOT NULL;

-- Add new primary key
ALTER TABLE admin_users ADD PRIMARY KEY (admin_id);

-- Step 7: Re-add foreign key constraints
ALTER TABLE admin_users ADD CONSTRAINT fk_admin_users_user_id 
  FOREIGN KEY (user_id) REFERENCES general_user(id) ON DELETE CASCADE;

ALTER TABLE admin_signup_requests ADD CONSTRAINT admin_signup_requests_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES admin_users(admin_id);

ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id);

ALTER TABLE admin_notifications ADD CONSTRAINT admin_notifications_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id);

ALTER TABLE promotions ADD CONSTRAINT promotions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES admin_users(admin_id);

-- Step 8: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_clearance_level ON admin_users(clearance_level);

COMMIT;

-- Display the migrated data
SELECT 
  admin_id,
  user_id,
  name,
  email,
  clearance_level,
  is_active
FROM admin_users
ORDER BY clearance_level, name;

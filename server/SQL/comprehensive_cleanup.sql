-- Comprehensive cleanup: Remove unused access levels and update references
-- This script handles all foreign key constraints

BEGIN;

-- Step 1: Update signup requests that reference levels 1, 7, 8
-- Convert level 1 (Product Director) requests to level 3 (Product Manager) 
-- Convert level 7, 8 requests to level 6 (Analytics Specialist) as a safe default

UPDATE admin_signup_requests 
SET requested_clearance = 3, updated_at = CURRENT_TIMESTAMP
WHERE requested_clearance = 1;

UPDATE admin_signup_requests 
SET requested_clearance = 6, updated_at = CURRENT_TIMESTAMP
WHERE requested_clearance IN (7, 8);

UPDATE admin_signup_requests 
SET assigned_clearance = 3, updated_at = CURRENT_TIMESTAMP
WHERE assigned_clearance = 1;

UPDATE admin_signup_requests 
SET assigned_clearance = 6, updated_at = CURRENT_TIMESTAMP
WHERE assigned_clearance IN (7, 8);

-- Step 2: Update level 3 name from "Product Expert" to "Product Manager"
UPDATE access_levels 
SET access_name = 'Product Manager', 
    description = 'Manages product catalog, pricing, and product-related operations. ',
    updated_at = CURRENT_TIMESTAMP
WHERE access_level = 3;

-- Step 3: Remove unused access levels (1, 7, 8)
DELETE FROM access_levels WHERE access_level IN (1, 7, 8);

-- Step 4: Verify the final state
SELECT 'Final Access Levels:' as info;
SELECT access_level, access_name, description 
FROM access_levels 
ORDER BY access_level;

SELECT 'Updated Signup Requests:' as info;
SELECT request_id, employee_id, requested_clearance, assigned_clearance, status 
FROM admin_signup_requests 
WHERE requested_clearance IN (3, 6) OR assigned_clearance IN (3, 6);

COMMIT;

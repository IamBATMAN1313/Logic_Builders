-- Clean up access levels: remove unused levels 1, 7, 8 and rename level 3
-- This script removes unused clearance levels and updates naming

BEGIN;

-- First, check if there are any admins using levels 1, 7, or 8
DO $$
DECLARE
    admin_count_1 INTEGER;
    admin_count_7 INTEGER;
    admin_count_8 INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count_1 FROM admin_users WHERE clearance_level = 1;
    SELECT COUNT(*) INTO admin_count_7 FROM admin_users WHERE clearance_level = 7;
    SELECT COUNT(*) INTO admin_count_8 FROM admin_users WHERE clearance_level = 8;
    
    IF admin_count_1 > 0 OR admin_count_7 > 0 OR admin_count_8 > 0 THEN
        RAISE EXCEPTION 'Cannot remove access levels that have users assigned. Please reassign users first.';
    END IF;
END $$;

-- Update level 3 name from "Product Expert" to "Product Manager"
UPDATE access_levels 
SET access_name = 'Product Manager', 
    description = 'Manages product catalog, pricing, and product-related operations. Can access all areas except admin management.',
    updated_at = CURRENT_TIMESTAMP
WHERE access_level = 3;

-- Remove unused access levels
DELETE FROM access_levels WHERE access_level IN (1, 7, 8);

-- Verify the final state
SELECT access_level, access_name, description 
FROM access_levels 
ORDER BY access_level;

COMMIT;

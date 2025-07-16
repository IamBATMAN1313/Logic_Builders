-- Migration to Numerical Clearance Level System
-- This migration changes the clearance_level from text-based to numerical system

-- Step 1: Create the access_levels table
CREATE TABLE IF NOT EXISTS access_levels (
  access_level INTEGER PRIMARY KEY,
  access_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Insert the access levels (0 = highest authority, increasing numbers = lower authority)
INSERT INTO access_levels (access_level, access_name, description) VALUES
(0, 'General Manager', 'Highest level of access - can manage all aspects of the system'),
(1, 'Product Director', 'Can manage products, inventory, orders, promotions, and analytics'),
(2, 'Inventory Manager', 'Can manage inventory and stock levels'),
(3, 'Product Expert', 'Can manage product information and categories'),
(4, 'Order Manager', 'Can manage orders and delivery status'),
(5, 'Promotion Manager', 'Can manage promotions and discounts'),
(6, 'Analytics Specialist', 'Can view and analyze system data'),
(7, 'Inventory Specialist', 'Can view and update specific inventory items'),
(8, 'Delivery Coordinator', 'Can update delivery status and manage logistics')
ON CONFLICT (access_level) DO NOTHING;

-- Step 3: Add the new numerical clearance_level column to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS clearance_level_new INTEGER;

-- Step 4: Create a temporary mapping to convert existing text clearance levels to numbers
-- Update existing records based on current clearance_level values
UPDATE admin_users SET clearance_level_new = 
  CASE 
    WHEN clearance_level = 'GENERAL_MANAGER' THEN 0
    WHEN clearance_level = 'PRODUCT_DIRECTOR' THEN 1
    WHEN clearance_level = 'INVENTORY_MANAGER' THEN 2
    WHEN clearance_level = 'PRODUCT_EXPERT' THEN 3
    WHEN clearance_level = 'ORDER_MANAGER' THEN 4
    WHEN clearance_level = 'PROMO_MANAGER' THEN 5
    WHEN clearance_level = 'ANALYTICS' THEN 6
    WHEN clearance_level = 'INVENTORY_SPECIALIST' THEN 7
    WHEN clearance_level = 'DELIVERY_COORDINATOR' THEN 8
    ELSE 8 -- Default to lowest level for unknown values
  END
WHERE clearance_level_new IS NULL;

-- Step 5: Drop the old clearance_level column and rename the new one
ALTER TABLE admin_users DROP COLUMN IF EXISTS clearance_level;
ALTER TABLE admin_users RENAME COLUMN clearance_level_new TO clearance_level;

-- Step 6: Add foreign key constraint to link admin_users to access_levels
ALTER TABLE admin_users ADD CONSTRAINT fk_admin_clearance_level 
  FOREIGN KEY (clearance_level) REFERENCES access_levels(access_level);

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_clearance_level ON admin_users(clearance_level);
CREATE INDEX IF NOT EXISTS idx_access_levels_name ON access_levels(access_name);

-- Step 8: Update admin_signup_requests table to use numerical clearance levels
ALTER TABLE admin_signup_requests ADD COLUMN IF NOT EXISTS requested_clearance_new INTEGER;

-- Update existing signup requests
UPDATE admin_signup_requests SET requested_clearance_new = 
  CASE 
    WHEN requested_clearance = 'GENERAL_MANAGER' THEN 0
    WHEN requested_clearance = 'PRODUCT_DIRECTOR' THEN 1
    WHEN requested_clearance = 'INVENTORY_MANAGER' THEN 2
    WHEN requested_clearance = 'PRODUCT_EXPERT' THEN 3
    WHEN requested_clearance = 'ORDER_MANAGER' THEN 4
    WHEN requested_clearance = 'PROMO_MANAGER' THEN 5
    WHEN requested_clearance = 'ANALYTICS' THEN 6
    WHEN requested_clearance = 'INVENTORY_SPECIALIST' THEN 7
    WHEN requested_clearance = 'DELIVERY_COORDINATOR' THEN 8
    ELSE 8 -- Default to lowest level for unknown values
  END
WHERE requested_clearance_new IS NULL;

-- Update assigned_clearance as well if it exists
ALTER TABLE admin_signup_requests ADD COLUMN IF NOT EXISTS assigned_clearance_new INTEGER;

UPDATE admin_signup_requests SET assigned_clearance_new = 
  CASE 
    WHEN assigned_clearance = 'GENERAL_MANAGER' THEN 0
    WHEN assigned_clearance = 'PRODUCT_DIRECTOR' THEN 1
    WHEN assigned_clearance = 'INVENTORY_MANAGER' THEN 2
    WHEN assigned_clearance = 'PRODUCT_EXPERT' THEN 3
    WHEN assigned_clearance = 'ORDER_MANAGER' THEN 4
    WHEN assigned_clearance = 'PROMO_MANAGER' THEN 5
    WHEN assigned_clearance = 'ANALYTICS' THEN 6
    WHEN assigned_clearance = 'INVENTORY_SPECIALIST' THEN 7
    WHEN assigned_clearance = 'DELIVERY_COORDINATOR' THEN 8
    ELSE NULL
  END
WHERE assigned_clearance_new IS NULL AND assigned_clearance IS NOT NULL;

-- Drop old columns and rename new ones for admin_signup_requests
ALTER TABLE admin_signup_requests DROP COLUMN IF EXISTS requested_clearance;
ALTER TABLE admin_signup_requests DROP COLUMN IF EXISTS assigned_clearance;
ALTER TABLE admin_signup_requests RENAME COLUMN requested_clearance_new TO requested_clearance;
ALTER TABLE admin_signup_requests RENAME COLUMN assigned_clearance_new TO assigned_clearance;

-- Add foreign key constraints for signup requests
ALTER TABLE admin_signup_requests ADD CONSTRAINT fk_signup_requested_clearance 
  FOREIGN KEY (requested_clearance) REFERENCES access_levels(access_level);

ALTER TABLE admin_signup_requests ADD CONSTRAINT fk_signup_assigned_clearance 
  FOREIGN KEY (assigned_clearance) REFERENCES access_levels(access_level);

-- Step 9: Create trigger to auto-update access_levels timestamp
CREATE OR REPLACE FUNCTION update_access_levels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_access_levels_updated_at
  BEFORE UPDATE ON access_levels
  FOR EACH ROW EXECUTE PROCEDURE update_access_levels_updated_at();

-- Step 10: Ensure EMP001 (General Manager) exists with clearance level 0
INSERT INTO admin_users (admin_id, employee_id, name, email, password, clearance_level, is_employed)
VALUES (1, 'EMP001', 'System Administrator', 'admin@logicbuilders.com', '$2b$10$example_hash', 0, true)
ON CONFLICT (employee_id) DO UPDATE SET clearance_level = 0;

COMMIT;

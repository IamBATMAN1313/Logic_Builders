-- Update clearance levels with meaningful job titles

-- 1. Update existing clearance levels
UPDATE admin_users SET clearance_level = 'PRODUCT_DIRECTOR' WHERE clearance_level = 'INVENTORY_MANAGER';
UPDATE admin_users SET clearance_level = 'MARKETING_MANAGER' WHERE clearance_level = 'PROMO_MANAGER';

-- 2. Add new clearance levels
-- Update any existing users or they can be manually assigned

-- Job Title Hierarchy:
-- 1. GENERAL_MANAGER - Full access to everything
-- 2. PRODUCT_DIRECTOR - Manages products, inventory, analytics (everything except admin management)
-- 3. MARKETING_MANAGER - Promotions and analytics access
-- 4. DATA_ANALYST - Analytics only
-- 5. INVENTORY_SPECIALIST - Inventory and reorder management
-- 6. DELIVERY_COORDINATOR - Orders management only

-- Update admin_signup_requests table if needed
UPDATE admin_signup_requests SET requested_clearance = 'PRODUCT_DIRECTOR' WHERE requested_clearance = 'INVENTORY_MANAGER';
UPDATE admin_signup_requests SET requested_clearance = 'MARKETING_MANAGER' WHERE requested_clearance = 'PROMO_MANAGER';

-- Sample admin users with new titles (you can run this if you want sample data)
-- INSERT INTO admin_users (employee_id, name, password, clearance_level) VALUES
-- ('PROD001', 'Sarah Chen - Product Director', '$2b$10$hashedpassword', 'PRODUCT_DIRECTOR'),
-- ('MKT001', 'Mike Rodriguez - Marketing Manager', '$2b$10$hashedpassword', 'MARKETING_MANAGER'),
-- ('DATA001', 'Emma Watson - Data Analyst', '$2b$10$hashedpassword', 'DATA_ANALYST'),
-- ('INV001', 'James Kim - Inventory Specialist', '$2b$10$hashedpassword', 'INVENTORY_SPECIALIST'),
-- ('DEL001', 'Alex Thompson - Delivery Coordinator', '$2b$10$hashedpassword', 'DELIVERY_COORDINATOR');

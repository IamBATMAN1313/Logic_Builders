-- ============================================================================
-- COMPLETE STOCK MANAGEMENT WORKFLOW TEST
-- ============================================================================
-- This script demonstrates the complete stock management system in action

-- 1. SETUP: Create a test product with known stock
UPDATE product_attribute SET stock = 5 WHERE product_id = 1602;
SELECT 'INITIAL STATE' as stage, p.name, p.availability, pa.stock 
FROM product p JOIN product_attribute pa ON p.id = pa.product_id WHERE p.id = 1602;

-- 2. STOCK DEPLETION TEST: Reduce stock to 0
UPDATE product_attribute SET stock = 0 WHERE product_id = 1602;
SELECT 'AFTER STOCK DEPLETION' as stage, p.name, p.availability, pa.stock 
FROM product p JOIN product_attribute pa ON p.id = pa.product_id WHERE p.id = 1602;

-- 3. STOCK RESTORATION TEST: Restore stock
UPDATE product_attribute SET stock = 3 WHERE product_id = 1602;
SELECT 'AFTER STOCK RESTORATION' as stage, p.name, p.availability, pa.stock 
FROM product p JOIN product_attribute pa ON p.id = pa.product_id WHERE p.id = 1602;

-- 4. CART VALIDATION TEST: Try to add more than available stock
-- This should fail with a helpful error message
-- INSERT INTO cart_item (cart_id, product_id, quantity, unit_price) 
-- VALUES (1, 1602, 10, 100.00);

-- 5. SYSTEM HEALTH CHECK
SELECT 'SYSTEM HEALTH CHECK' as stage, 
       COUNT(*) as total_products,
       SUM(CASE WHEN pa.stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
       SUM(CASE WHEN pa.stock > 0 AND p.availability = true THEN 1 ELSE 0 END) as available,
       SUM(CASE WHEN pa.stock = 0 AND p.availability = false THEN 1 ELSE 0 END) as correctly_unavailable
FROM product p JOIN product_attribute pa ON p.id = pa.product_id;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- INITIAL STATE: availability=true, stock=5
-- AFTER STOCK DEPLETION: availability=false, stock=0 (trigger worked!)
-- AFTER STOCK RESTORATION: availability=true, stock=3 (trigger worked!)
-- CART VALIDATION: Should fail if trying to add more than 3 items
-- SYSTEM HEALTH: All products should have consistent availability/stock
-- ============================================================================

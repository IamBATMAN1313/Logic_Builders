-- Script to add random stock amounts and discount percentages to products
-- This script will:
-- 1. Create product_attribute records with random stock (0-300) for all products
-- 2. Update all products with random discount percentages (5-15%) and enable discounts

BEGIN;

-- Show initial state
SELECT 'Initial State' as info;
SELECT COUNT(*) as total_products FROM product;
SELECT COUNT(*) as products_with_attributes FROM product_attribute;
SELECT COUNT(*) as products_with_discounts FROM product WHERE discount_status = true;

-- Create product_attribute records for all products with random stock
INSERT INTO product_attribute (product_id, cost, stock, units_sold)
SELECT 
    p.id as product_id,
    p.price as cost,  -- Use the product price as cost
    FLOOR(RANDOM() * 301)::integer as stock,  -- Random stock from 0 to 300
    0 as units_sold
FROM product p
WHERE NOT EXISTS (
    SELECT 1 FROM product_attribute pa WHERE pa.product_id = p.id
);

-- Update all products with random discount percentages (5-15%) and enable discounts
UPDATE product 
SET 
    discount_status = true,
    discount_percent = ROUND((RANDOM() * 10 + 5)::numeric, 2),  -- Random 5-15% with 2 decimal places
    updated_at = CURRENT_TIMESTAMP;

-- Show final state
SELECT 'Final State' as info;
SELECT COUNT(*) as total_products FROM product;
SELECT COUNT(*) as products_with_attributes FROM product_attribute;
SELECT COUNT(*) as products_with_discounts FROM product WHERE discount_status = true;

-- Show some sample data
SELECT 'Sample Product Data' as info;
SELECT 
    p.id,
    p.name,
    p.price,
    p.discount_status,
    p.discount_percent,
    pa.stock,
    pa.cost
FROM product p
JOIN product_attribute pa ON p.id = pa.product_id
ORDER BY p.id
LIMIT 10;

-- Show discount distribution
SELECT 'Discount Distribution' as info;
SELECT 
    FLOOR(discount_percent) as discount_range,
    COUNT(*) as product_count
FROM product 
WHERE discount_status = true
GROUP BY FLOOR(discount_percent)
ORDER BY discount_range;

-- Show stock distribution
SELECT 'Stock Distribution' as info;
SELECT 
    CASE 
        WHEN stock = 0 THEN '0 (Out of Stock)'
        WHEN stock BETWEEN 1 AND 50 THEN '1-50 (Low Stock)'
        WHEN stock BETWEEN 51 AND 150 THEN '51-150 (Medium Stock)'
        WHEN stock BETWEEN 151 AND 300 THEN '151-300 (High Stock)'
    END as stock_range,
    COUNT(*) as product_count
FROM product_attribute
GROUP BY 
    CASE 
        WHEN stock = 0 THEN '0 (Out of Stock)'
        WHEN stock BETWEEN 1 AND 50 THEN '1-50 (Low Stock)'
        WHEN stock BETWEEN 51 AND 150 THEN '51-150 (Medium Stock)'
        WHEN stock BETWEEN 151 AND 300 THEN '151-300 (High Stock)'
    END
ORDER BY MIN(stock);

COMMIT;

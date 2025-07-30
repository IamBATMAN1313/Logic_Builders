-- Test script to verify build functionality
-- Run this to check if builds and products are working correctly

\echo 'Testing build functionality...'
\echo ''

-- 1. Check build table structure
\echo '1. Build table structure:'
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'build' 
ORDER BY ordinal_position;

\echo ''
\echo '2. Check if build_product table exists:'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'build_product' 
ORDER BY ordinal_position;

\echo ''
\echo '3. Sample builds with images:'
SELECT id, name, image_url 
FROM build 
LIMIT 3;

\echo ''
\echo '4. Sample build_product relationships:'
SELECT bp.build_id, bp.product_id, bp.quantity, p.name as product_name, p.category_id
FROM build_product bp
JOIN product p ON bp.product_id = p.id
LIMIT 5;

\echo ''
\echo '5. Available product categories for builds:'
SELECT DISTINCT pc.name as category_name, COUNT(p.id) as product_count
FROM product_category pc
LEFT JOIN product p ON pc.id = p.category_id AND p.availability = true
WHERE pc.name IN ('CPU', 'Cpu', 'Motherboard', 'Memory', 'Internal Hard Drive', 'External Hard Drive', 'Video Card', 'Case', 'Cpu Cooler', 'Power Supply')
GROUP BY pc.name
ORDER BY pc.name;

\echo ''
\echo 'Build functionality test complete!'

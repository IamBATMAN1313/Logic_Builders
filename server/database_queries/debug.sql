-- Check product stock and availability status
SELECT p.name, p.availability, pa.stock, pa.units_sold
FROM product p 
JOIN product_attribute pa ON p.id = pa.product_id 
ORDER BY pa.stock ASC
LIMIT 10;

-- Check for products with 0 stock but availability = true (should be none)
SELECT p.name, p.availability, pa.stock
FROM product p 
JOIN product_attribute pa ON p.id = pa.product_id 
WHERE pa.stock = 0 AND p.availability = true;

-- Check for products with positive stock but availability = false (should investigate)
SELECT p.name, p.availability, pa.stock
FROM product p 
JOIN product_attribute pa ON p.id = pa.product_id 
WHERE pa.stock > 0 AND p.availability = false;

-- Check low stock products using the view
SELECT * FROM low_stock_products LIMIT 10;

-- Check cart items that might exceed stock
SELECT 
    ci.id, 
    ci.quantity, 
    p.name, 
    pa.stock,
    CASE 
        WHEN ci.quantity > pa.stock THEN 'OVER_STOCK'
        ELSE 'OK'
    END as status
FROM cart_item ci
JOIN product p ON ci.product_id = p.id
JOIN product_attribute pa ON p.id = pa.product_id
WHERE ci.product_id IS NOT NULL
ORDER BY ci.quantity DESC; 


select * from product where category_id=7;

-- Examine CPU specs for socket compatibility
SELECT name, specs->>'socket_/_cpu' as cpu_socket, specs->>'tdp' as tdp
FROM product 
WHERE category_id = 7 AND specs IS NOT NULL
LIMIT 10;

-- Examine Motherboard specs  
SELECT name, specs->>'socket_/_cpu' as mb_socket, specs->>'form_factor' as form_factor, 
       specs->>'max_ram' as max_ram, specs->>'ram_slots' as ram_slots
FROM product 
WHERE category_id = 16 AND specs IS NOT NULL
LIMIT 10;

-- Examine RAM specs
SELECT name, specs->>'type' as ram_type, specs->>'speed' as ram_speed, 
       specs->>'capacity' as capacity
FROM product 
WHERE category_id = 13 AND specs IS NOT NULL
LIMIT 10;

-- Examine GPU specs
SELECT name, specs->>'interface' as gpu_interface, specs->>'length' as length
FROM product 
WHERE category_id = 8 AND specs IS NOT NULL
LIMIT 10;

-- Examine PSU specs
SELECT name, specs->>'wattage' as wattage, specs->>'efficiency' as efficiency
FROM product 
WHERE category_id = 15 AND specs IS NOT NULL
LIMIT 10;

-- Examine Case specs
SELECT name, specs->>'type' as case_type, specs->>'form_factor_support' as form_factor_support
FROM product 
WHERE category_id = 12 AND specs IS NOT NULL
LIMIT 10;
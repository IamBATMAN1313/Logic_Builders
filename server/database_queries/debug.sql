
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
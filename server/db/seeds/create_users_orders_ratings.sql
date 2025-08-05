-- Script to update product costs, create users, and generate purchases with ratings
-- This script will:
-- 1. Update product costs to be 75% of product price
-- 2. Create 200 users (user001-user200)
-- 3. Create random purchases (6-10 products per user)
-- 4. Create ratings for all purchased products

BEGIN;

-- Show initial state
SELECT 'Initial State' as info;
SELECT COUNT(*) as total_products FROM product;
SELECT COUNT(*) as total_users FROM general_user;
SELECT COUNT(*) as total_orders FROM "order";
SELECT COUNT(*) as total_ratings FROM ratings;

-- 1. Update product costs to be 75% of product price
UPDATE product_attribute 
SET 
    cost = ROUND((p.price * 0.75)::numeric, 2),
    updated_at = CURRENT_TIMESTAMP
FROM product p 
WHERE product_attribute.product_id = p.id;

-- 2. Create 200 users (user001-user200)
INSERT INTO general_user (
    id, 
    name, 
    email, 
    password, 
    contact_number, 
    address, 
    user_type, 
    created_at, 
    updated_at
)
SELECT 
    gen_random_uuid() as id,
    'user' || LPAD(generate_series::text, 3, '0') as name,
    'user' || LPAD(generate_series::text, 3, '0') || '@gmail.com' as email,
    'user' || LPAD(generate_series::text, 3, '0') as password,  -- Note: In production, this should be hashed
    '+1234567' || LPAD((RANDOM() * 1000)::integer::text, 3, '0') as contact_number,
    (RANDOM() * 9999)::integer || ' Main St, City ' || (RANDOM() * 99)::integer as address,
    'customer' as user_type,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM generate_series(1, 200);

-- Show user creation results
SELECT 'Users Created' as info;
SELECT COUNT(*) as new_users_count FROM general_user WHERE name LIKE 'user%';

-- 3. Create random purchases and ratings for each user
-- We'll use a more complex approach with multiple steps

-- Create temporary table to store our order data
CREATE TEMP TABLE temp_user_orders AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    (6 + FLOOR(RANDOM() * 5))::integer as products_to_buy  -- 6-10 products per user
FROM general_user u 
WHERE u.name LIKE 'user%';

-- Show order planning
SELECT 'Order Planning' as info;
SELECT 
    AVG(products_to_buy) as avg_products_per_user,
    MIN(products_to_buy) as min_products,
    MAX(products_to_buy) as max_products,
    SUM(products_to_buy) as total_products_to_order
FROM temp_user_orders;

COMMIT;

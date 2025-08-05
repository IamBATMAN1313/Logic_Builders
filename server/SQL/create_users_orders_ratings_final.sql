-- Script to update product costs, create users, and generate purchases with ratings
-- This script will:
-- 1. Update product costs to be 75% of product price
-- 2. Create 200 users with customers and shipping addresses
-- 3. Create random purchases (6-10 products per user)
-- 4. Create ratings for all purchased products

BEGIN;

-- Show initial state
SELECT 'Initial State' as info;
SELECT COUNT(*) as total_products FROM product;
SELECT COUNT(*) as total_users FROM general_user;
SELECT COUNT(*) as total_customers FROM customer;
SELECT COUNT(*) as total_orders FROM "order";
SELECT COUNT(*) as total_ratings FROM ratings;

-- Step 1: Update product costs to be 75% of product price
UPDATE product_attribute 
SET 
    cost = ROUND((p.price * 0.75)::numeric, 2),
    updated_at = CURRENT_TIMESTAMP
FROM product p 
WHERE product_attribute.product_id = p.id;

-- Step 2: Create 200 users with customers and shipping addresses
DO $$
DECLARE
    i INTEGER;
    user_name TEXT;
    user_email TEXT;
    new_user_id UUID;
    new_customer_id UUID;
    new_shipping_id INTEGER;
BEGIN
    FOR i IN 1..200 LOOP
        user_name := 'user' || LPAD(i::TEXT, 3, '0');
        user_email := user_name || '@gmail.com';
        
        -- Insert into general_user
        INSERT INTO general_user (username, email, password_hash, full_name, contact_no, profile_img)
        VALUES (
            user_name,
            user_email,
            user_name,  -- password equals their name (should be hashed in production)
            user_name,  -- full_name same as username
            '+12345' || LPAD(i::TEXT, 5, '0'),  -- unique phone number
            NULL  -- no profile picture
        ) RETURNING id INTO new_user_id;
        
        -- Insert into customer
        INSERT INTO customer (user_id, points)
        VALUES (new_user_id, 0)
        RETURNING id INTO new_customer_id;
        
        -- Insert shipping address for each customer
        INSERT INTO shipping_address (customer_id, address, city, zip_code, country)
        VALUES (
            new_customer_id,
            i || ' Main Street',
            'City' || i,
            LPAD(i::TEXT, 5, '0'),
            'USA'
        ) RETURNING id INTO new_shipping_id;
        
    END LOOP;
END $$;

-- Show user creation results
SELECT 'Users Created' as info;
SELECT COUNT(*) as new_users FROM general_user;
SELECT COUNT(*) as new_customers FROM customer;
SELECT COUNT(*) as shipping_addresses FROM shipping_address;

-- Step 3: Create random orders for each customer
DO $$
DECLARE
    customer_rec RECORD;
    order_count INTEGER;
    new_order_id INTEGER;
    new_order_item_id INTEGER;
    shipping_addr_id INTEGER;
    random_quantity INTEGER;
    random_delivery_cost DECIMAL;
    order_total DECIMAL;
    product_total DECIMAL;
    j INTEGER;
    product_ids INTEGER[];
    user_id_for_customer UUID;
    random_product_id INTEGER;
    product_id INTEGER;
    product_price DECIMAL;
    product_stock INTEGER;
BEGIN
    -- Get all product IDs for random selection (only products with stock > 0)
    SELECT ARRAY(
        SELECT p.id 
        FROM product p 
        JOIN product_attribute pa ON p.id = pa.product_id 
        WHERE p.price IS NOT NULL 
        AND p.price > 0 
        AND pa.stock > 0
        ORDER BY RANDOM()
    ) INTO product_ids;
    
    -- Ensure we have products
    IF array_length(product_ids, 1) IS NULL OR array_length(product_ids, 1) = 0 THEN
        RAISE EXCEPTION 'No valid products found';
    END IF;
    
    -- For each customer
    FOR customer_rec IN SELECT id, user_id FROM customer LOOP
        -- Get their shipping address
        SELECT id INTO shipping_addr_id 
        FROM shipping_address 
        WHERE customer_id = customer_rec.id 
        LIMIT 1;
        
        -- Skip if no shipping address
        IF shipping_addr_id IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Each customer buys 6-10 products (creating separate orders for each)
        order_count := 6 + (RANDOM() * 5)::INTEGER;
        
        FOR j IN 1..order_count LOOP
            -- Random quantity first (1-3)
            random_quantity := 1 + (RANDOM() * 2)::INTEGER;
            
            -- Select a random product ID
            random_product_id := product_ids[(RANDOM() * array_length(product_ids, 1))::INTEGER + 1];
            
            -- Get product details with stock check
            SELECT p.id, p.price, pa.stock INTO product_id, product_price, product_stock
            FROM product p
            JOIN product_attribute pa ON p.id = pa.product_id
            WHERE p.id = random_product_id
            AND pa.stock >= random_quantity;
            
            -- Skip if no valid product found or insufficient stock
            IF product_id IS NULL OR product_price IS NULL OR product_price <= 0 OR product_stock < random_quantity THEN
                CONTINUE;
            END IF;
            
            -- Random delivery cost (5-20)
            random_delivery_cost := 5 + (RANDOM() * 15)::DECIMAL;
            
            -- Calculate product total
            product_total := product_price * random_quantity;
            
            -- Calculate order total
            order_total := product_total + random_delivery_cost;
            
            -- Create order
            INSERT INTO "order" (
                customer_id,
                shipping_address_id,
                total_price,
                delivery_charge,
                status,
                payment_method,
                payment_status
            ) VALUES (
                customer_rec.id,
                shipping_addr_id,
                order_total,
                random_delivery_cost,
                'delivered',  -- All orders are delivered so they can be rated
                'credit_card',
                true  -- payment_status is boolean
            ) RETURNING id INTO new_order_id;
            
            -- Create order item
            INSERT INTO order_item (
                order_id,
                product_id,
                quantity,
                unit_price,
                total_price
            ) VALUES (
                new_order_id,
                product_id,
                random_quantity,
                product_price,
                product_total
            ) RETURNING id INTO new_order_item_id;
            
            -- Create a rating for this product
            INSERT INTO ratings (
                user_id,
                product_id,
                rating,
                review_text,
                order_id,
                order_item_id
            ) VALUES (
                customer_rec.user_id,
                product_id,
                1 + (RANDOM() * 9)::INTEGER,  -- Random rating 1-10
                'Great product! Would recommend.',
                new_order_id,
                new_order_item_id
            );
            
        END LOOP;
    END LOOP;
END $$;

-- Show final results
SELECT 'Final Results' as info;
SELECT COUNT(*) as total_orders FROM "order";
SELECT COUNT(*) as total_order_items FROM order_item;
SELECT COUNT(*) as total_ratings FROM ratings;

-- Show rating distribution
SELECT 
    rating,
    COUNT(*) as count,
    ROUND(COUNT(*)::DECIMAL / (SELECT COUNT(*) FROM ratings) * 100, 2) as percentage
FROM ratings 
GROUP BY rating 
ORDER BY rating;

COMMIT;

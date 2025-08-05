-- ========================================================================
-- LogicBuilders E-commerce Database Schema
-- ========================================================================
-- 
-- This file contains the complete database structure for LogicBuilders
-- Run this script to create all tables, views, functions, and triggers
--
-- Requirements: PostgreSQL 12+, uuid-ossp extension
-- ========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Set proper configuration
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ========================================================================
-- SECTION 1: CORE FUNCTIONS & TRIGGERS
-- ========================================================================

-- Function to handle points awarding for orders
CREATE OR REPLACE FUNCTION public.award_points_for_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    customer_uuid UUID;
    customer_user_id UUID;
    points_to_award INTEGER;
BEGIN
    customer_uuid := NEW.customer_id;
    
    SELECT c.user_id INTO customer_user_id
    FROM customer c
    WHERE c.id = customer_uuid;

    IF customer_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    points_to_award := FLOOR(NEW.total_amount / 100);
    
    IF points_to_award > 0 THEN
        INSERT INTO customer_points (customer_id, points_balance, total_earned)
        VALUES (customer_uuid, points_to_award, points_to_award)
        ON CONFLICT (customer_id) 
        DO UPDATE SET 
            points_balance = customer_points.points_balance + points_to_award,
            total_earned = customer_points.total_earned + points_to_award,
            updated_at = CURRENT_TIMESTAMP;

        INSERT INTO points_transaction (
            customer_id, transaction_type, points_amount, 
            description, related_order_id
        ) VALUES (
            customer_uuid, 'EARNED', points_to_award, 
            'Points earned from order #' || NEW.id, NEW.id
        );

        INSERT INTO notification (
            user_id, type, title, message, 
            related_id, is_read, created_at
        ) VALUES (
            customer_user_id, 'POINTS_EARNED', 'Points Earned!',
            'You earned ' || points_to_award || ' points from your recent order.',
            NEW.id, FALSE, CURRENT_TIMESTAMP
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Additional functions will be loaded from the main schema.sql
-- This is a simplified version for documentation purposes

-- ========================================================================
-- SECTION 2: USER MANAGEMENT TABLES
-- ========================================================================

-- Core user table
CREATE TABLE IF NOT EXISTS public.general_user (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    contact_no VARCHAR(20),
    full_name VARCHAR(255),
    gender VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer profile extension
CREATE TABLE IF NOT EXISTS public.customer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES general_user(id) ON DELETE CASCADE,
    shipping_preferences JSONB,
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users
CREATE TABLE IF NOT EXISTS public.admin (
    admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    clearance_level INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ========================================================================
-- SECTION 3: PRODUCT MANAGEMENT
-- ========================================================================

-- Product categories
CREATE TABLE IF NOT EXISTS public.product_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS public.product (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    category_id INTEGER REFERENCES product_category(id),
    availability BOOLEAN DEFAULT TRUE,
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url VARCHAR(500),
    specs JSONB,
    clearance_level DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- SECTION 4: E-COMMERCE CORE
-- ========================================================================

-- Shopping carts
CREATE TABLE IF NOT EXISTS public.cart (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT unique_customer_cart UNIQUE (customer_id)
);

-- Cart items
CREATE TABLE IF NOT EXISTS public.cart_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID REFERENCES cart(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES product(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_time DECIMAL(10,2) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS public."order" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customer(id),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'PENDING',
    shipping_address_id UUID,
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Order items
CREATE TABLE IF NOT EXISTS public.order_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES "order"(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES product(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- SECTION 5: PC BUILD SYSTEM
-- ========================================================================

-- PC builds
CREATE TABLE IF NOT EXISTS public.build (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500) DEFAULT '/pcbuild.jpg',
    is_public BOOLEAN DEFAULT FALSE,
    is_complete BOOLEAN DEFAULT FALSE,
    total_price DECIMAL(10,2) DEFAULT 0.00,
    compatibility_score INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Build components
CREATE TABLE IF NOT EXISTS public.build_product (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    build_id INTEGER REFERENCES build(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES product(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    price_at_time DECIMAL(10,2),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_build_product UNIQUE (build_id, product_id)
);

-- Component compatibility rules
CREATE TABLE IF NOT EXISTS public.compatibility_rules (
    id SERIAL PRIMARY KEY,
    primary_category_id INTEGER REFERENCES product_category(id),
    compatible_category_id INTEGER REFERENCES product_category(id),
    rule_type VARCHAR(50) NOT NULL, -- 'REQUIRED', 'COMPATIBLE', 'INCOMPATIBLE'
    rule_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- SECTION 6: COMMUNICATION SYSTEM
-- ========================================================================

-- Notifications
CREATE TABLE IF NOT EXISTS public.notification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES general_user(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Customer support conversations
CREATE TABLE IF NOT EXISTS public.conversation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS public.conversation_participant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversation(id) ON DELETE CASCADE,
    user_id UUID REFERENCES general_user(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES admin(admin_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'CUSTOMER', 'ADMIN'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_participant_type CHECK (
        (user_id IS NOT NULL AND admin_id IS NULL) OR 
        (user_id IS NULL AND admin_id IS NOT NULL)
    )
);

-- Messages
CREATE TABLE IF NOT EXISTS public.message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversation(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES general_user(id) ON DELETE CASCADE,
    sender_admin_id UUID REFERENCES admin(admin_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'TEXT',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_sender_type CHECK (
        (sender_user_id IS NOT NULL AND sender_admin_id IS NULL) OR 
        (sender_user_id IS NULL AND sender_admin_id IS NOT NULL)
    )
);

-- ========================================================================
-- SECTION 7: CUSTOMER ENGAGEMENT
-- ========================================================================

-- Customer points system
CREATE TABLE IF NOT EXISTS public.customer_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID UNIQUE REFERENCES customer(id) ON DELETE CASCADE,
    points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
    total_earned INTEGER DEFAULT 0,
    total_redeemed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Points transaction history
CREATE TABLE IF NOT EXISTS public.points_transaction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- 'EARNED', 'REDEEMED'
    points_amount INTEGER NOT NULL,
    description TEXT,
    related_order_id UUID,
    related_voucher_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product ratings and reviews
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES product(id) ON DELETE CASCADE,
    order_id UUID REFERENCES "order"(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_customer_product_order UNIQUE (customer_id, product_id, order_id)
);

-- Product Q&A
CREATE TABLE IF NOT EXISTS public.product_qa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id INTEGER REFERENCES product(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    is_answered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Q&A Answers
CREATE TABLE IF NOT EXISTS public.qa_answer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES product_qa(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES admin(admin_id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    is_helpful BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- SECTION 8: PROMOTIONS & DISCOUNTS
-- ========================================================================

-- Vouchers
CREATE TABLE IF NOT EXISTS public.voucher (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'PERCENTAGE', 'FIXED_AMOUNT'
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount_amount DECIMAL(10,2),
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promotions
CREATE TABLE IF NOT EXISTS public.promotion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    promotion_type VARCHAR(50) NOT NULL,
    discount_percentage DECIMAL(5,2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    fixed_discount_amount DECIMAL(10,2) CHECK (fixed_discount_amount >= 0),
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    max_discount_amount DECIMAL(10,2),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_date_range CHECK (end_date > start_date),
    CONSTRAINT valid_discount CHECK (
        (promotion_type = 'PERCENTAGE' AND discount_percentage IS NOT NULL) OR
        (promotion_type = 'FIXED_AMOUNT' AND fixed_discount_amount IS NOT NULL)
    )
);

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupon (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promotion_id UUID REFERENCES promotion(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    order_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- SECTION 9: ADMIN & LOGGING
-- ========================================================================

-- Access levels for admin roles
CREATE TABLE IF NOT EXISTS public.access_levels (
    access_level INTEGER PRIMARY KEY,
    access_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin activity logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin(admin_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin notifications
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin(admin_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Admin signup requests
CREATE TABLE IF NOT EXISTS public.admin_signup_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    department VARCHAR(100),
    requested_clearance INTEGER DEFAULT 8,
    justification TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES admin(admin_id),
    reviewed_at TIMESTAMP
);

-- ========================================================================
-- SECTION 10: SHIPPING & ADDRESSES
-- ========================================================================

-- Shipping addresses
CREATE TABLE IF NOT EXISTS public.shipping_address (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'Bangladesh',
    phone_number VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- SECTION 11: VIEWS FOR OPTIMIZED QUERIES
-- ========================================================================

-- Active notifications view
CREATE OR REPLACE VIEW public.active_notifications AS
SELECT 
    n.id,
    n.user_id,
    u.username,
    u.email,
    n.type,
    n.title,
    n.message,
    n.related_id,
    n.is_read,
    n.created_at,
    n.read_at
FROM notification n
JOIN general_user u ON n.user_id = u.id
WHERE n.is_read = FALSE
ORDER BY n.created_at DESC;

-- Product ratings summary view
CREATE OR REPLACE VIEW public.product_ratings_summary AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    COUNT(r.id) as total_ratings,
    ROUND(AVG(r.rating::NUMERIC), 2) as average_rating,
    COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
    COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_star_count,
    COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_star_count,
    COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_star_count,
    COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star_count
FROM product p
LEFT JOIN ratings r ON p.id = r.product_id
GROUP BY p.id, p.name;

-- Low stock products view
CREATE OR REPLACE VIEW public.low_stock_products AS
SELECT 
    p.id,
    p.name,
    p.stock_quantity,
    pc.name as category_name,
    p.price,
    p.availability
FROM product p
JOIN product_category pc ON p.category_id = pc.id
WHERE p.stock_quantity <= 10 
AND p.availability = TRUE
ORDER BY p.stock_quantity ASC;

-- Admin Q&A management view
CREATE OR REPLACE VIEW public.admin_qa_management AS
SELECT 
    pqa.id as question_id,
    pqa.question,
    pqa.created_at as question_date,
    p.name as product_name,
    u.username as customer_username,
    COALESCE(qa.answer, 'No answer yet') as answer,
    qa.created_at as answer_date,
    CASE WHEN qa.id IS NULL THEN FALSE ELSE TRUE END as is_answered
FROM product_qa pqa
JOIN product p ON pqa.product_id = p.id
JOIN customer c ON pqa.customer_id = c.id
JOIN general_user u ON c.user_id = u.id
LEFT JOIN qa_answer qa ON pqa.id = qa.question_id
ORDER BY pqa.created_at DESC;

-- ========================================================================
-- SECTION 12: INDEXES FOR PERFORMANCE
-- ========================================================================

-- User management indexes
CREATE INDEX IF NOT EXISTS idx_general_user_email ON general_user(email);
CREATE INDEX IF NOT EXISTS idx_general_user_username ON general_user(username);
CREATE INDEX IF NOT EXISTS idx_customer_user_id ON customer(user_id);

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_product_category_id ON product(category_id);
CREATE INDEX IF NOT EXISTS idx_product_availability ON product(availability);
CREATE INDEX IF NOT EXISTS idx_product_price ON product(price);
CREATE INDEX IF NOT EXISTS idx_product_stock ON product(stock_quantity);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_order_customer_id ON "order"(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON "order"(status);
CREATE INDEX IF NOT EXISTS idx_order_created_at ON "order"(created_at);
CREATE INDEX IF NOT EXISTS idx_order_item_order_id ON order_item(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_product_id ON order_item(product_id);

-- Cart indexes
CREATE INDEX IF NOT EXISTS idx_cart_customer_id ON cart(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_cart_id ON cart_item(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_product_id ON cart_item(product_id);

-- Build indexes
CREATE INDEX IF NOT EXISTS idx_build_customer_id ON build(customer_id);
CREATE INDEX IF NOT EXISTS idx_build_product_build_id ON build_product(build_id);
CREATE INDEX IF NOT EXISTS idx_build_product_product_id ON build_product(product_id);

-- Rating indexes
CREATE INDEX IF NOT EXISTS idx_ratings_product_id ON ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_ratings_customer_id ON ratings(customer_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(rating);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notification(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_is_read ON notification(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at);

-- ========================================================================
-- SECTION 13: INITIAL DATA SETUP
-- ========================================================================

-- Insert default access levels
INSERT INTO access_levels (access_level, access_name, description) VALUES
(0, 'GENERAL_MANAGER', 'Full system access'),
(1, 'PRODUCT_DIRECTOR', 'Product and inventory oversight'),
(2, 'INVENTORY_MANAGER', 'Inventory management'),
(3, 'PRODUCT_MANAGER', 'Product catalog management'),
(4, 'ORDER_MANAGER', 'Order processing and fulfillment'),
(5, 'PROMO_MANAGER', 'Promotions and marketing'),
(6, 'ANALYTICS', 'Reports and analytics access'),
(7, 'INVENTORY_SPECIALIST', 'Inventory updates and tracking'),
(8, 'DELIVERY_COORDINATOR', 'Shipping and delivery coordination')
ON CONFLICT (access_level) DO NOTHING;

-- Insert default product categories
INSERT INTO product_category (name, description) VALUES
('Cpu', 'Central Processing Units'),
('Memory', 'RAM and system memory'),
('Motherboard', 'Main system boards'),
('Video Card', 'Graphics processing units'),
('External Hard Drive', 'External storage devices'),
('Case', 'Computer cases and enclosures'),
('Power Supply', 'Power supply units'),
('Cpu Cooler', 'CPU cooling solutions'),
('Case Fan', 'System cooling fans'),
('Monitor', 'Display devices'),
('Keyboard', 'Input devices - keyboards'),
('Mouse', 'Input devices - mice'),
('Headphones', 'Audio devices'),
('Speakers', 'Audio output devices')
ON CONFLICT (name) DO NOTHING;

-- ========================================================================
-- END OF SCHEMA
-- ========================================================================

-- Verification queries
SELECT 'Database schema installation completed successfully!' as status;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT COUNT(*) as total_views FROM information_schema.views WHERE table_schema = 'public';
SELECT COUNT(*) as total_functions FROM information_schema.routines WHERE routine_schema = 'public';

-- Display final message
SELECT 'LogicBuilders database is ready for use!' as message;

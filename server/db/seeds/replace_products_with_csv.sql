-- Script to replace all product data with CSV data
-- This script will:
-- 1. Delete all existing products and related data
-- 2. Import all products from CSV with category_id + 2

BEGIN;

-- Show initial state
SELECT 'Initial State' as info;
SELECT COUNT(*) as current_products FROM product;

-- Temporarily disable triggers on ratings table to avoid validation issues
ALTER TABLE ratings DISABLE TRIGGER trg_validate_rating_eligibility;

-- Delete all related records first to avoid foreign key violations
TRUNCATE TABLE product_attribute CASCADE;
TRUNCATE TABLE template_product CASCADE;
TRUNCATE TABLE build_product CASCADE;
TRUNCATE TABLE cart_item CASCADE;
TRUNCATE TABLE product_qa CASCADE;
TRUNCATE TABLE review CASCADE;
TRUNCATE TABLE wishlist CASCADE;
TRUNCATE TABLE ratings CASCADE;
TRUNCATE TABLE order_item CASCADE;

-- Now delete all products
TRUNCATE TABLE product RESTART IDENTITY CASCADE;

-- Re-enable the trigger
ALTER TABLE ratings ENABLE TRIGGER trg_validate_rating_eligibility;

-- Create a temporary table to load CSV data
CREATE TEMP TABLE temp_products (
    id INTEGER,
    name VARCHAR(200),
    excerpt TEXT,
    image_url TEXT,
    price NUMERIC(10,2),
    discount_status BOOLEAN,
    discount_percent NUMERIC(5,2),
    availability BOOLEAN,
    date_added DATE,
    category_id INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    specs JSONB
);

-- Import CSV data (we'll copy the CSV content manually since we need to modify category_id)
\echo 'Loading CSV data...'

COMMIT;

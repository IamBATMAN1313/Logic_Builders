-- Safer script to delete products without images and cleanup related data
-- This approach handles constraints more carefully

BEGIN;

-- Show initial counts
SELECT 'Initial Counts' as info;
SELECT COUNT(*) as total_products FROM product;
SELECT COUNT(*) as products_without_images FROM product WHERE image_url IS NULL;
SELECT COUNT(*) as total_categories FROM product_category;

-- Get product IDs that don't have images (for deletion)
CREATE TEMP TABLE products_to_delete AS 
SELECT id FROM product WHERE image_url IS NULL;

SELECT COUNT(*) as products_to_delete FROM products_to_delete;

-- Temporarily disable triggers on ratings table to avoid validation issues
ALTER TABLE ratings DISABLE TRIGGER trg_validate_rating_eligibility;

-- Delete related records first to avoid foreign key violations

-- 1. Delete from product_attribute
DELETE FROM product_attribute 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 2. Delete from template_product
DELETE FROM template_product 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 3. Delete from build_product
DELETE FROM build_product 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 4. Delete from cart_item
DELETE FROM cart_item 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 5. Delete from product_qa
DELETE FROM product_qa 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 6. Delete from review
DELETE FROM review 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 7. Delete from wishlist
DELETE FROM wishlist 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 8. Delete from ratings (directly without triggering validation)
DELETE FROM ratings 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- 9. Delete from order_item
DELETE FROM order_item 
WHERE product_id IN (SELECT id FROM products_to_delete);

-- Re-enable the trigger
ALTER TABLE ratings ENABLE TRIGGER trg_validate_rating_eligibility;

-- Now delete the products without images
DELETE FROM product WHERE image_url IS NULL;

-- Find categories that no longer have any products
CREATE TEMP TABLE categories_to_delete AS
SELECT pc.id, pc.name 
FROM product_category pc
LEFT JOIN product p ON pc.id = p.category_id
WHERE p.id IS NULL;

SELECT 'Categories to delete:' as info;
SELECT * FROM categories_to_delete;

-- Delete empty categories
DELETE FROM product_category 
WHERE id IN (SELECT id FROM categories_to_delete);

-- Show final counts
SELECT 'Final Counts' as info;
SELECT COUNT(*) as remaining_products FROM product;
SELECT COUNT(*) as remaining_categories FROM product_category;
SELECT COUNT(*) as products_with_images FROM product WHERE image_url IS NOT NULL;

COMMIT;

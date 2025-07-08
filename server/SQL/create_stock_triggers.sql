-- Stock Management Triggers and Functions
-- This script creates triggers to automatically manage product availability based on stock levels

-- Function to update product availability based on stock
CREATE OR REPLACE FUNCTION update_product_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- When stock goes to 0, set availability to false
    -- When stock goes from 0 to positive, set availability to true
    
    IF TG_OP = 'UPDATE' THEN
        -- Check if stock changed from positive to 0
        IF OLD.stock > 0 AND NEW.stock = 0 THEN
            UPDATE product 
            SET availability = false 
            WHERE id = NEW.product_id;
        END IF;
        
        -- Check if stock changed from 0 to positive
        IF OLD.stock = 0 AND NEW.stock > 0 THEN
            UPDATE product 
            SET availability = true 
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
        -- Set availability based on initial stock
        IF NEW.stock = 0 THEN
            UPDATE product 
            SET availability = false 
            WHERE id = NEW.product_id;
        ELSE
            UPDATE product 
            SET availability = true 
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS stock_availability_trigger ON product_attribute;

-- Create trigger on product_attribute table
CREATE TRIGGER stock_availability_trigger
    AFTER INSERT OR UPDATE OF stock ON product_attribute
    FOR EACH ROW
    EXECUTE FUNCTION update_product_availability();

-- Function to check stock before adding to cart
CREATE OR REPLACE FUNCTION check_cart_stock()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
    current_cart_quantity INTEGER;
    total_quantity INTEGER;
BEGIN
    -- Get current stock for the product
    SELECT stock INTO current_stock
    FROM product_attribute
    WHERE product_id = NEW.product_id;
    
    -- Get current quantity in cart for this product and customer
    SELECT COALESCE(SUM(quantity), 0) INTO current_cart_quantity
    FROM cart_item ci
    JOIN cart c ON ci.cart_id = c.id
    WHERE c.customer_id = (
        SELECT customer_id 
        FROM cart 
        WHERE id = NEW.cart_id
    ) AND ci.product_id = NEW.product_id
    AND ci.id != COALESCE(NEW.id, -1); -- Exclude current item in case of update
    
    -- Calculate total quantity if this item is added/updated
    total_quantity := current_cart_quantity + NEW.quantity;
    
    -- Check if total quantity exceeds stock
    IF total_quantity > current_stock THEN
        RAISE EXCEPTION 'Cannot add % items to cart. Only % items available (% already in cart)', 
            NEW.quantity, current_stock, current_cart_quantity;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS cart_stock_check_trigger ON cart_item;

-- Create trigger to check stock before adding to cart
CREATE TRIGGER cart_stock_check_trigger
    BEFORE INSERT OR UPDATE OF quantity ON cart_item
    FOR EACH ROW
    EXECUTE FUNCTION check_cart_stock();

-- Function to handle stock when orders are placed or cancelled
CREATE OR REPLACE FUNCTION handle_order_stock()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Order is being placed, decrease stock
        FOR item IN 
            SELECT product_id, quantity 
            FROM order_item 
            WHERE order_id = NEW.id
        LOOP
            UPDATE product_attribute 
            SET stock = stock - item.quantity
            WHERE product_id = item.product_id;
            
            -- Check if stock went negative (shouldn't happen with cart check, but safety)
            UPDATE product_attribute 
            SET stock = 0 
            WHERE product_id = item.product_id AND stock < 0;
        END LOOP;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check if order status changed to cancelled
        IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
            -- Order is being cancelled, restore stock
            FOR item IN 
                SELECT product_id, quantity 
                FROM order_item 
                WHERE order_id = NEW.id
            LOOP
                UPDATE product_attribute 
                SET stock = stock + item.quantity
                WHERE product_id = item.product_id;
            END LOOP;
        ELSIF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
            -- Order is being uncancelled, decrease stock again
            FOR item IN 
                SELECT product_id, quantity 
                FROM order_item 
                WHERE order_id = NEW.id
            LOOP
                UPDATE product_attribute 
                SET stock = stock - item.quantity
                WHERE product_id = item.product_id;
                
                -- Check if stock went negative
                UPDATE product_attribute 
                SET stock = 0 
                WHERE product_id = item.product_id AND stock < 0;
            END LOOP;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS order_stock_trigger ON "order";

-- Create trigger to handle stock changes on order status changes
CREATE TRIGGER order_stock_trigger
    AFTER INSERT OR UPDATE OF status ON "order"
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_stock();

-- Function to check stock before order placement
CREATE OR REPLACE FUNCTION check_order_stock()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    -- Get current stock for the product
    SELECT stock INTO current_stock
    FROM product_attribute
    WHERE product_id = NEW.product_id;
    
    -- Check if quantity exceeds stock
    IF NEW.quantity > current_stock THEN
        RAISE EXCEPTION 'Cannot order % items. Only % items available in stock', 
            NEW.quantity, current_stock;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS order_item_stock_check_trigger ON order_item;

-- Create trigger to check stock before adding order items
CREATE TRIGGER order_item_stock_check_trigger
    BEFORE INSERT OR UPDATE OF quantity ON order_item
    FOR EACH ROW
    EXECUTE FUNCTION check_order_stock();

-- Create an index for better performance on stock queries
CREATE INDEX IF NOT EXISTS idx_product_attribute_stock ON product_attribute(stock);
CREATE INDEX IF NOT EXISTS idx_product_availability ON product(availability);

-- View to easily check products with low stock
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
    p.id,
    p.name,
    p.availability,
    pa.stock,
    pc.name as category
FROM product p
JOIN product_attribute pa ON p.id = pa.product_id
LEFT JOIN product_category pc ON p.category_id = pc.id
WHERE pa.stock <= 5
ORDER BY pa.stock ASC;

-- Function to manually sync all product availability with stock
CREATE OR REPLACE FUNCTION sync_all_product_availability()
RETURNS void AS $$
BEGIN
    -- Set availability to false for products with 0 stock
    UPDATE product 
    SET availability = false 
    WHERE id IN (
        SELECT product_id 
        FROM product_attribute 
        WHERE stock = 0
    );
    
    -- Set availability to true for products with positive stock
    UPDATE product 
    SET availability = true 
    WHERE id IN (
        SELECT product_id 
        FROM product_attribute 
        WHERE stock > 0
    );
    
    RAISE NOTICE 'Product availability synced with stock levels';
END;
$$ LANGUAGE plpgsql;

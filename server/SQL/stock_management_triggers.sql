-- Stock Management Triggers
-- These triggers automatically manage product availability based on stock levels

-- Function to update product availability based on stock
CREATE OR REPLACE FUNCTION update_product_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Update availability based on stock level
    IF NEW.stock > 0 THEN
        UPDATE product 
        SET availability = true 
        WHERE id = NEW.product_id;
    ELSE
        UPDATE product 
        SET availability = false 
        WHERE id = NEW.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for INSERT on product_attribute
DROP TRIGGER IF EXISTS trg_product_availability_insert ON product_attribute;
CREATE TRIGGER trg_product_availability_insert
    AFTER INSERT ON product_attribute
    FOR EACH ROW EXECUTE FUNCTION update_product_availability();

-- Trigger for UPDATE on product_attribute (when stock changes)
DROP TRIGGER IF EXISTS trg_product_availability_update ON product_attribute;
CREATE TRIGGER trg_product_availability_update
    AFTER UPDATE OF stock ON product_attribute
    FOR EACH ROW EXECUTE FUNCTION update_product_availability();

-- Function to validate and update stock when items are added to cart
CREATE OR REPLACE FUNCTION validate_stock_for_cart()
RETURNS TRIGGER AS $$
DECLARE
    available_stock INTEGER;
    product_available BOOLEAN;
BEGIN
    -- Only validate for product items, not builds
    IF NEW.product_id IS NOT NULL THEN
        -- Get current stock and availability
        SELECT pa.stock, p.availability 
        INTO available_stock, product_available
        FROM product_attribute pa
        JOIN product p ON pa.product_id = p.id
        WHERE pa.product_id = NEW.product_id;
        
        -- Check if product exists and has stock info
        IF available_stock IS NULL THEN
            RAISE EXCEPTION 'Product stock information not found for product ID %', NEW.product_id;
        END IF;
        
        -- Check if product is available
        IF NOT product_available THEN
            RAISE EXCEPTION 'Product is not available for purchase';
        END IF;
        
        -- Check if requested quantity is available
        IF NEW.quantity > available_stock THEN
            RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', available_stock, NEW.quantity;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate stock when adding to cart
DROP TRIGGER IF EXISTS trg_validate_cart_stock ON cart_item;
CREATE TRIGGER trg_validate_cart_stock
    BEFORE INSERT OR UPDATE ON cart_item
    FOR EACH ROW EXECUTE FUNCTION validate_stock_for_cart();

-- Function to update stock when order is placed
CREATE OR REPLACE FUNCTION update_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update stock for product items, not builds
    IF NEW.product_id IS NOT NULL THEN
        -- Decrease stock when order item is created
        UPDATE product_attribute 
        SET 
            stock = stock - NEW.quantity,
            units_sold = units_sold + NEW.quantity
        WHERE product_id = NEW.product_id;
        
        -- Check if update was successful
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Could not update stock for product ID %', NEW.product_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock when order is placed
DROP TRIGGER IF EXISTS trg_update_stock_on_order ON order_item;
CREATE TRIGGER trg_update_stock_on_order
    AFTER INSERT ON order_item
    FOR EACH ROW EXECUTE FUNCTION update_stock_on_order();

-- Function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION restore_stock_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
    -- Only restore stock for product items, not builds
    IF OLD.product_id IS NOT NULL THEN
        -- Increase stock when order item is deleted (order cancelled)
        UPDATE product_attribute 
        SET 
            stock = stock + OLD.quantity,
            units_sold = units_sold - OLD.quantity
        WHERE product_id = OLD.product_id;
        
        -- Ensure units_sold doesn't go negative
        UPDATE product_attribute 
        SET units_sold = GREATEST(0, units_sold)
        WHERE product_id = OLD.product_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to restore stock when order item is cancelled/deleted
DROP TRIGGER IF EXISTS trg_restore_stock_on_cancel ON order_item;
CREATE TRIGGER trg_restore_stock_on_cancel
    AFTER DELETE ON order_item
    FOR EACH ROW EXECUTE FUNCTION restore_stock_on_cancel();

-- Function to validate build stock when adding to order
CREATE OR REPLACE FUNCTION validate_build_stock()
RETURNS TRIGGER AS $$
DECLARE
    build_product RECORD;
    available_stock INTEGER;
BEGIN
    -- Only validate for build items
    IF NEW.build_id IS NOT NULL THEN
        -- Check stock for all products in the build
        FOR build_product IN 
            SELECT bp.product_id, bp.quantity * NEW.quantity as total_needed
            FROM build_product bp
            WHERE bp.build_id = NEW.build_id
        LOOP
            -- Get current stock
            SELECT stock INTO available_stock
            FROM product_attribute
            WHERE product_id = build_product.product_id;
            
            -- Check if sufficient stock is available
            IF available_stock < build_product.total_needed THEN
                RAISE EXCEPTION 'Insufficient stock for product % in build. Available: %, Needed: %', 
                    build_product.product_id, available_stock, build_product.total_needed;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate build stock before creating order item
DROP TRIGGER IF EXISTS trg_validate_build_stock ON order_item;
CREATE TRIGGER trg_validate_build_stock
    BEFORE INSERT ON order_item
    FOR EACH ROW EXECUTE FUNCTION validate_build_stock();

-- Function to update stock for build items
CREATE OR REPLACE FUNCTION update_build_stock()
RETURNS TRIGGER AS $$
DECLARE
    build_product RECORD;
BEGIN
    -- Only update stock for build items
    IF NEW.build_id IS NOT NULL THEN
        -- Update stock for all products in the build
        FOR build_product IN 
            SELECT bp.product_id, bp.quantity * NEW.quantity as total_used
            FROM build_product bp
            WHERE bp.build_id = NEW.build_id
        LOOP
            -- Decrease stock and increase units sold
            UPDATE product_attribute 
            SET 
                stock = stock - build_product.total_used,
                units_sold = units_sold + build_product.total_used
            WHERE product_id = build_product.product_id;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock for build items
DROP TRIGGER IF EXISTS trg_update_build_stock ON order_item;
CREATE TRIGGER trg_update_build_stock
    AFTER INSERT ON order_item
    FOR EACH ROW EXECUTE FUNCTION update_build_stock();

-- Function to restore build stock when cancelled
CREATE OR REPLACE FUNCTION restore_build_stock()
RETURNS TRIGGER AS $$
DECLARE
    build_product RECORD;
BEGIN
    -- Only restore stock for build items
    IF OLD.build_id IS NOT NULL THEN
        -- Restore stock for all products in the build
        FOR build_product IN 
            SELECT bp.product_id, bp.quantity * OLD.quantity as total_to_restore
            FROM build_product bp
            WHERE bp.build_id = OLD.build_id
        LOOP
            -- Increase stock and decrease units sold
            UPDATE product_attribute 
            SET 
                stock = stock + build_product.total_to_restore,
                units_sold = GREATEST(0, units_sold - build_product.total_to_restore)
            WHERE product_id = build_product.product_id;
        END LOOP;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to restore build stock when cancelled
DROP TRIGGER IF EXISTS trg_restore_build_stock ON order_item;
CREATE TRIGGER trg_restore_build_stock
    AFTER DELETE ON order_item
    FOR EACH ROW EXECUTE FUNCTION restore_build_stock();

-- Initialize availability for existing products based on current stock
UPDATE product 
SET availability = EXISTS (
    SELECT 1 FROM product_attribute pa 
    WHERE pa.product_id = product.id AND pa.stock > 0
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_attribute_stock ON product_attribute(stock);
CREATE INDEX IF NOT EXISTS idx_product_availability ON product(availability);

-- Display current stock status
SELECT 
    p.id,
    p.name,
    p.availability,
    pa.stock,
    pa.units_sold,
    CASE 
        WHEN pa.stock > 0 THEN 'In Stock'
        WHEN pa.stock = 0 THEN 'Out of Stock'
        ELSE 'No Stock Info'
    END as stock_status
FROM product p
LEFT JOIN product_attribute pa ON p.id = pa.product_id
ORDER BY p.id
LIMIT 10;

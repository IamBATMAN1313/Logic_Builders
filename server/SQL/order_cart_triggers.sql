-- Add missing columns to build table for better user experience
ALTER TABLE build 
ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Untitled Build',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0 CHECK (total_price >= 0),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'shared'));

-- Add missing specs column to product table if it doesn't exist
ALTER TABLE product 
ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::JSONB;

-- Create trigger to update build total_price when build_product changes
CREATE OR REPLACE FUNCTION update_build_total_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate total price for the build
    UPDATE build 
    SET total_price = (
        SELECT COALESCE(SUM(p.price * bp.quantity), 0)
        FROM build_product bp
        JOIN product p ON bp.product_id = p.id
        WHERE bp.build_id = COALESCE(NEW.build_id, OLD.build_id)
    )
    WHERE id = COALESCE(NEW.build_id, OLD.build_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for build_product table
DROP TRIGGER IF EXISTS trg_update_build_total_insert ON build_product;
CREATE TRIGGER trg_update_build_total_insert
    AFTER INSERT ON build_product
    FOR EACH ROW EXECUTE FUNCTION update_build_total_price();

DROP TRIGGER IF EXISTS trg_update_build_total_update ON build_product;
CREATE TRIGGER trg_update_build_total_update
    AFTER UPDATE ON build_product
    FOR EACH ROW EXECUTE FUNCTION update_build_total_price();

DROP TRIGGER IF EXISTS trg_update_build_total_delete ON build_product;
CREATE TRIGGER trg_update_build_total_delete
    AFTER DELETE ON build_product
    FOR EACH ROW EXECUTE FUNCTION update_build_total_price();

-- Create trigger to update cart_item unit_price when product price changes
CREATE OR REPLACE FUNCTION update_cart_item_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Update cart items when product price changes
    UPDATE cart_item 
    SET unit_price = NEW.price
    WHERE product_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_cart_item_price ON product;
CREATE TRIGGER trg_update_cart_item_price
    AFTER UPDATE OF price ON product
    FOR EACH ROW EXECUTE FUNCTION update_cart_item_price();

-- Create function to automatically create cart for new customers
CREATE OR REPLACE FUNCTION create_customer_cart()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO cart (customer_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_customer_cart ON customer;
CREATE TRIGGER trg_create_customer_cart
    AFTER INSERT ON customer
    FOR EACH ROW EXECUTE FUNCTION create_customer_cart();

-- Create function to calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total(order_id_param INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    order_total NUMERIC(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(total_price), 0)
    INTO order_total
    FROM order_item
    WHERE order_id = order_id_param;
    
    RETURN order_total;
END;
$$ LANGUAGE plpgsql;

-- Points and Vouchers System Tables

-- Table for tracking user points
CREATE TABLE IF NOT EXISTS user_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES general_user(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'earned', 'redemption', 'adjustment'
    description TEXT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for user vouchers/coupons
CREATE TABLE IF NOT EXISTS user_vouchers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES general_user(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed'
    discount_value DECIMAL(10,2) NOT NULL,
    minimum_amount DECIMAL(10,2) DEFAULT 0,
    expiry_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'used', 'expired'
    type VARCHAR(20) DEFAULT 'loyalty', -- 'loyalty', 'promotional', 'birthday'
    used_at TIMESTAMP NULL,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_created_at ON user_points(created_at);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_id ON user_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_code ON user_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_status ON user_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_expiry ON user_vouchers(expiry_date);

-- Function to automatically expire vouchers
CREATE OR REPLACE FUNCTION expire_vouchers()
RETURNS void AS $$
BEGIN
    UPDATE user_vouchers 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expiry_date < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to award points when an order is completed
CREATE OR REPLACE FUNCTION award_order_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Award 1 point for every dollar spent when order status changes to 'delivered'
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        INSERT INTO user_points (user_id, points, transaction_type, description, order_id)
        VALUES (
            NEW.user_id, 
            FLOOR(NEW.total_amount), 
            'earned', 
            'Points earned from order #' || NEW.id,
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order points (if orders table exists)
DROP TRIGGER IF EXISTS trigger_award_order_points ON orders;
CREATE TRIGGER trigger_award_order_points
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION award_order_points();

-- Insert some sample points for existing users (optional)
-- This gives each existing user some starting points for testing
INSERT INTO user_points (user_id, points, transaction_type, description)
SELECT id, 500, 'adjustment', 'Welcome bonus points'
FROM general_user
WHERE id NOT IN (SELECT DISTINCT user_id FROM user_points)
ON CONFLICT DO NOTHING;

-- Function to get user's total points
CREATE OR REPLACE FUNCTION get_user_points(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    total_points INTEGER;
BEGIN
    SELECT COALESCE(SUM(points), 0) INTO total_points
    FROM user_points 
    WHERE user_id = p_user_id;
    
    RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- Function to create a birthday voucher for users
CREATE OR REPLACE FUNCTION create_birthday_voucher(p_user_id INTEGER)
RETURNS void AS $$
DECLARE
    voucher_code VARCHAR(50);
BEGIN
    -- Generate unique birthday voucher code
    voucher_code := 'BIRTHDAY' || EXTRACT(YEAR FROM CURRENT_DATE) || '_' || p_user_id;
    
    -- Create birthday voucher (20% off, valid for 30 days)
    INSERT INTO user_vouchers (
        user_id, code, title, description, discount_type, discount_value,
        minimum_amount, expiry_date, status, type
    ) VALUES (
        p_user_id,
        voucher_code,
        'Happy Birthday! 20% OFF',
        'Special birthday discount - 20% off on any order above $30',
        'percentage',
        20,
        30.00,
        CURRENT_DATE + INTERVAL '30 days',
        'active',
        'birthday'
    )
    ON CONFLICT (code) DO NOTHING;
    
    -- Award birthday bonus points
    INSERT INTO user_points (user_id, points, transaction_type, description)
    VALUES (p_user_id, 200, 'earned', 'Birthday bonus points');
    
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_points IS 'Tracks user loyalty points earned and spent';
COMMENT ON TABLE user_vouchers IS 'Stores user vouchers and discount coupons';

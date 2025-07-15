-- Promotions Management Tables

-- Main promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'free_shipping')),
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INTEGER DEFAULT NULL, -- NULL means unlimited
    min_order_value DECIMAL(10,2) DEFAULT 0,
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES admin_users(admin_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Promotion usage tracking
CREATE TABLE IF NOT EXISTS promotion_usage (
    id SERIAL PRIMARY KEY,
    promotion_id INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
    order_id INTEGER, -- Would reference orders table
    user_id INTEGER, -- Would reference users table
    discount_amount DECIMAL(10,2) NOT NULL,
    order_value DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT NOW()
);

-- Sample data for promotions
INSERT INTO promotions (name, code, type, discount_value, max_uses, min_order_value, start_date, end_date, description, created_by) VALUES
('Winter Sale 2024', 'WINTER25', 'percentage', 25.00, 500, 50.00, '2024-01-01', '2024-02-29', 'Winter season discount', 1),
('New User Discount', 'NEWUSER20', 'fixed_amount', 20.00, NULL, 30.00, '2024-01-01', '2024-12-31', 'Discount for new customers', 1),
('Free Shipping Promo', 'FREESHIP', 'free_shipping', 100.00, NULL, 25.00, '2024-01-01', '2024-03-15', 'Free shipping on orders over $25', 1),
('Flash Sale', 'FLASH15', 'percentage', 15.00, 100, 0.00, '2024-01-15', '2024-01-20', 'Limited time flash sale', 1);

-- Sample usage data
INSERT INTO promotion_usage (promotion_id, order_id, user_id, discount_amount, order_value) VALUES
(1, 1001, 101, 12.50, 75.00),
(1, 1002, 102, 25.00, 125.00),
(2, 1003, 103, 20.00, 89.99),
(3, 1004, 104, 5.99, 45.99),
(1, 1005, 105, 15.75, 89.50);

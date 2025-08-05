-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admin_users(admin_id),
    type VARCHAR(50) NOT NULL, -- 'NEW_ADMIN_REQUEST', 'LOW_STOCK', 'STOCK_REFILLED'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255), -- Link to relevant page
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- Optional expiration
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_admin_unread ON notifications(admin_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Triggers for automatic notifications

-- 1. Trigger for new admin signup requests
CREATE OR REPLACE FUNCTION notify_new_admin_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify all GENERAL_MANAGER admins
    INSERT INTO notifications (admin_id, type, title, message, link)
    SELECT 
        au.admin_id,
        'NEW_ADMIN_REQUEST',
        'New Admin Access Request',
        'New admin access request from ' || NEW.name || ' (' || NEW.employee_id || ') for ' || NEW.requested_clearance || ' clearance.',
        '/admin-management'
    FROM admin_users au
    WHERE au.clearance_level = 'GENERAL_MANAGER';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_new_admin_request
    AFTER INSERT ON admin_signup_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_admin_request();

-- 2. Trigger for low stock notifications
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if stock is low (less than 10) and notify INVENTORY_MANAGER
    IF NEW.stock IS NOT NULL AND NEW.stock <= 10 AND (OLD.stock IS NULL OR OLD.stock > 10) THEN
        INSERT INTO notifications (admin_id, type, title, message, link)
        SELECT 
            au.admin_id,
            'LOW_STOCK',
            'Low Stock Alert',
            'Product "' || p.name || '" is running low on stock. Current stock: ' || NEW.stock,
            '/inventory'
        FROM admin_users au, product p
        WHERE au.clearance_level = 'INVENTORY_MANAGER' 
        AND p.id = NEW.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_low_stock
    AFTER UPDATE ON product_attribute
    FOR EACH ROW
    EXECUTE FUNCTION notify_low_stock();

-- 3. Trigger for stock refill notifications
CREATE OR REPLACE FUNCTION notify_stock_refilled()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if stock was increased significantly (by more than 50) and notify PRODUCT_EXPERT
    IF NEW.stock IS NOT NULL AND OLD.stock IS NOT NULL AND (NEW.stock - OLD.stock) >= 50 THEN
        INSERT INTO notifications (admin_id, type, title, message, link)
        SELECT 
            au.admin_id,
            'STOCK_REFILLED',
            'Stock Refilled',
            'Product "' || p.name || '" stock has been refilled. New stock: ' || NEW.stock || ' (increased by ' || (NEW.stock - OLD.stock) || ')',
            '/products'
        FROM admin_users au, product p
        WHERE au.clearance_level = 'PRODUCT_MANAGER' 
        AND p.id = NEW.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stock_refilled
    AFTER UPDATE ON product_attribute
    FOR EACH ROW
    EXECUTE FUNCTION notify_stock_refilled();

-- 4. Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id INTEGER, admin_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET is_read = TRUE 
    WHERE id = notification_id AND admin_id = admin_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to clean up old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    OR (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

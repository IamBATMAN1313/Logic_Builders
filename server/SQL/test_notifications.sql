-- Create a test notification for admin signup request
INSERT INTO admin_notifications (
    admin_id, 
    type, 
    title, 
    message, 
    created_at
) VALUES (
    1, 
    'NEW_ADMIN_REQUEST', 
    'New Admin Signup Request', 
    'A new admin signup request from Test Admin User requires your approval.', 
    NOW()
);

-- Create a low stock notification
INSERT INTO admin_notifications (
    admin_id, 
    type, 
    title, 
    message, 
    created_at
) VALUES (
    1, 
    'LOW_STOCK', 
    'Low Stock Alert', 
    'Product inventory is running low and needs immediate attention.', 
    NOW() - INTERVAL '5 minutes'
);

-- Check current notifications
SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 5;

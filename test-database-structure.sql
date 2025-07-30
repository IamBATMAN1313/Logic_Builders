-- Database diagnostic script for Points System
-- Run with: psql -U your_username -d your_database -f test-database-structure.sql

\echo '🔍 CHECKING POINTS SYSTEM DATABASE STRUCTURE'
\echo '============================================='

-- Check if points tables exist
\echo '📋 1. Checking if points tables exist...'
SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM pg_tables 
WHERE tablename IN ('customer_points', 'points_transaction', 'vouchers')
ORDER BY tablename;

\echo ''
\echo '📊 2. Checking customer_points table structure...'
\d customer_points

\echo ''
\echo '📋 3. Checking points_transaction table structure...'
\d points_transaction

\echo ''
\echo '🎫 4. Checking vouchers table structure...'
\d vouchers

\echo ''
\echo '📦 5. Checking order table structure (for trigger compatibility)...'
\d "order"

\echo ''
\echo '👥 6. Checking customer table structure...'
\d customer

\echo ''
\echo '🔧 7. Checking if triggers exist...'
SELECT 
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name LIKE '%points%' OR trigger_name LIKE '%voucher%'
ORDER BY trigger_name;

\echo ''
\echo '📊 8. Checking current points data...'
SELECT 
    cp.customer_id,
    cp.points_balance,
    cp.total_earned,
    cp.total_redeemed,
    gu.username,
    gu.email
FROM customer_points cp
JOIN customer c ON cp.customer_id = c.id
JOIN general_user gu ON c.user_id = gu.id
LIMIT 5;

\echo ''
\echo '📋 9. Checking points transactions...'
SELECT 
    pt.id,
    pt.customer_id,
    pt.transaction_type,
    pt.points,
    pt.description,
    pt.created_at,
    gu.username
FROM points_transaction pt
JOIN customer c ON pt.customer_id = c.id
JOIN general_user gu ON c.user_id = gu.id
ORDER BY pt.created_at DESC
LIMIT 5;

\echo ''
\echo '🎫 10. Checking vouchers...'
SELECT 
    v.id,
    v.customer_id,
    v.code,
    v.value,
    v.is_redeemed,
    v.created_at,
    gu.username
FROM vouchers v
JOIN customer c ON v.customer_id = c.id
JOIN general_user gu ON c.user_id = gu.id
ORDER BY v.created_at DESC
LIMIT 5;

\echo ''
\echo '📦 11. Checking recent orders (for trigger testing)...'
SELECT 
    o.id,
    o.customer_id,
    o.status,
    o.total_amount,
    o.order_date,
    gu.username
FROM "order" o
JOIN customer c ON o.customer_id = c.id
JOIN general_user gu ON c.user_id = gu.id
ORDER BY o.order_date DESC
LIMIT 5;

\echo ''
\echo '🔔 12. Checking points-related notifications...'
SELECT 
    n.id,
    n.user_id,
    n.notification_text,
    n.notification_type,
    n.created_at,
    gu.username
FROM notification n
JOIN general_user gu ON n.user_id = gu.id
WHERE n.notification_type IN ('points_earned', 'coupon_generated', 'voucher_redeemed')
ORDER BY n.created_at DESC
LIMIT 5;

\echo ''
\echo '🔧 13. Checking function definitions...'
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE proname LIKE '%points%' OR proname LIKE '%voucher%'
ORDER BY proname;

\echo ''
\echo '✅ DIAGNOSTIC COMPLETE!'
\echo 'Check the output above for any missing tables, triggers, or data issues.'

-- Fix for Points System Trigger Function
-- Run this to fix the points awarding trigger

-- Drop and recreate the corrected trigger function
DROP TRIGGER IF EXISTS trg_award_points_for_order ON public."order";
DROP FUNCTION IF EXISTS public.award_points_for_order();

-- Corrected function that properly handles order table structure
CREATE OR REPLACE FUNCTION public.award_points_for_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    customer_uuid UUID;
    customer_user_id UUID;
    points_to_award INTEGER;
BEGIN
    -- NEW.customer_id is already the customer UUID, not user_id
    customer_uuid := NEW.customer_id;
    
    -- Get the user_id for notifications
    SELECT c.user_id INTO customer_user_id
    FROM customer c
    WHERE c.id = customer_uuid;

    IF customer_uuid IS NOT NULL AND customer_user_id IS NOT NULL THEN
        -- Calculate points (1 point per dollar spent)
        points_to_award := FLOOR(NEW.total_amount);

        -- Insert or update customer points
        INSERT INTO customer_points (customer_id, points_balance, total_earned)
        VALUES (customer_uuid, points_to_award, points_to_award)
        ON CONFLICT (customer_id) 
        DO UPDATE SET 
            points_balance = customer_points.points_balance + points_to_award,
            total_earned = customer_points.total_earned + points_to_award,
            updated_at = CURRENT_TIMESTAMP;

        -- Record the transaction
        INSERT INTO points_transaction (
            customer_id, 
            transaction_type, 
            points, 
            order_id, 
            description
        ) VALUES (
            customer_uuid,
            'earned',
            points_to_award,
            NEW.id,
            'Points earned from order #' || NEW.id || ' - $' || NEW.total_amount
        );

        -- Create notification for points earned (use user_id for notifications)
        INSERT INTO notification (
            user_id,
            notification_text,
            notification_type,
            category,
            link,
            priority,
            data
        ) VALUES (
            customer_user_id,  -- Use user_id here, not customer_id
            '🎉 You earned ' || points_to_award || ' points from your recent order! Use them to get discount coupons.',
            'points_earned',
            'rewards',
            '/account/vouchers',
            'normal',
            jsonb_build_object(
                'points_earned', points_to_award,
                'order_id', NEW.id,
                'total_amount', NEW.total_amount,
                'points_rate', '1 point per $1 spent'
            )
        );
        
        -- Log successful points award
        RAISE NOTICE 'Points awarded: % points to customer % for order %', 
            points_to_award, customer_uuid, NEW.id;
    ELSE
        RAISE NOTICE 'Could not award points: customer_uuid=%, customer_user_id=%', 
            customer_uuid, customer_user_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trg_award_points_for_order 
    AFTER UPDATE OF status ON public."order"
    FOR EACH ROW 
    WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
    EXECUTE FUNCTION public.award_points_for_order();

-- Also fix the voucher redemption function for proper notifications
CREATE OR REPLACE FUNCTION public.redeem_voucher() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When a voucher is marked as redeemed, create a notification
    IF NEW.is_redeemed = true AND OLD.is_redeemed = false THEN
        INSERT INTO notification (
            user_id,
            notification_text,
            notification_type,
            category,
            link,
            priority,
            data
        ) VALUES (
            (SELECT c.user_id FROM customer c WHERE c.id = NEW.customer_id),
            '✅ Voucher ' || NEW.code || ' has been successfully applied to your order!',
            'voucher_redeemed',
            'orders',
            '/account/orders',
            'normal',
            jsonb_build_object(
                'voucher_code', NEW.code,
                'voucher_value', NEW.value,
                'discount_type', NEW.discount_type,
                'order_id', NEW.order_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Update trigger for voucher redemption
DROP TRIGGER IF EXISTS trg_redeem_voucher ON public.vouchers;
CREATE TRIGGER trg_redeem_voucher 
    AFTER UPDATE ON public.vouchers
    FOR EACH ROW 
    EXECUTE FUNCTION public.redeem_voucher();

-- Test the trigger by updating an existing order status
-- First, let's create a test function to verify everything works
CREATE OR REPLACE FUNCTION test_points_system() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    test_customer_id UUID;
    test_user_id UUID;
    test_order_id INTEGER;
    result_text TEXT := '';
BEGIN
    -- Get a test customer
    SELECT c.id, c.user_id INTO test_customer_id, test_user_id
    FROM customer c
    JOIN general_user gu ON c.user_id = gu.id
    LIMIT 1;
    
    IF test_customer_id IS NULL THEN
        RETURN 'No customers found for testing';
    END IF;
    
    result_text := result_text || 'Test customer: ' || test_customer_id || E'\n';
    
    -- Check if customer_points table is accessible
    BEGIN
        INSERT INTO customer_points (customer_id, points_balance, total_earned)
        VALUES (test_customer_id, 0, 0)
        ON CONFLICT (customer_id) DO NOTHING;
        
        result_text := result_text || 'Customer points table: OK' || E'\n';
    EXCEPTION
        WHEN OTHERS THEN
            result_text := result_text || 'Customer points table ERROR: ' || SQLERRM || E'\n';
    END;
    
    -- Check if we can find an order for this customer
    SELECT id INTO test_order_id
    FROM "order"
    WHERE customer_id = test_customer_id
    LIMIT 1;
    
    IF test_order_id IS NOT NULL THEN
        result_text := result_text || 'Found test order: ' || test_order_id || E'\n';
    ELSE
        result_text := result_text || 'No orders found for test customer' || E'\n';
    END IF;
    
    RETURN result_text;
END;
$$;

-- Run the test
SELECT test_points_system() as test_results;

-- Show current points status
SELECT 
    'Current Points Data' as info,
    COUNT(*) as customer_points_records
FROM customer_points;

SELECT 
    'Current Transactions Data' as info,
    COUNT(*) as transaction_records
FROM points_transaction;

SELECT 
    'Current Vouchers Data' as info,
    COUNT(*) as voucher_records
FROM vouchers;

\echo 'Points system trigger fixed! Test by updating order status to delivered.';

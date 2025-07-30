-- Complete Points System Setup and Fix Script
-- Run this with: psql -U your_username -d your_database -f complete-points-fix.sql

\echo '🔧 COMPLETE POINTS SYSTEM FIX'
\echo '================================'

-- Enable UUID extension (safe - will not error if exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

\echo '1. Creating/Fixing Points System Tables...'

-- Drop existing tables if they have issues (be careful in production!)
-- DROP TABLE IF EXISTS points_transaction CASCADE;
-- DROP TABLE IF EXISTS vouchers CASCADE;
-- DROP TABLE IF EXISTS customer_points CASCADE;

-- Customer Points Balance Table (recreate with proper constraints)
CREATE TABLE IF NOT EXISTS public.customer_points (
    id SERIAL PRIMARY KEY,
    customer_id uuid NOT NULL,
    points_balance integer DEFAULT 0 NOT NULL,
    total_earned integer DEFAULT 0 NOT NULL,
    total_redeemed integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT customer_points_customer_id_unique UNIQUE (customer_id),
    CONSTRAINT customer_points_balance_check CHECK ((points_balance >= 0))
);

-- Points Transaction History Table
CREATE TABLE IF NOT EXISTS public.points_transaction (
    id SERIAL PRIMARY KEY,
    customer_id uuid NOT NULL,
    transaction_type character varying(20) NOT NULL,
    points integer NOT NULL,
    order_id integer,
    voucher_id integer,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT points_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['earned'::character varying, 'redeemed'::character varying, 'expired'::character varying, 'bonus'::character varying])::text[])))
);

-- Vouchers/Coupons Table
CREATE TABLE IF NOT EXISTS public.vouchers (
    id SERIAL PRIMARY KEY,
    customer_id uuid NOT NULL,
    code character varying(50) NOT NULL UNIQUE,
    type character varying(20) DEFAULT 'discount'::character varying NOT NULL,
    value numeric(10,2) NOT NULL,
    discount_type character varying(20) DEFAULT 'percentage'::character varying NOT NULL,
    min_order_amount numeric(10,2) DEFAULT 0,
    max_discount_amount numeric(10,2),
    is_redeemed boolean DEFAULT false NOT NULL,
    redeemed_at timestamp without time zone,
    order_id integer,
    points_used integer,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT vouchers_type_check CHECK (((type)::text = ANY ((ARRAY['discount'::character varying, 'free_shipping'::character varying, 'cashback'::character varying])::text[]))),
    CONSTRAINT vouchers_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying])::text[])))
);

\echo '2. Adding Foreign Key Constraints...'

-- Add foreign keys safely
DO $$
BEGIN
    -- Add FK constraints only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'customer_points_customer_id_fkey') THEN
        ALTER TABLE public.customer_points ADD CONSTRAINT customer_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'points_transaction_customer_id_fkey') THEN
        ALTER TABLE public.points_transaction ADD CONSTRAINT points_transaction_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vouchers_customer_id_fkey') THEN
        ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;
    END IF;

    -- Check if order table exists before adding FK
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'points_transaction_order_id_fkey') THEN
            ALTER TABLE public.points_transaction ADD CONSTRAINT points_transaction_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vouchers_order_id_fkey') THEN
            ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'points_transaction_voucher_id_fkey') THEN
        ALTER TABLE public.points_transaction ADD CONSTRAINT points_transaction_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;
    END IF;
END $$;

\echo '3. Creating Indexes...'

-- Create indexes only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customer_points_customer_id') THEN
        CREATE INDEX idx_customer_points_customer_id ON public.customer_points USING btree (customer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_points_transaction_customer_id') THEN
        CREATE INDEX idx_points_transaction_customer_id ON public.points_transaction USING btree (customer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_points_transaction_type') THEN
        CREATE INDEX idx_points_transaction_type ON public.points_transaction USING btree (transaction_type);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vouchers_customer_id') THEN
        CREATE INDEX idx_vouchers_customer_id ON public.vouchers USING btree (customer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vouchers_code') THEN
        CREATE INDEX idx_vouchers_code ON public.vouchers USING btree (code);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vouchers_is_redeemed') THEN
        CREATE INDEX idx_vouchers_is_redeemed ON public.vouchers USING btree (is_redeemed);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vouchers_expires_at') THEN
        CREATE INDEX idx_vouchers_expires_at ON public.vouchers USING btree (expires_at);
    END IF;
END $$;

\echo '4. Creating Fixed Trigger Functions...'

-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS trg_award_points_for_order ON public."order";
DROP FUNCTION IF EXISTS public.award_points_for_order();

-- Fixed function that properly handles the order table structure
CREATE OR REPLACE FUNCTION public.award_points_for_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    customer_uuid UUID;
    customer_user_id UUID;
    points_to_award INTEGER;
BEGIN
    -- NEW.customer_id is already the customer UUID in the order table
    customer_uuid := NEW.customer_id;
    
    -- Get the user_id for notifications
    SELECT c.user_id INTO customer_user_id
    FROM customer c
    WHERE c.id = customer_uuid;

    IF customer_uuid IS NOT NULL AND customer_user_id IS NOT NULL THEN
        -- Calculate points (1 point per dollar spent, use total_amount)
        points_to_award := FLOOR(NEW.total_amount);

        -- Skip if no points to award
        IF points_to_award <= 0 THEN
            RETURN NEW;
        END IF;

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
        RAISE NOTICE 'Points awarded: % points to customer % (user %) for order %', 
            points_to_award, customer_uuid, customer_user_id, NEW.id;
    ELSE
        RAISE NOTICE 'Could not award points: customer_uuid=%, customer_user_id=%', 
            customer_uuid, customer_user_id;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error awarding points for order %: %', NEW.id, SQLERRM;
        RETURN NEW; -- Don't fail the order update
END;
$$;

-- Voucher redemption function
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in voucher redemption notification: %', SQLERRM;
        RETURN NEW;
END;
$$;

\echo '5. Creating Triggers...'

-- Create triggers only if order table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order') THEN
        -- Drop and recreate points award trigger
        DROP TRIGGER IF EXISTS trg_award_points_for_order ON public."order";
        CREATE TRIGGER trg_award_points_for_order 
            AFTER UPDATE OF status ON public."order"
            FOR EACH ROW 
            WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
            EXECUTE FUNCTION public.award_points_for_order();
    END IF;

    -- Drop and recreate voucher redemption trigger
    DROP TRIGGER IF EXISTS trg_redeem_voucher ON public.vouchers;
    CREATE TRIGGER trg_redeem_voucher 
        AFTER UPDATE ON public.vouchers
        FOR EACH ROW 
        EXECUTE FUNCTION public.redeem_voucher();
END $$;

\echo '6. Creating Test Functions...'

-- Test function to manually award points (for testing)
CREATE OR REPLACE FUNCTION test_award_points(customer_email TEXT, points_amount INTEGER) 
RETURNS TEXT AS $$
DECLARE
    customer_uuid UUID;
    customer_user_id UUID;
    result_text TEXT := '';
BEGIN
    -- Get customer by email
    SELECT c.id, c.user_id INTO customer_uuid, customer_user_id
    FROM customer c
    JOIN general_user gu ON c.user_id = gu.id
    WHERE gu.email = customer_email;
    
    IF customer_uuid IS NULL THEN
        RETURN 'Customer not found with email: ' || customer_email;
    END IF;
    
    -- Award points
    INSERT INTO customer_points (customer_id, points_balance, total_earned)
    VALUES (customer_uuid, points_amount, points_amount)
    ON CONFLICT (customer_id) 
    DO UPDATE SET 
        points_balance = customer_points.points_balance + points_amount,
        total_earned = customer_points.total_earned + points_amount,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Record transaction
    INSERT INTO points_transaction (
        customer_id, transaction_type, points, description
    ) VALUES (
        customer_uuid, 'bonus', points_amount, 
        'Manual test bonus - ' || points_amount || ' points'
    );
    
    -- Create notification
    INSERT INTO notification (
        user_id, notification_text, notification_type, category, 
        link, priority
    ) VALUES (
        customer_user_id,
        '🎁 Test bonus: You received ' || points_amount || ' points!',
        'bonus_points', 'rewards', '/account/vouchers', 'normal'
    );
    
    RETURN 'Successfully awarded ' || points_amount || ' points to ' || customer_email;
END;
$$ LANGUAGE plpgsql;

-- Test function to create a test order and mark it delivered
CREATE OR REPLACE FUNCTION test_order_delivery(customer_email TEXT, order_amount NUMERIC DEFAULT 100.00)
RETURNS TEXT AS $$
DECLARE
    customer_uuid UUID;
    customer_user_id UUID;
    new_order_id INTEGER;
    shipping_addr_id INTEGER;
BEGIN
    -- Get customer by email
    SELECT c.id, c.user_id INTO customer_uuid, customer_user_id
    FROM customer c
    JOIN general_user gu ON c.user_id = gu.id
    WHERE gu.email = customer_email;
    
    IF customer_uuid IS NULL THEN
        RETURN 'Customer not found with email: ' || customer_email;
    END IF;
    
    -- Get or create a shipping address
    SELECT id INTO shipping_addr_id
    FROM shipping_address
    WHERE customer_id = customer_uuid
    LIMIT 1;
    
    IF shipping_addr_id IS NULL THEN
        INSERT INTO shipping_address (
            customer_id, address_line1, city, postal_code, country
        ) VALUES (
            customer_uuid, '123 Test St', 'Test City', '12345', 'Test Country'
        ) RETURNING id INTO shipping_addr_id;
    END IF;
    
    -- Create test order
    INSERT INTO "order" (
        customer_id, total_amount, final_amount, status, 
        shipping_address_id, payment_method, payment_status
    ) VALUES (
        customer_uuid, order_amount, order_amount, 'pending',
        shipping_addr_id, 'test', 'completed'
    ) RETURNING id INTO new_order_id;
    
    -- Mark order as delivered (this should trigger points)
    UPDATE "order" SET status = 'delivered' WHERE id = new_order_id;
    
    RETURN 'Created and delivered test order #' || new_order_id || ' for $' || order_amount;
END;
$$ LANGUAGE plpgsql;

\echo '7. Running Tests...'

-- Check current state
SELECT 
    'Table Check' as test_type,
    COUNT(*) as customer_points_records
FROM customer_points;

SELECT 
    'Table Check' as test_type,
    COUNT(*) as points_transactions
FROM points_transaction;

SELECT 
    'Table Check' as test_type,
    COUNT(*) as vouchers_count
FROM vouchers;

-- Show trigger status
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name IN ('trg_award_points_for_order', 'trg_redeem_voucher');

\echo '8. Sample Data (if needed)...'

-- Add sample points for the first customer (for testing)
DO $$
DECLARE
    sample_customer_id UUID;
    sample_user_id UUID;
BEGIN
    -- Get first customer for testing
    SELECT c.id, c.user_id INTO sample_customer_id, sample_user_id
    FROM customer c
    JOIN general_user gu ON c.user_id = gu.id
    LIMIT 1;
    
    IF sample_customer_id IS NOT NULL THEN
        -- Add sample points
        INSERT INTO customer_points (customer_id, points_balance, total_earned)
        VALUES (sample_customer_id, 500, 500)
        ON CONFLICT (customer_id) 
        DO UPDATE SET 
            points_balance = GREATEST(customer_points.points_balance, 500),
            total_earned = GREATEST(customer_points.total_earned, 500);
        
        -- Add sample transaction
        INSERT INTO points_transaction (
            customer_id, transaction_type, points, description
        ) VALUES (
            sample_customer_id, 'bonus', 500,
            'Welcome bonus points for testing the system'
        );
        
        RAISE NOTICE 'Added sample 500 points to customer %', sample_customer_id;
    END IF;
END $$;

\echo ''
\echo '✅ POINTS SYSTEM SETUP COMPLETE!'
\echo ''
\echo '🧪 TEST THE SYSTEM:'
\echo '1. Run API tests: node test-api-endpoints.js'
\echo '2. Test manual points: SELECT test_award_points(''user@email.com'', 100);'
\echo '3. Test order delivery: SELECT test_order_delivery(''user@email.com'', 150.00);'
\echo '4. Check points: SELECT * FROM customer_points;'
\echo '5. Check transactions: SELECT * FROM points_transaction ORDER BY created_at DESC;'

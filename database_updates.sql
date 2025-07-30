-- =====================================================
-- Database Updates - Points and Vouchers System
-- Adding new tables, functions, and triggers for loyalty program
-- =====================================================

-- Enable UUID extension (safe - will not error if exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- =====================================================
-- POINTS AND VOUCHERS SYSTEM TABLES
-- =====================================================

-- Customer Points Balance Table
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

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

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

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'points_transaction_order_id_fkey') THEN
        ALTER TABLE public.points_transaction ADD CONSTRAINT points_transaction_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vouchers_order_id_fkey') THEN
        ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'points_transaction_voucher_id_fkey') THEN
        ALTER TABLE public.points_transaction ADD CONSTRAINT points_transaction_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

DO $$
BEGIN
    -- Create indexes only if they don't exist
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

-- =====================================================
-- FUNCTIONS FOR POINTS SYSTEM
-- =====================================================

-- Function to award points when orders are completed
CREATE OR REPLACE FUNCTION public.award_points_for_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    customer_uuid UUID;
    points_to_award INTEGER;
BEGIN
    -- Get customer UUID from the order
    SELECT c.id INTO customer_uuid
    FROM customer c
    WHERE c.user_id = NEW.customer_id;

    IF customer_uuid IS NOT NULL THEN
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

        -- Create notification for points earned
        INSERT INTO notification (
            user_id,
            notification_text,
            notification_type,
            category,
            link,
            priority,
            data
        ) VALUES (
            NEW.customer_id,
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
    END IF;

    RETURN NEW;
END;
$$;

-- Function to handle voucher redemption
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

-- Function to expire old vouchers (can be called by cron job)
CREATE OR REPLACE FUNCTION public.expire_old_vouchers() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Mark expired vouchers
    UPDATE vouchers 
    SET is_redeemed = true, 
        redeemed_at = CURRENT_TIMESTAMP
    WHERE expires_at < CURRENT_TIMESTAMP 
      AND is_redeemed = false;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

DO $$
BEGIN
    -- Drop and recreate points award trigger
    DROP TRIGGER IF EXISTS trg_award_points_for_order ON public."order";
    CREATE TRIGGER trg_award_points_for_order 
        AFTER UPDATE OF status ON public."order"
        FOR EACH ROW 
        WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
        EXECUTE FUNCTION public.award_points_for_order();

    -- Drop and recreate voucher redemption trigger
    DROP TRIGGER IF EXISTS trg_redeem_voucher ON public.vouchers;
    CREATE TRIGGER trg_redeem_voucher 
        AFTER UPDATE ON public.vouchers
        FOR EACH ROW 
        EXECUTE FUNCTION public.redeem_voucher();
END $$;

-- =====================================================
-- ENHANCED PRICE FILTERING (CONSIDER DISCOUNTS)
-- =====================================================

-- Update existing product queries to consider discounted prices in filters
-- This is already implemented in the backend API routes

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Add sample customer points (only if customer exists)
DO $$
DECLARE
    sample_customer_id UUID;
BEGIN
    -- Get first customer for testing
    SELECT id INTO sample_customer_id FROM customer LIMIT 1;
    
    IF sample_customer_id IS NOT NULL THEN
        -- Add sample points
        INSERT INTO customer_points (customer_id, points_balance, total_earned)
        VALUES (sample_customer_id, 500, 500)
        ON CONFLICT (customer_id) DO NOTHING;
        
        -- Add sample transaction
        INSERT INTO points_transaction (
            customer_id, 
            transaction_type, 
            points, 
            description
        ) VALUES (
            sample_customer_id,
            'earned',
            500,
            'Welcome bonus points for testing'
        );
    END IF;
END $$;

-- =====================================================
-- VIEWS FOR REPORTING (OPTIONAL)
-- =====================================================

-- View for customer points summary
CREATE OR REPLACE VIEW customer_points_summary AS
SELECT 
    c.id as customer_id,
    gu.username,
    gu.email,
    cp.points_balance,
    cp.total_earned,
    cp.total_redeemed,
    (cp.total_earned - cp.total_redeemed) as lifetime_points_difference,
    cp.created_at as points_account_created,
    cp.updated_at as last_points_activity
FROM customer c
JOIN general_user gu ON c.user_id = gu.id
LEFT JOIN customer_points cp ON c.id = cp.customer_id;

-- View for voucher statistics
CREATE OR REPLACE VIEW voucher_stats AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_vouchers_created,
    COUNT(*) FILTER (WHERE is_redeemed = true) as vouchers_redeemed,
    COUNT(*) FILTER (WHERE expires_at < CURRENT_TIMESTAMP AND is_redeemed = false) as vouchers_expired,
    SUM(value) FILTER (WHERE is_redeemed = true) as total_discount_given
FROM vouchers
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 'Points and Vouchers System Database Setup Complete! 🎉' as result,
       'Tables: customer_points, points_transaction, vouchers' as tables_created,
       'Functions: award_points_for_order(), redeem_voucher(), expire_old_vouchers()' as functions_created,
       'Triggers: trg_award_points_for_order, trg_redeem_voucher' as triggers_created,
       'Features: 1 point per $1 spent, 100 points = 1 coupon (10% discount)' as business_logic;

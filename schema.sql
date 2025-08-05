--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Homebrew)
-- Dumped by pg_dump version 14.18 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: award_points_for_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_points_for_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    customer_uuid UUID;
    customer_user_id UUID;
    points_to_award INTEGER;
BEGIN
    customer_uuid := NEW.customer_id;
    
    SELECT c.user_id INTO customer_user_id
    FROM customer c
    WHERE c.id = customer_uuid;

    IF customer_uuid IS NOT NULL AND customer_user_id IS NOT NULL THEN
        -- Use total_price instead of total_amount
        points_to_award := FLOOR(NEW.total_price);

        IF points_to_award <= 0 THEN
            RETURN NEW;
        END IF;

        INSERT INTO customer_points (customer_id, points_balance, total_earned)
        VALUES (customer_uuid, points_to_award, points_to_award)
        ON CONFLICT (customer_id) 
        DO UPDATE SET 
            points_balance = customer_points.points_balance + points_to_award,
            total_earned = customer_points.total_earned + points_to_award,
            updated_at = CURRENT_TIMESTAMP;

        INSERT INTO points_transaction (
            customer_id, transaction_type, points, order_id, description
        ) VALUES (
            customer_uuid, 'earned', points_to_award, NEW.id,
            'Points earned from order #' || NEW.id || ' - $' || NEW.total_price
        );

        INSERT INTO notification (
            user_id, notification_text, notification_type, category, 
            link, priority, data
        ) VALUES (
            customer_user_id,
            '🎉 You earned ' || points_to_award || ' points from your recent order!',
            'points_earned', 'rewards', '/account/vouchers', 'normal',
            jsonb_build_object(
                'points_earned', points_to_award,
                'order_id', NEW.id,
                'total_amount', NEW.total_price,
                'points_rate', '1 point per $1 spent'
            )
        );
        
        RAISE NOTICE 'Points awarded: % points to customer % for order %', 
            points_to_award, customer_uuid, NEW.id;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error awarding points for order %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$_$;


--
-- Name: check_cart_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_cart_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_stock INTEGER;
    current_cart_quantity INTEGER;
    total_quantity INTEGER;
BEGIN
    -- Get current stock for the product
    SELECT stock INTO current_stock
    FROM product_attribute
    WHERE product_id = NEW.product_id;
    
    -- Get current quantity in cart for this product and customer
    SELECT COALESCE(SUM(quantity), 0) INTO current_cart_quantity
    FROM cart_item ci
    JOIN cart c ON ci.cart_id = c.id
    WHERE c.customer_id = (
        SELECT customer_id 
        FROM cart 
        WHERE id = NEW.cart_id
    ) AND ci.product_id = NEW.product_id
    AND ci.id != COALESCE(NEW.id, -1); -- Exclude current item in case of update
    
    -- Calculate total quantity if this item is added/updated
    total_quantity := current_cart_quantity + NEW.quantity;
    
    -- Check if total quantity exceeds stock
    IF total_quantity > current_stock THEN
        RAISE EXCEPTION 'Cannot add % items to cart. Only % items available (% already in cart)', 
            NEW.quantity, current_stock, current_cart_quantity;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: check_order_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_order_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    -- Get current stock for the product
    SELECT stock INTO current_stock
    FROM product_attribute
    WHERE product_id = NEW.product_id;
    
    -- Check if quantity exceeds stock
    IF NEW.quantity > current_stock THEN
        RAISE EXCEPTION 'Cannot order % items. Only % items available in stock', 
            NEW.quantity, current_stock;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: handle_order_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_order_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    item RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Order is being placed, decrease stock
        FOR item IN 
            SELECT product_id, quantity 
            FROM order_item 
            WHERE order_id = NEW.id
        LOOP
            UPDATE product_attribute 
            SET stock = stock - item.quantity
            WHERE product_id = item.product_id;
            
            -- Check if stock went negative (shouldn't happen with cart check, but safety)
            UPDATE product_attribute 
            SET stock = 0 
            WHERE product_id = item.product_id AND stock < 0;
        END LOOP;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check if order status changed to cancelled
        IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
            -- Order is being cancelled, restore stock
            FOR item IN 
                SELECT product_id, quantity 
                FROM order_item 
                WHERE order_id = NEW.id
            LOOP
                UPDATE product_attribute 
                SET stock = stock + item.quantity
                WHERE product_id = item.product_id;
            END LOOP;
        ELSIF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
            -- Order is being uncancelled, decrease stock again
            FOR item IN 
                SELECT product_id, quantity 
                FROM order_item 
                WHERE order_id = NEW.id
            LOOP
                UPDATE product_attribute 
                SET stock = stock - item.quantity
                WHERE product_id = item.product_id;
                
                -- Check if stock went negative
                UPDATE product_attribute 
                SET stock = 0 
                WHERE product_id = item.product_id AND stock < 0;
            END LOOP;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: notify_order_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_order_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  customer_user_id UUID;
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get customer user_id
    SELECT c.user_id INTO customer_user_id
    FROM customer c
    WHERE c.id = NEW.customer_id;
    
    -- Create notification
    INSERT INTO notification (
      user_id,
      notification_text,
      notification_type,
      category,
      link,
      priority,
      data
    ) VALUES (
      customer_user_id,
      'Your order #' || NEW.id || ' status has been updated to: ' || NEW.status,
      'order_status_update',
      'orders',
      '/account/orders',
      'normal',
      jsonb_build_object(
        'order_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_qa_answered(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_qa_answered() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  customer_user_id UUID;
  question_text TEXT;
  product_name TEXT;
BEGIN
  -- Get customer user_id and question details
  SELECT c.user_id, pqa.question_text, p.name
  INTO customer_user_id, question_text, product_name
  FROM product_qa pqa
  JOIN customer c ON pqa.customer_id = c.id
  JOIN product p ON pqa.product_id = p.id
  WHERE pqa.id = NEW.question_id;

  -- Create notification for customer
  INSERT INTO notification (
    user_id,
    notification_text,
    notification_type,
    category,
    link,
    priority,
    data
  ) VALUES (
    customer_user_id,
    'Your question about "' || product_name || '" has been answered.',
    'qa_answered',
    'support',
    '/product/' || (SELECT product_id FROM product_qa WHERE id = NEW.question_id),
    'normal',
    jsonb_build_object(
      'question_id', NEW.question_id,
      'answer_id', NEW.id,
      'product_name', product_name,
      'is_published', NEW.is_published
    )
  );

  -- Send message if requested and if columns exist
  IF NEW.send_to_customer = TRUE THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message' AND column_name = 'is_system_message') THEN
      INSERT INTO message (
        sender_id,
        receiver_id,
        message_text,
        subject,
        message_type,
        is_system_message
      ) VALUES (
        (SELECT user_id FROM admin_users WHERE admin_id = NEW.admin_id),
        customer_user_id,
        'Your question: "' || LEFT(question_text, 100) || '..." has been answered: ' || NEW.answer_text,
        'Answer to your product question',
        'text',
        TRUE
      );
    END IF;
  END IF;

  -- Update question status
  UPDATE product_qa
  SET status = CASE
    WHEN NEW.is_published THEN 'published'
    ELSE 'answered'
  END,
  updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.question_id;

  RETURN NEW;
END;
$$;


--
-- Name: redeem_voucher(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_voucher() RETURNS trigger
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


--
-- Name: sync_all_product_availability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_all_product_availability() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set availability to false for products with 0 stock
    UPDATE product 
    SET availability = false 
    WHERE id IN (
        SELECT product_id 
        FROM product_attribute 
        WHERE stock = 0
    );
    
    -- Set availability to true for products with positive stock
    UPDATE product 
    SET availability = true 
    WHERE id IN (
        SELECT product_id 
        FROM product_attribute 
        WHERE stock > 0
    );
    
    RAISE NOTICE 'Product availability synced with stock levels';
END;
$$;


--
-- Name: test_award_points(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_award_points(customer_email text, points_amount integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: test_order_delivery(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_order_delivery(customer_email text, order_amount numeric DEFAULT 100.00) RETURNS text
    LANGUAGE plpgsql
    AS $_$
DECLARE
    customer_uuid UUID;
    customer_user_id UUID;
    new_order_id INTEGER;
    shipping_addr_id INTEGER;
BEGIN
    SELECT c.id, c.user_id INTO customer_uuid, customer_user_id
    FROM customer c
    JOIN general_user gu ON c.user_id = gu.id
    WHERE gu.email = customer_email;
    
    IF customer_uuid IS NULL THEN
        RETURN 'Customer not found with email: ' || customer_email;
    END IF;
    
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
    
    -- Create test order with correct column names
    INSERT INTO "order" (
        customer_id, total_price, delivery_charge, status, 
        shipping_address_id, payment_method, payment_status
    ) VALUES (
        customer_uuid, order_amount, 10.00, 'pending',
        shipping_addr_id, 'test', true
    ) RETURNING id INTO new_order_id;
    
    -- Mark order as delivered (this should trigger points)
    UPDATE "order" SET status = 'delivered' WHERE id = new_order_id;
    
    RETURN 'Created and delivered test order #' || new_order_id || ' for $' || order_amount;
END;
$_$;


--
-- Name: update_access_levels_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_access_levels_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: update_admin_users_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_admin_users_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE conversation 
  SET last_message_at = NEW.sent_at, updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_product_availability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_availability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When stock goes to 0, set availability to false
    -- When stock goes from 0 to positive, set availability to true
    
    IF TG_OP = 'UPDATE' THEN
        -- Check if stock changed from positive to 0
        IF OLD.stock > 0 AND NEW.stock = 0 THEN
            UPDATE product 
            SET availability = false 
            WHERE id = NEW.product_id;
        END IF;
        
        -- Check if stock changed from 0 to positive
        IF OLD.stock = 0 AND NEW.stock > 0 THEN
            UPDATE product 
            SET availability = true 
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
        -- Set availability based on initial stock
        IF NEW.stock = 0 THEN
            UPDATE product 
            SET availability = false 
            WHERE id = NEW.product_id;
        ELSE
            UPDATE product 
            SET availability = true 
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_signup_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_signup_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: validate_rating_eligibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_rating_eligibility() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Check if the order exists and is delivered
  -- Handle both direct products and products from builds
  IF NOT EXISTS (
    -- Check for direct product purchase
    SELECT 1 
    FROM "order" o
    JOIN order_item oi ON o.id = oi.order_id
    JOIN customer c ON o.customer_id = c.id
    WHERE o.id = NEW.order_id 
      AND oi.id = NEW.order_item_id
      AND c.user_id = NEW.user_id
      AND oi.product_id = NEW.product_id
      AND o.status = 'delivered'
    
    UNION
    
    -- Check for product from build purchase
    SELECT 1
    FROM "order" o
    JOIN order_item oi ON o.id = oi.order_id
    JOIN customer c ON o.customer_id = c.id
    JOIN build b ON oi.build_id = b.id
    JOIN build_product bp ON b.id = bp.build_id
    WHERE o.id = NEW.order_id 
      AND oi.id = NEW.order_item_id
      AND c.user_id = NEW.user_id
      AND bp.product_id = NEW.product_id
      AND o.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'Can only rate products from delivered orders that you have purchased';
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_levels (
    access_level integer NOT NULL,
    access_name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: general_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.general_user (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash text NOT NULL,
    contact_no character varying(20),
    profile_img text,
    full_name character varying(100) NOT NULL,
    gender character varying(10),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    notification_text text NOT NULL,
    seen_status boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notification_type character varying(50) DEFAULT 'general'::character varying,
    category character varying(50) DEFAULT 'general'::character varying,
    action_url text,
    expires_at timestamp without time zone,
    priority character varying(10) DEFAULT 'normal'::character varying,
    data jsonb DEFAULT '{}'::jsonb,
    link text,
    CONSTRAINT notification_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);


--
-- Name: active_notifications; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_notifications AS
 SELECT n.id,
    n.user_id,
    n.notification_text,
    n.seen_status,
    n.created_at,
    n.notification_type,
    n.category,
    n.action_url,
    n.expires_at,
    n.priority,
    n.data,
    n.link,
    gu.username,
    gu.full_name
   FROM (public.notification n
     JOIN public.general_user gu ON ((n.user_id = gu.id)))
  WHERE (((n.expires_at IS NULL) OR (n.expires_at > CURRENT_TIMESTAMP)) AND (n.seen_status = false))
  ORDER BY n.priority DESC, n.created_at DESC;


--
-- Name: admin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    clearance_level character varying(30) NOT NULL,
    is_employed boolean DEFAULT true NOT NULL,
    hire_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_logs (
    log_id integer NOT NULL,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id character varying(100),
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    admin_id uuid
);


--
-- Name: admin_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_logs_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_logs_log_id_seq OWNED BY public.admin_logs.log_id;


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notifications (
    notification_id integer NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    related_id integer,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    admin_id uuid
);


--
-- Name: admin_notifications_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_notifications_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_notifications_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_notifications_notification_id_seq OWNED BY public.admin_notifications.notification_id;


--
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT customer_points_check CHECK ((points >= 0))
);


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    excerpt text,
    image_url text,
    price numeric(10,2) NOT NULL,
    discount_status boolean DEFAULT false NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    availability boolean DEFAULT true NOT NULL,
    date_added date DEFAULT CURRENT_DATE NOT NULL,
    category_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    specs jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT product_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))),
    CONSTRAINT product_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: product_qa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_qa (
    id integer NOT NULL,
    product_id integer NOT NULL,
    customer_id uuid NOT NULL,
    question_text text NOT NULL,
    time_asked timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    priority character varying(10) DEFAULT 'normal'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    category character varying(50),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_qa_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT product_qa_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'answered'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: qa_answer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_answer (
    id integer NOT NULL,
    question_id integer NOT NULL,
    answer_text text,
    time_answered timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    admin_id uuid,
    is_published boolean DEFAULT false,
    send_to_customer boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: admin_qa_management; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_qa_management AS
 SELECT pqa.id AS question_id,
    pqa.product_id,
    p.name AS product_name,
    pqa.customer_id,
    gu.full_name AS customer_name,
    gu.username AS customer_username,
    pqa.question_text,
    pqa.priority,
    pqa.status,
    pqa.category,
    pqa.time_asked,
    pqa.updated_at,
    qaa.id AS answer_id,
    qaa.answer_text,
    qaa.is_published,
    qaa.send_to_customer,
    qaa.time_answered,
    admin_gu.full_name AS answered_by
   FROM ((((((public.product_qa pqa
     JOIN public.product p ON ((pqa.product_id = p.id)))
     JOIN public.customer c ON ((pqa.customer_id = c.id)))
     JOIN public.general_user gu ON ((c.user_id = gu.id)))
     LEFT JOIN public.qa_answer qaa ON ((pqa.id = qaa.question_id)))
     LEFT JOIN public.admin a ON ((qaa.admin_id = a.id)))
     LEFT JOIN public.general_user admin_gu ON ((a.user_id = admin_gu.id)))
  ORDER BY pqa.priority DESC, pqa.time_asked DESC;


--
-- Name: admin_signup_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_signup_requests (
    request_id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password text NOT NULL,
    phone character varying(20),
    department character varying(100),
    "position" character varying(100),
    reason_for_access text,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    requested_clearance integer,
    assigned_clearance integer,
    approved_by uuid,
    CONSTRAINT admin_signup_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: admin_signup_requests_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_signup_requests_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_signup_requests_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_signup_requests_request_id_seq OWNED BY public.admin_signup_requests.request_id;


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    employee_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    password text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    clearance_level integer,
    email character varying(100),
    phone character varying(20),
    department character varying(100),
    "position" character varying(100),
    is_employed boolean DEFAULT true,
    admin_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: build; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build (
    id integer NOT NULL,
    customer_id uuid NOT NULL,
    template_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name character varying(200) DEFAULT 'Untitled Build'::character varying NOT NULL,
    image_url character varying(500) DEFAULT '/logo192.png'::character varying
);


--
-- Name: build_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.build_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: build_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.build_id_seq OWNED BY public.build.id;


--
-- Name: build_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_product (
    id integer NOT NULL,
    build_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT build_product_quantity_check CHECK ((quantity > 0))
);


--
-- Name: build_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.build_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: build_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.build_product_id_seq OWNED BY public.build_product.id;


--
-- Name: cart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart (
    id integer NOT NULL,
    customer_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cart_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cart_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cart_id_seq OWNED BY public.cart.id;


--
-- Name: cart_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_item (
    id integer NOT NULL,
    cart_id integer NOT NULL,
    product_id integer,
    build_id integer,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cart_item_check CHECK ((((product_id IS NOT NULL) AND (build_id IS NULL)) OR ((product_id IS NULL) AND (build_id IS NOT NULL)))),
    CONSTRAINT cart_item_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT cart_item_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: cart_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cart_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cart_item_id_seq OWNED BY public.cart_item.id;


--
-- Name: compatibility_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compatibility_rules (
    id integer NOT NULL,
    rule_type character varying(50) NOT NULL,
    category1_id integer,
    category2_id integer,
    spec1_field character varying(100),
    spec2_field character varying(100),
    rule_description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE compatibility_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compatibility_rules IS 'Rules for validating PC component compatibility during builds';


--
-- Name: compatibility_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compatibility_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compatibility_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compatibility_rules_id_seq OWNED BY public.compatibility_rules.id;


--
-- Name: conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(200) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    priority character varying(10) DEFAULT 'normal'::character varying,
    type character varying(50) DEFAULT 'general'::character varying,
    created_by uuid NOT NULL,
    assigned_to uuid,
    last_message_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT conversation_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT conversation_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'resolved'::character varying, 'closed'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT conversation_type_check CHECK (((type)::text = ANY ((ARRAY['general'::character varying, 'support'::character varying, 'qa_followup'::character varying, 'order_inquiry'::character varying, 'product_inquiry'::character varying])::text[])))
);


--
-- Name: conversation_participant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participant (
    id integer NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) DEFAULT 'participant'::character varying,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_read_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    CONSTRAINT conversation_participant_role_check CHECK (((role)::text = ANY ((ARRAY['participant'::character varying, 'moderator'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: conversation_participant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversation_participant_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversation_participant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversation_participant_id_seq OWNED BY public.conversation_participant.id;


--
-- Name: customer_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_points (
    id integer NOT NULL,
    customer_id uuid NOT NULL,
    points_balance integer DEFAULT 0 NOT NULL,
    total_earned integer DEFAULT 0 NOT NULL,
    total_redeemed integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT customer_points_balance_check CHECK ((points_balance >= 0))
);


--
-- Name: customer_points_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_points_id_seq OWNED BY public.customer_points.id;


--
-- Name: product_attribute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_attribute (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id integer NOT NULL,
    cost numeric(10,2) NOT NULL,
    units_sold integer DEFAULT 0 NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT product_attribute_cost_check CHECK ((cost >= (0)::numeric)),
    CONSTRAINT product_attribute_stock_check CHECK ((stock >= 0)),
    CONSTRAINT product_attribute_units_sold_check CHECK ((units_sold >= 0))
);


--
-- Name: product_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_category (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    image_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: low_stock_products; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.low_stock_products AS
 SELECT p.id,
    p.name,
    p.availability,
    pa.stock,
    pc.name AS category
   FROM ((public.product p
     JOIN public.product_attribute pa ON ((p.id = pa.product_id)))
     LEFT JOIN public.product_category pc ON ((p.category_id = pc.id)))
  WHERE (pa.stock <= 5)
  ORDER BY pa.stock;


--
-- Name: message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message (
    id integer NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    message_text text NOT NULL,
    seen_status boolean DEFAULT false NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    conversation_id uuid DEFAULT public.uuid_generate_v4(),
    subject character varying(200),
    message_status character varying(20) DEFAULT 'active'::character varying,
    parent_message_id integer,
    is_system_message boolean DEFAULT false,
    priority character varying(10) DEFAULT 'normal'::character varying,
    message_type character varying(20) DEFAULT 'text'::character varying,
    CONSTRAINT message_message_status_check CHECK (((message_status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying, 'deleted'::character varying])::text[]))),
    CONSTRAINT message_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'system'::character varying, 'notification'::character varying, 'qa_response'::character varying])::text[]))),
    CONSTRAINT message_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);


--
-- Name: message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.message_id_seq OWNED BY public.message.id;


--
-- Name: notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_id_seq OWNED BY public.notification.id;


--
-- Name: order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."order" (
    id integer NOT NULL,
    customer_id uuid NOT NULL,
    promo_id integer,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_status boolean DEFAULT false NOT NULL,
    payment_method character varying(50) NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    delivery_charge numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0 NOT NULL,
    total_price numeric(10,2) NOT NULL,
    transaction_id character varying(100),
    shipping_address_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    admin_notes text,
    CONSTRAINT order_delivery_charge_check CHECK ((delivery_charge >= (0)::numeric)),
    CONSTRAINT order_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT order_total_price_check CHECK ((total_price >= (0)::numeric))
);


--
-- Name: order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_id_seq OWNED BY public."order".id;


--
-- Name: order_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    build_id integer,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT order_item_check CHECK ((((product_id IS NOT NULL) AND (build_id IS NULL)) OR ((product_id IS NULL) AND (build_id IS NOT NULL)))),
    CONSTRAINT order_item_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_item_total_price_check CHECK ((total_price >= (0)::numeric)),
    CONSTRAINT order_item_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_item_id_seq OWNED BY public.order_item.id;


--
-- Name: points_transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points_transaction (
    id integer NOT NULL,
    customer_id uuid NOT NULL,
    transaction_type character varying(20) NOT NULL,
    points integer NOT NULL,
    order_id integer,
    voucher_id integer,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT points_transaction_type_check CHECK (((transaction_type)::text = ANY (ARRAY[('earned'::character varying)::text, ('redeemed'::character varying)::text, ('expired'::character varying)::text, ('bonus'::character varying)::text])))
);


--
-- Name: points_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.points_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: points_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.points_transaction_id_seq OWNED BY public.points_transaction.id;


--
-- Name: product_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_category_id_seq OWNED BY public.product_category.id;


--
-- Name: product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_id_seq OWNED BY public.product.id;


--
-- Name: product_qa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_qa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_qa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_qa_id_seq OWNED BY public.product_qa.id;


--
-- Name: ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id integer NOT NULL,
    rating integer NOT NULL,
    review_text text,
    order_id integer,
    order_item_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ratings_rating_check CHECK (((rating >= 1) AND (rating <= 10)))
);


--
-- Name: TABLE ratings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ratings IS 'Enhanced product ratings and reviews system with order verification';


--
-- Name: product_ratings_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.product_ratings_summary AS
 SELECT p.id AS product_id,
    p.name AS product_name,
    COALESCE(round(avg((r.rating)::numeric), 1), (0)::numeric) AS average_rating,
    count(r.rating) AS total_ratings,
    count(DISTINCT r.user_id) AS unique_reviewers
   FROM (public.product p
     LEFT JOIN public.ratings r ON ((p.id = r.product_id)))
  GROUP BY p.id, p.name;


--
-- Name: promo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    discount_percent numeric(5,2) NOT NULL,
    status character varying(20) NOT NULL,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT promo_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric)))
);


--
-- Name: promo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_id_seq OWNED BY public.promo.id;


--
-- Name: promotion_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_usage (
    id integer NOT NULL,
    promotion_id integer,
    order_id integer,
    user_id uuid,
    discount_amount numeric(10,2) NOT NULL,
    order_value numeric(10,2) NOT NULL,
    used_at timestamp without time zone DEFAULT now()
);


--
-- Name: promotion_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotion_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotion_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotion_usage_id_seq OWNED BY public.promotion_usage.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    max_uses integer,
    min_order_value numeric(10,2) DEFAULT 0,
    start_date timestamp without time zone DEFAULT now(),
    end_date timestamp without time zone,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT promotions_type_check CHECK (((type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying, 'free_shipping'::character varying])::text[])))
);


--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: published_product_qa; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.published_product_qa AS
 SELECT pqa.id AS question_id,
    pqa.product_id,
    pqa.question_text,
    pqa.time_asked,
    qaa.answer_text,
    qaa.time_answered,
    admin_gu.full_name AS answered_by_name
   FROM (((public.product_qa pqa
     JOIN public.qa_answer qaa ON ((pqa.id = qaa.question_id)))
     LEFT JOIN public.admin a ON ((qaa.admin_id = a.id)))
     LEFT JOIN public.general_user admin_gu ON ((a.user_id = admin_gu.id)))
  WHERE ((qaa.is_published = true) AND ((pqa.status)::text = 'published'::text))
  ORDER BY pqa.time_asked DESC;


--
-- Name: qa_answer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.qa_answer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: qa_answer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.qa_answer_id_seq OWNED BY public.qa_answer.id;


--
-- Name: review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review (
    id integer NOT NULL,
    product_id integer NOT NULL,
    customer_id uuid NOT NULL,
    review_text text,
    rating numeric(2,1) NOT NULL,
    time_added timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT review_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)))
);


--
-- Name: review_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.review_id_seq OWNED BY public.review.id;


--
-- Name: shipping_address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_address (
    id integer NOT NULL,
    customer_id uuid,
    address text NOT NULL,
    city character varying(100) NOT NULL,
    zip_code character varying(20) NOT NULL,
    country character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: shipping_address_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipping_address_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipping_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipping_address_id_seq OWNED BY public.shipping_address.id;


--
-- Name: template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: template_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: template_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.template_id_seq OWNED BY public.template.id;


--
-- Name: template_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_product (
    id integer NOT NULL,
    template_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT template_product_quantity_check CHECK ((quantity > 0))
);


--
-- Name: template_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.template_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: template_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.template_product_id_seq OWNED BY public.template_product.id;


--
-- Name: user_conversations; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_conversations AS
 SELECT c.id AS conversation_id,
    c.title AS subject,
    c.status,
    c.type,
    c.priority,
    c.last_message_at,
    c.created_at,
    cp.user_id,
    cp.role,
    cp.last_read_at,
    ( SELECT count(*) AS count
           FROM public.message m
          WHERE ((m.conversation_id = c.id) AND (m.sent_at > cp.last_read_at))) AS unread_count,
    ( SELECT m.message_text
           FROM public.message m
          WHERE (m.conversation_id = c.id)
          ORDER BY m.sent_at DESC
         LIMIT 1) AS last_message,
    ( SELECT gu.full_name
           FROM (public.message m
             JOIN public.general_user gu ON ((m.sender_id = gu.id)))
          WHERE (m.conversation_id = c.id)
          ORDER BY m.sent_at DESC
         LIMIT 1) AS last_sender_name
   FROM (public.conversation c
     JOIN public.conversation_participant cp ON ((c.id = cp.conversation_id)))
  WHERE (cp.is_active = true)
  ORDER BY c.last_message_at DESC;


--
-- Name: user_ratable_products; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_ratable_products AS
 SELECT DISTINCT c.user_id,
    oi.product_id,
    p.name AS product_name,
    p.image_url,
    oi.id AS order_item_id,
    o.id AS order_id,
    o.order_date,
    o.status AS order_status,
    'product'::text AS item_type
   FROM (((public."order" o
     JOIN public.customer c ON ((o.customer_id = c.id)))
     JOIN public.order_item oi ON ((o.id = oi.order_id)))
     JOIN public.product p ON ((oi.product_id = p.id)))
  WHERE (((o.status)::text = 'delivered'::text) AND (oi.product_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
           FROM public.ratings r
          WHERE ((r.user_id = c.user_id) AND (r.product_id = oi.product_id) AND (r.order_item_id = oi.id))))))
UNION
 SELECT DISTINCT c.user_id,
    bp.product_id,
    p.name AS product_name,
    p.image_url,
    oi.id AS order_item_id,
    o.id AS order_id,
    o.order_date,
    o.status AS order_status,
    'build'::text AS item_type
   FROM (((((public."order" o
     JOIN public.customer c ON ((o.customer_id = c.id)))
     JOIN public.order_item oi ON ((o.id = oi.order_id)))
     JOIN public.build b ON ((oi.build_id = b.id)))
     JOIN public.build_product bp ON ((b.id = bp.build_id)))
     JOIN public.product p ON ((bp.product_id = p.id)))
  WHERE (((o.status)::text = 'delivered'::text) AND (oi.build_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
           FROM public.ratings r
          WHERE ((r.user_id = c.user_id) AND (r.product_id = bp.product_id) AND (r.order_item_id = oi.id))))));


--
-- Name: user_ratings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_ratings AS
 SELECT r.id,
    r.user_id,
    r.product_id,
    p.name AS product_name,
    p.image_url,
    r.rating,
    r.review_text,
    r.created_at,
    r.updated_at,
    o.order_date
   FROM ((public.ratings r
     JOIN public.product p ON ((r.product_id = p.id)))
     JOIN public."order" o ON ((r.order_id = o.id)))
  ORDER BY r.created_at DESC;


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vouchers (
    id integer NOT NULL,
    customer_id uuid NOT NULL,
    code character varying(50) NOT NULL,
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
    status character varying(20) DEFAULT 'active'::character varying,
    CONSTRAINT vouchers_discount_type_check CHECK (((discount_type)::text = ANY (ARRAY[('percentage'::character varying)::text, ('fixed_amount'::character varying)::text]))),
    CONSTRAINT vouchers_type_check CHECK (((type)::text = ANY (ARRAY[('discount'::character varying)::text, ('free_shipping'::character varying)::text, ('cashback'::character varying)::text])))
);


--
-- Name: vouchers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vouchers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vouchers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vouchers_id_seq OWNED BY public.vouchers.id;


--
-- Name: wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist (
    customer_id uuid NOT NULL,
    product_id integer NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admin_logs log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_logs ALTER COLUMN log_id SET DEFAULT nextval('public.admin_logs_log_id_seq'::regclass);


--
-- Name: admin_notifications notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications ALTER COLUMN notification_id SET DEFAULT nextval('public.admin_notifications_notification_id_seq'::regclass);


--
-- Name: admin_signup_requests request_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_signup_requests ALTER COLUMN request_id SET DEFAULT nextval('public.admin_signup_requests_request_id_seq'::regclass);


--
-- Name: build id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build ALTER COLUMN id SET DEFAULT nextval('public.build_id_seq'::regclass);


--
-- Name: build_product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_product ALTER COLUMN id SET DEFAULT nextval('public.build_product_id_seq'::regclass);


--
-- Name: cart id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart ALTER COLUMN id SET DEFAULT nextval('public.cart_id_seq'::regclass);


--
-- Name: cart_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_item ALTER COLUMN id SET DEFAULT nextval('public.cart_item_id_seq'::regclass);


--
-- Name: compatibility_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compatibility_rules ALTER COLUMN id SET DEFAULT nextval('public.compatibility_rules_id_seq'::regclass);


--
-- Name: conversation_participant id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant ALTER COLUMN id SET DEFAULT nextval('public.conversation_participant_id_seq'::regclass);


--
-- Name: customer_points id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_points ALTER COLUMN id SET DEFAULT nextval('public.customer_points_id_seq'::regclass);


--
-- Name: message id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message ALTER COLUMN id SET DEFAULT nextval('public.message_id_seq'::regclass);


--
-- Name: notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification ALTER COLUMN id SET DEFAULT nextval('public.notification_id_seq'::regclass);


--
-- Name: order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order" ALTER COLUMN id SET DEFAULT nextval('public.order_id_seq'::regclass);


--
-- Name: order_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item ALTER COLUMN id SET DEFAULT nextval('public.order_item_id_seq'::regclass);


--
-- Name: points_transaction id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transaction ALTER COLUMN id SET DEFAULT nextval('public.points_transaction_id_seq'::regclass);


--
-- Name: product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product ALTER COLUMN id SET DEFAULT nextval('public.product_id_seq'::regclass);


--
-- Name: product_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category ALTER COLUMN id SET DEFAULT nextval('public.product_category_id_seq'::regclass);


--
-- Name: product_qa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_qa ALTER COLUMN id SET DEFAULT nextval('public.product_qa_id_seq'::regclass);


--
-- Name: promo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo ALTER COLUMN id SET DEFAULT nextval('public.promo_id_seq'::regclass);


--
-- Name: promotion_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage ALTER COLUMN id SET DEFAULT nextval('public.promotion_usage_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: qa_answer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_answer ALTER COLUMN id SET DEFAULT nextval('public.qa_answer_id_seq'::regclass);


--
-- Name: review id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review ALTER COLUMN id SET DEFAULT nextval('public.review_id_seq'::regclass);


--
-- Name: shipping_address id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_address ALTER COLUMN id SET DEFAULT nextval('public.shipping_address_id_seq'::regclass);


--
-- Name: template id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template ALTER COLUMN id SET DEFAULT nextval('public.template_id_seq'::regclass);


--
-- Name: template_product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_product ALTER COLUMN id SET DEFAULT nextval('public.template_product_id_seq'::regclass);


--
-- Name: vouchers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers ALTER COLUMN id SET DEFAULT nextval('public.vouchers_id_seq'::regclass);


--
-- Name: access_levels access_levels_access_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_levels
    ADD CONSTRAINT access_levels_access_name_key UNIQUE (access_name);


--
-- Name: access_levels access_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_levels
    ADD CONSTRAINT access_levels_pkey PRIMARY KEY (access_level);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (log_id);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: admin admin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_pkey PRIMARY KEY (id);


--
-- Name: admin_signup_requests admin_signup_requests_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_signup_requests
    ADD CONSTRAINT admin_signup_requests_employee_id_key UNIQUE (employee_id);


--
-- Name: admin_signup_requests admin_signup_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_signup_requests
    ADD CONSTRAINT admin_signup_requests_pkey PRIMARY KEY (request_id);


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_employee_id_key UNIQUE (employee_id);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (admin_id);


--
-- Name: build build_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build
    ADD CONSTRAINT build_pkey PRIMARY KEY (id);


--
-- Name: build_product build_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_product
    ADD CONSTRAINT build_product_pkey PRIMARY KEY (id);


--
-- Name: cart_item cart_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_item
    ADD CONSTRAINT cart_item_pkey PRIMARY KEY (id);


--
-- Name: cart cart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_pkey PRIMARY KEY (id);


--
-- Name: compatibility_rules compatibility_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compatibility_rules
    ADD CONSTRAINT compatibility_rules_pkey PRIMARY KEY (id);


--
-- Name: conversation_participant conversation_participant_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant
    ADD CONSTRAINT conversation_participant_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participant conversation_participant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant
    ADD CONSTRAINT conversation_participant_pkey PRIMARY KEY (id);


--
-- Name: conversation conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_pkey PRIMARY KEY (id);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- Name: customer_points customer_points_customer_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_points
    ADD CONSTRAINT customer_points_customer_id_unique UNIQUE (customer_id);


--
-- Name: customer_points customer_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_points
    ADD CONSTRAINT customer_points_pkey PRIMARY KEY (id);


--
-- Name: general_user general_user_contact_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_user
    ADD CONSTRAINT general_user_contact_no_key UNIQUE (contact_no);


--
-- Name: general_user general_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_user
    ADD CONSTRAINT general_user_email_key UNIQUE (email);


--
-- Name: general_user general_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_user
    ADD CONSTRAINT general_user_pkey PRIMARY KEY (id);


--
-- Name: general_user general_user_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_user
    ADD CONSTRAINT general_user_username_key UNIQUE (username);


--
-- Name: message message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: order_item order_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_pkey PRIMARY KEY (id);


--
-- Name: order order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_pkey PRIMARY KEY (id);


--
-- Name: points_transaction points_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transaction
    ADD CONSTRAINT points_transaction_pkey PRIMARY KEY (id);


--
-- Name: product_attribute product_attribute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute
    ADD CONSTRAINT product_attribute_pkey PRIMARY KEY (id);


--
-- Name: product_category product_category_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_name_key UNIQUE (name);


--
-- Name: product_category product_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_pkey PRIMARY KEY (id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: product_qa product_qa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_qa
    ADD CONSTRAINT product_qa_pkey PRIMARY KEY (id);


--
-- Name: promo promo_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo
    ADD CONSTRAINT promo_name_key UNIQUE (name);


--
-- Name: promo promo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo
    ADD CONSTRAINT promo_pkey PRIMARY KEY (id);


--
-- Name: promotion_usage promotion_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: qa_answer qa_answer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_answer
    ADD CONSTRAINT qa_answer_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: review review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review
    ADD CONSTRAINT review_pkey PRIMARY KEY (id);


--
-- Name: shipping_address shipping_address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_address
    ADD CONSTRAINT shipping_address_pkey PRIMARY KEY (id);


--
-- Name: template template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template
    ADD CONSTRAINT template_pkey PRIMARY KEY (id);


--
-- Name: template_product template_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_product
    ADD CONSTRAINT template_product_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_code_key UNIQUE (code);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: wishlist wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_pkey PRIMARY KEY (customer_id, product_id);


--
-- Name: idx_access_levels_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_levels_name ON public.access_levels USING btree (access_name);


--
-- Name: idx_admin_clearance_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_clearance_level ON public.admin_users USING btree (clearance_level);


--
-- Name: idx_admin_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_logs_created_at ON public.admin_logs USING btree (created_at);


--
-- Name: idx_admin_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_user_id ON public.admin USING btree (user_id);


--
-- Name: idx_admin_users_clearance_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_clearance_level ON public.admin_users USING btree (clearance_level);


--
-- Name: idx_admin_users_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_user_id ON public.admin_users USING btree (user_id);


--
-- Name: idx_build_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_customer_id ON public.build USING btree (customer_id);


--
-- Name: idx_build_product_build_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_product_build_id ON public.build_product USING btree (build_id);


--
-- Name: idx_build_product_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_product_product_id ON public.build_product USING btree (product_id);


--
-- Name: idx_build_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_template_id ON public.build USING btree (template_id);


--
-- Name: idx_cart_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_customer_id ON public.cart USING btree (customer_id);


--
-- Name: idx_cart_item_cart_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_item_cart_id ON public.cart_item USING btree (cart_id);


--
-- Name: idx_cart_item_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_item_product_id ON public.cart_item USING btree (product_id);


--
-- Name: idx_compatibility_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compatibility_rules_active ON public.compatibility_rules USING btree (is_active);


--
-- Name: idx_compatibility_rules_category1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compatibility_rules_category1 ON public.compatibility_rules USING btree (category1_id);


--
-- Name: idx_compatibility_rules_category2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compatibility_rules_category2 ON public.compatibility_rules USING btree (category2_id);


--
-- Name: idx_conversation_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_assigned_to ON public.conversation USING btree (assigned_to);


--
-- Name: idx_conversation_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_created_by ON public.conversation USING btree (created_by);


--
-- Name: idx_conversation_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_last_message ON public.conversation USING btree (last_message_at);


--
-- Name: idx_conversation_participant_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participant_conversation ON public.conversation_participant USING btree (conversation_id);


--
-- Name: idx_conversation_participant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participant_user ON public.conversation_participant USING btree (user_id);


--
-- Name: idx_conversation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_status ON public.conversation USING btree (status);


--
-- Name: idx_conversation_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_type ON public.conversation USING btree (type);


--
-- Name: idx_customer_points_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_points_customer_id ON public.customer_points USING btree (customer_id);


--
-- Name: idx_customer_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_user_id ON public.customer USING btree (user_id);


--
-- Name: idx_message_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_conversation_id ON public.message USING btree (conversation_id);


--
-- Name: idx_message_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_priority ON public.message USING btree (priority);


--
-- Name: idx_message_receiver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_receiver_id ON public.message USING btree (receiver_id);


--
-- Name: idx_message_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_sender_id ON public.message USING btree (sender_id);


--
-- Name: idx_message_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_status ON public.message USING btree (message_status);


--
-- Name: idx_notification_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_category ON public.notification USING btree (category);


--
-- Name: idx_notification_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_expires_at ON public.notification USING btree (expires_at);


--
-- Name: idx_notification_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_priority ON public.notification USING btree (priority);


--
-- Name: idx_notification_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_user_id ON public.notification USING btree (user_id);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.admin_notifications USING btree (is_read);


--
-- Name: idx_order_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_customer_id ON public."order" USING btree (customer_id);


--
-- Name: idx_order_item_build_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_item_build_id ON public.order_item USING btree (build_id);


--
-- Name: idx_order_item_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_item_order_id ON public.order_item USING btree (order_id);


--
-- Name: idx_order_item_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_item_product_id ON public.order_item USING btree (product_id);


--
-- Name: idx_order_promo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_promo_id ON public."order" USING btree (promo_id);


--
-- Name: idx_points_transaction_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_transaction_customer_id ON public.points_transaction USING btree (customer_id);


--
-- Name: idx_points_transaction_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_transaction_type ON public.points_transaction USING btree (transaction_type);


--
-- Name: idx_product_attribute_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_attribute_product_id ON public.product_attribute USING btree (product_id);


--
-- Name: idx_product_attribute_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_attribute_stock ON public.product_attribute USING btree (stock);


--
-- Name: idx_product_availability; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_availability ON public.product USING btree (availability);


--
-- Name: idx_product_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_category_id ON public.product USING btree (category_id);


--
-- Name: idx_product_qa_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_qa_customer_id ON public.product_qa USING btree (customer_id);


--
-- Name: idx_product_qa_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_qa_priority ON public.product_qa USING btree (priority);


--
-- Name: idx_product_qa_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_qa_product_id ON public.product_qa USING btree (product_id);


--
-- Name: idx_product_qa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_qa_status ON public.product_qa USING btree (status);


--
-- Name: idx_product_specs_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_specs_gin ON public.product USING gin (specs);


--
-- Name: idx_qa_answer_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_answer_admin_id ON public.qa_answer USING btree (admin_id);


--
-- Name: idx_qa_answer_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_answer_published ON public.qa_answer USING btree (is_published);


--
-- Name: idx_qa_answer_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_answer_question_id ON public.qa_answer USING btree (question_id);


--
-- Name: idx_ratings_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_created_at ON public.ratings USING btree (created_at);


--
-- Name: idx_ratings_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_order_id ON public.ratings USING btree (order_id);


--
-- Name: idx_ratings_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_product_id ON public.ratings USING btree (product_id);


--
-- Name: idx_ratings_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_rating ON public.ratings USING btree (rating);


--
-- Name: idx_ratings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_user_id ON public.ratings USING btree (user_id);


--
-- Name: idx_review_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_customer_id ON public.review USING btree (customer_id);


--
-- Name: idx_review_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_product_id ON public.review USING btree (product_id);


--
-- Name: idx_shipping_address_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_address_customer_id ON public.shipping_address USING btree (customer_id);


--
-- Name: idx_signup_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signup_requests_status ON public.admin_signup_requests USING btree (status);


--
-- Name: idx_template_product_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_product_product_id ON public.template_product USING btree (product_id);


--
-- Name: idx_template_product_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_product_template_id ON public.template_product USING btree (template_id);


--
-- Name: idx_vouchers_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_code ON public.vouchers USING btree (code);


--
-- Name: idx_vouchers_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_customer_id ON public.vouchers USING btree (customer_id);


--
-- Name: idx_vouchers_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_expires_at ON public.vouchers USING btree (expires_at);


--
-- Name: idx_vouchers_is_redeemed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_is_redeemed ON public.vouchers USING btree (is_redeemed);


--
-- Name: cart_item cart_stock_check_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cart_stock_check_trigger BEFORE INSERT OR UPDATE OF quantity ON public.cart_item FOR EACH ROW EXECUTE FUNCTION public.check_cart_stock();


--
-- Name: order_item order_item_stock_check_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_item_stock_check_trigger BEFORE INSERT OR UPDATE OF quantity ON public.order_item FOR EACH ROW EXECUTE FUNCTION public.check_order_stock();


--
-- Name: order order_stock_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_stock_trigger AFTER INSERT OR UPDATE OF status ON public."order" FOR EACH ROW EXECUTE FUNCTION public.handle_order_stock();


--
-- Name: product_attribute stock_availability_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stock_availability_trigger AFTER INSERT OR UPDATE OF stock ON public.product_attribute FOR EACH ROW EXECUTE FUNCTION public.update_product_availability();


--
-- Name: access_levels trg_access_levels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_access_levels_updated_at BEFORE UPDATE ON public.access_levels FOR EACH ROW EXECUTE FUNCTION public.update_access_levels_updated_at();


--
-- Name: admin trg_admin_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admin_updated_at BEFORE UPDATE ON public.admin FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_users trg_admin_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.update_admin_users_updated_at();


--
-- Name: order trg_award_points_for_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_points_for_order AFTER UPDATE OF status ON public."order" FOR EACH ROW WHEN ((((new.status)::text = 'delivered'::text) AND ((old.status)::text <> 'delivered'::text))) EXECUTE FUNCTION public.award_points_for_order();


--
-- Name: build trg_build_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_build_updated_at BEFORE UPDATE ON public.build FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cart trg_cart_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cart_updated_at BEFORE UPDATE ON public.cart FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversation trg_conversation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_conversation_updated_at BEFORE UPDATE ON public.conversation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customer trg_customer_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_updated_at BEFORE UPDATE ON public.customer FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: general_user trg_general_user_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_general_user_updated_at BEFORE UPDATE ON public.general_user FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: order trg_notify_order_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_order_status_change AFTER UPDATE ON public."order" FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();


--
-- Name: qa_answer trg_notify_qa_answered; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_qa_answered AFTER INSERT ON public.qa_answer FOR EACH ROW EXECUTE FUNCTION public.notify_qa_answered();


--
-- Name: order trg_order_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_updated_at BEFORE UPDATE ON public."order" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_attribute trg_product_attribute_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_attribute_updated_at BEFORE UPDATE ON public.product_attribute FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_category trg_product_category_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_category_updated_at BEFORE UPDATE ON public.product_category FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_qa trg_product_qa_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_qa_updated_at BEFORE UPDATE ON public.product_qa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product trg_product_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_updated_at BEFORE UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: promo trg_promo_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_promo_updated_at BEFORE UPDATE ON public.promo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: qa_answer trg_qa_answer_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qa_answer_updated_at BEFORE UPDATE ON public.qa_answer FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ratings trg_ratings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ratings_updated_at BEFORE UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vouchers trg_redeem_voucher; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_redeem_voucher AFTER UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.redeem_voucher();


--
-- Name: shipping_address trg_shipping_address_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shipping_address_updated_at BEFORE UPDATE ON public.shipping_address FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_signup_requests trg_signup_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_signup_requests_updated_at BEFORE UPDATE ON public.admin_signup_requests FOR EACH ROW EXECUTE FUNCTION public.update_signup_requests_updated_at();


--
-- Name: template trg_template_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_template_updated_at BEFORE UPDATE ON public.template FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: message trg_update_conversation_last_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_conversation_last_message AFTER INSERT ON public.message FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: ratings trg_validate_rating_eligibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_rating_eligibility BEFORE INSERT OR UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.validate_rating_eligibility();


--
-- Name: admin_logs admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(admin_id);


--
-- Name: admin_notifications admin_notifications_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(admin_id);


--
-- Name: admin_signup_requests admin_signup_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_signup_requests
    ADD CONSTRAINT admin_signup_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.admin_users(admin_id);


--
-- Name: admin admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: build build_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build
    ADD CONSTRAINT build_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: build_product build_product_build_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_product
    ADD CONSTRAINT build_product_build_id_fkey FOREIGN KEY (build_id) REFERENCES public.build(id) ON DELETE CASCADE;


--
-- Name: build_product build_product_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_product
    ADD CONSTRAINT build_product_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: build build_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build
    ADD CONSTRAINT build_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.template(id) ON DELETE SET NULL;


--
-- Name: cart cart_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: cart_item cart_item_build_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_item
    ADD CONSTRAINT cart_item_build_id_fkey FOREIGN KEY (build_id) REFERENCES public.build(id) ON DELETE CASCADE;


--
-- Name: cart_item cart_item_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_item
    ADD CONSTRAINT cart_item_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.cart(id) ON DELETE CASCADE;


--
-- Name: cart_item cart_item_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_item
    ADD CONSTRAINT cart_item_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: compatibility_rules compatibility_rules_category1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compatibility_rules
    ADD CONSTRAINT compatibility_rules_category1_id_fkey FOREIGN KEY (category1_id) REFERENCES public.product_category(id) ON DELETE CASCADE;


--
-- Name: compatibility_rules compatibility_rules_category2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compatibility_rules
    ADD CONSTRAINT compatibility_rules_category2_id_fkey FOREIGN KEY (category2_id) REFERENCES public.product_category(id) ON DELETE CASCADE;


--
-- Name: conversation conversation_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.general_user(id) ON DELETE SET NULL;


--
-- Name: conversation conversation_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: conversation_participant conversation_participant_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant
    ADD CONSTRAINT conversation_participant_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;


--
-- Name: conversation_participant conversation_participant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant
    ADD CONSTRAINT conversation_participant_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: customer_points customer_points_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_points
    ADD CONSTRAINT customer_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: customer customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: admin_users fk_admin_clearance_level; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT fk_admin_clearance_level FOREIGN KEY (clearance_level) REFERENCES public.access_levels(access_level);


--
-- Name: admin_users fk_admin_users_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT fk_admin_users_user_id FOREIGN KEY (user_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: admin_signup_requests fk_signup_assigned_clearance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_signup_requests
    ADD CONSTRAINT fk_signup_assigned_clearance FOREIGN KEY (assigned_clearance) REFERENCES public.access_levels(access_level);


--
-- Name: admin_signup_requests fk_signup_requested_clearance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_signup_requests
    ADD CONSTRAINT fk_signup_requested_clearance FOREIGN KEY (requested_clearance) REFERENCES public.access_levels(access_level);


--
-- Name: message message_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.message(id) ON DELETE SET NULL;


--
-- Name: message message_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: message message_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: notification notification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: order order_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: order_item order_item_build_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_build_id_fkey FOREIGN KEY (build_id) REFERENCES public.build(id) ON DELETE SET NULL;


--
-- Name: order_item order_item_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE CASCADE;


--
-- Name: order_item order_item_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE SET NULL;


--
-- Name: order order_promo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES public.promotions(id) ON DELETE SET NULL;


--
-- Name: order order_shipping_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_shipping_address_id_fkey FOREIGN KEY (shipping_address_id) REFERENCES public.shipping_address(id) ON DELETE CASCADE;


--
-- Name: points_transaction points_transaction_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transaction
    ADD CONSTRAINT points_transaction_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: points_transaction points_transaction_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transaction
    ADD CONSTRAINT points_transaction_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL;


--
-- Name: points_transaction points_transaction_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transaction
    ADD CONSTRAINT points_transaction_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;


--
-- Name: product_attribute product_attribute_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute
    ADD CONSTRAINT product_attribute_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: product product_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_category(id) ON DELETE CASCADE;


--
-- Name: product_qa product_qa_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_qa
    ADD CONSTRAINT product_qa_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: product_qa product_qa_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_qa
    ADD CONSTRAINT product_qa_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: promotion_usage promotion_usage_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(admin_id);


--
-- Name: qa_answer qa_answer_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_answer
    ADD CONSTRAINT qa_answer_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(admin_id) ON DELETE SET NULL;


--
-- Name: qa_answer qa_answer_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_answer
    ADD CONSTRAINT qa_answer_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.product_qa(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL;


--
-- Name: ratings ratings_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_item(id) ON DELETE SET NULL;


--
-- Name: ratings ratings_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.general_user(id) ON DELETE CASCADE;


--
-- Name: review review_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review
    ADD CONSTRAINT review_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: review review_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review
    ADD CONSTRAINT review_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: shipping_address shipping_address_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_address
    ADD CONSTRAINT shipping_address_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: template_product template_product_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_product
    ADD CONSTRAINT template_product_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: template_product template_product_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_product
    ADD CONSTRAINT template_product_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.template(id) ON DELETE CASCADE;


--
-- Name: vouchers vouchers_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: vouchers vouchers_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL;


--
-- Name: wishlist wishlist_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: wishlist wishlist_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;



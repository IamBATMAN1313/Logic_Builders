-- =====================================================
-- Database Updates - Safe Schema Changes
-- Adding missing tables, functions, and indexes
-- =====================================================

-- Enable UUID extension (safe - will not error if exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Add missing tables (using IF NOT EXISTS for safety)

-- Product Q&A table
CREATE TABLE IF NOT EXISTS public.product_qa (
    id SERIAL PRIMARY KEY,
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

-- Q&A answers table
CREATE TABLE IF NOT EXISTS public.qa_answer (
    id SERIAL PRIMARY KEY,
    question_id integer NOT NULL,
    answer_text text,
    time_answered timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    admin_id uuid,
    is_published boolean DEFAULT false,
    send_to_customer boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversation (
    id SERIAL PRIMARY KEY,
    title character varying(255) NOT NULL,
    type character varying(50) DEFAULT 'support'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    priority character varying(10) DEFAULT 'normal'::character varying,
    created_by uuid NOT NULL,
    assigned_to uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_message_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT conversation_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT conversation_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'closed'::character varying, 'pending'::character varying, 'resolved'::character varying])::text[]))),
    CONSTRAINT conversation_type_check CHECK (((type)::text = ANY ((ARRAY['support'::character varying, 'inquiry'::character varying, 'complaint'::character varying, 'feedback'::character varying])::text[])))
);

-- Conversation participants table
CREATE TABLE IF NOT EXISTS public.conversation_participant (
    id SERIAL PRIMARY KEY,
    conversation_id integer NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role character varying(20) DEFAULT 'participant'::character varying,
    CONSTRAINT conversation_participant_role_check CHECK (((role)::text = ANY ((ARRAY['participant'::character varying, 'admin'::character varying, 'observer'::character varying])::text[])))
);

-- Advanced promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
    id SERIAL PRIMARY KEY,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type character varying(20) NOT NULL,
    value numeric(10,2) NOT NULL,
    min_order_amount numeric(10,2) DEFAULT 0,
    max_discount_amount numeric(10,2),
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    usage_limit integer,
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT promotions_type_check CHECK (((type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying, 'free_shipping'::character varying])::text[])))
);

-- Promotion usage tracking
CREATE TABLE IF NOT EXISTS public.promotion_usage (
    id SERIAL PRIMARY KEY,
    promotion_id integer NOT NULL,
    user_id uuid NOT NULL,
    order_id integer,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    discount_amount numeric(10,2)
);

-- Wishlist table
CREATE TABLE IF NOT EXISTS public.wishlist (
    customer_id uuid NOT NULL,
    product_id integer NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT wishlist_pkey PRIMARY KEY (customer_id, product_id)
);

-- Template table
CREATE TABLE IF NOT EXISTS public.template (
    id SERIAL PRIMARY KEY,
    name character varying(100) NOT NULL,
    description text,
    category character varying(50),
    price_range character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Template products table
CREATE TABLE IF NOT EXISTS public.template_product (
    id SERIAL PRIMARY KEY,
    template_id integer NOT NULL,
    product_id integer NOT NULL,
    component_type character varying(50) NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT template_product_quantity_check CHECK ((quantity > 0))
);

-- Add missing columns to existing tables (safe operations)
DO $$ 
BEGIN
    -- Add conversation_id to message table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message' AND column_name = 'conversation_id') THEN
        ALTER TABLE public.message ADD COLUMN conversation_id integer;
    END IF;

    -- Add specs column to product table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product' AND column_name = 'specs') THEN
        ALTER TABLE public.product ADD COLUMN specs jsonb DEFAULT '{}'::jsonb;
    END IF;

    -- Add data column to notification table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'data') THEN
        ALTER TABLE public.notification ADD COLUMN data jsonb DEFAULT '{}'::jsonb;
    END IF;

    -- Add priority column to notification table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'priority') THEN
        ALTER TABLE public.notification ADD COLUMN priority character varying(10) DEFAULT 'normal'::character varying;
    END IF;

END $$;

-- Add foreign keys safely (only if they don't already exist)
DO $$
BEGIN
    -- Add FK constraints only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_qa_customer_id_fkey') THEN
        ALTER TABLE public.product_qa ADD CONSTRAINT product_qa_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_qa_product_id_fkey') THEN
        ALTER TABLE public.product_qa ADD CONSTRAINT product_qa_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'qa_answer_question_id_fkey') THEN
        ALTER TABLE public.qa_answer ADD CONSTRAINT qa_answer_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.product_qa(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'qa_answer_admin_id_fkey') THEN
        ALTER TABLE public.qa_answer ADD CONSTRAINT qa_answer_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(admin_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create or replace functions
CREATE OR REPLACE FUNCTION public.notify_qa_answered() RETURNS trigger
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

-- Create triggers safely
DO $$
BEGIN
    -- Drop and recreate Q&A trigger
    DROP TRIGGER IF EXISTS trg_notify_qa_answered ON public.qa_answer;
    CREATE TRIGGER trg_notify_qa_answered 
        AFTER INSERT ON public.qa_answer 
        FOR EACH ROW EXECUTE FUNCTION public.notify_qa_answered();
END $$;

-- Create important indexes if they don't exist
DO $$
BEGIN
    -- Create indexes only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_product_qa_status') THEN
        CREATE INDEX idx_product_qa_status ON public.product_qa USING btree (status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_product_qa_priority') THEN
        CREATE INDEX idx_product_qa_priority ON public.product_qa USING btree (priority);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_qa_answer_published') THEN
        CREATE INDEX idx_qa_answer_published ON public.qa_answer USING btree (is_published);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_product_specs_gin') THEN
        CREATE INDEX idx_product_specs_gin ON public.product USING gin (specs);
    END IF;
END $$;

-- Insert access levels data safely
INSERT INTO public.access_levels (access_level, access_name, description) VALUES
(0, 'General Manager', 'Highest level of access - can manage all aspects of the system'),
(2, 'Inventory Manager', 'Can manage inventory and stock levels'),
(3, 'Product Manager', 'Manages product catalog, pricing, and product-related operations'),
(4, 'Order Manager', 'Can manage orders and delivery status'),
(5, 'Promotion Manager', 'Can manage promotions and discounts'),
(6, 'Analytics Specialist', 'Can view and analyze system data')
ON CONFLICT (access_level) DO NOTHING;

-- Success message
SELECT 'Database schema updates completed successfully!' as result;

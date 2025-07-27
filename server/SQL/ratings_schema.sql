-- ============================================================================
-- RATINGS SYSTEM SCHEMA
-- Allow users to rate products only after they have been shipped
-- ============================================================================

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id           SERIAL    PRIMARY KEY,
  user_id      UUID      NOT NULL REFERENCES general_user(id) ON DELETE CASCADE,
  product_id   INTEGER   NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  order_id     INTEGER   NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  order_item_id INTEGER  NOT NULL REFERENCES order_item(id) ON DELETE CASCADE,
  rating       INTEGER   NOT NULL CHECK (rating >= 0 AND rating <= 10),
  review_text  TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one rating per user per product per order
  UNIQUE(user_id, product_id, order_item_id)
);

-- Add trigger for updated_at
CREATE OR REPLACE TRIGGER trg_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_ratings_user_id ON ratings(user_id);
CREATE INDEX idx_ratings_product_id ON ratings(product_id);
CREATE INDEX idx_ratings_order_id ON ratings(order_id);
CREATE INDEX idx_ratings_rating ON ratings(rating);
CREATE INDEX idx_ratings_created_at ON ratings(created_at);

-- Add a trigger to ensure users can only rate products from delivered orders
CREATE OR REPLACE FUNCTION validate_rating_eligibility()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validate_rating_eligibility
  BEFORE INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE PROCEDURE validate_rating_eligibility();

-- View to get average ratings per product
CREATE OR REPLACE VIEW product_ratings_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  COALESCE(ROUND(AVG(r.rating::NUMERIC), 1), 0) as average_rating,
  COUNT(r.rating) as total_ratings,
  COUNT(DISTINCT r.user_id) as unique_reviewers
FROM product p
LEFT JOIN ratings r ON p.id = r.product_id
GROUP BY p.id, p.name;

-- View to get user's ratable products (delivered but not yet rated)
-- Includes both direct products and products from builds
CREATE OR REPLACE VIEW user_ratable_products AS
-- Direct products from order items
SELECT DISTINCT
  c.user_id,
  oi.product_id,
  p.name as product_name,
  p.image_url,
  oi.id as order_item_id,
  o.id as order_id,
  o.order_date,
  o.status as order_status,
  'product' as item_type
FROM "order" o
JOIN customer c ON o.customer_id = c.id
JOIN order_item oi ON o.id = oi.order_id
JOIN product p ON oi.product_id = p.id
WHERE o.status = 'delivered'
  AND oi.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ratings r 
    WHERE r.user_id = c.user_id 
      AND r.product_id = oi.product_id 
      AND r.order_item_id = oi.id
  )

UNION

-- Products from builds in order items
SELECT DISTINCT
  c.user_id,
  bp.product_id,
  p.name as product_name,
  p.image_url,
  oi.id as order_item_id,
  o.id as order_id,
  o.order_date,
  o.status as order_status,
  'build' as item_type
FROM "order" o
JOIN customer c ON o.customer_id = c.id
JOIN order_item oi ON o.id = oi.order_id
JOIN build b ON oi.build_id = b.id
JOIN build_product bp ON b.id = bp.build_id
JOIN product p ON bp.product_id = p.id
WHERE o.status = 'delivered'
  AND oi.build_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ratings r 
    WHERE r.user_id = c.user_id 
      AND r.product_id = bp.product_id 
      AND r.order_item_id = oi.id
  );

-- View to get user's existing ratings
CREATE OR REPLACE VIEW user_ratings AS
SELECT 
  r.id,
  r.user_id,
  r.product_id,
  p.name as product_name,
  p.image_url,
  r.rating,
  r.review_text,
  r.created_at,
  r.updated_at,
  o.order_date
FROM ratings r
JOIN product p ON r.product_id = p.id
JOIN "order" o ON r.order_id = o.id
ORDER BY r.created_at DESC;

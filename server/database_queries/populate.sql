/*ALTER TABLE product
 ADD COLUMN specs JSONB DEFAULT '{}'::JSONB;

CREATE INDEX idx_product_specs_gin
  ON product
  USING GIN (specs);*/


/*CREATE TABLE order_item (
  id           SERIAL    PRIMARY KEY,
  order_id     INTEGER   NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  product_id   INTEGER   REFERENCES product(id) ON DELETE SET NULL,
  build_id     INTEGER   REFERENCES build(id) ON DELETE SET NULL,
  quantity     INTEGER   NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price  NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (product_id IS NOT NULL AND build_id IS NULL)
    OR
    (product_id IS NULL AND build_id IS NOT NULL)
  )
);

CREATE INDEX idx_order_item_order_id ON order_item(order_id);
CREATE INDEX idx_order_item_product_id ON order_item(product_id);
CREATE INDEX idx_order_item_build_id ON order_item(build_id);*/



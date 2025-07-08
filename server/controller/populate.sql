/*ALTER TABLE product
 ADD COLUMN specs JSONB DEFAULT '{}'::JSONB;

CREATE INDEX idx_product_specs_gin
  ON product
  USING GIN (specs);*/


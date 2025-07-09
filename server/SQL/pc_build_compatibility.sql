-- Add name field to build table
ALTER TABLE build ADD COLUMN IF NOT EXISTS name VARCHAR(200) NOT NULL DEFAULT 'Untitled Build';

-- Update existing builds to have proper names
UPDATE build SET name = 'Build #' || id WHERE name = 'Untitled Build';

-- Create compatibility rules table
CREATE TABLE IF NOT EXISTS compatibility_rules (
  id SERIAL PRIMARY KEY,
  rule_type VARCHAR(50) NOT NULL,
  category1_id INTEGER REFERENCES product_category(id),
  category2_id INTEGER REFERENCES product_category(id),
  spec1_field VARCHAR(100),
  spec2_field VARCHAR(100),
  rule_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert basic compatibility rules
INSERT INTO compatibility_rules (rule_type, category1_id, category2_id, spec1_field, spec2_field, rule_description) VALUES
-- CPU-Motherboard socket compatibility
('socket_match', 7, 16, 'socket_/_cpu', 'socket_/_cpu', 'CPU socket must match motherboard socket'),
-- RAM-Motherboard type compatibility  
('ram_type', 13, 16, 'type', 'ram_type', 'RAM type must be supported by motherboard'),
-- Form factor compatibility (Motherboard-Case)
('form_factor', 16, 12, 'form_factor', 'form_factor_support', 'Motherboard form factor must fit in case'),
-- GPU interface compatibility
('gpu_interface', 8, 16, 'interface', 'expansion_slots', 'GPU interface must match motherboard slots'),
-- PSU wattage check (virtual - calculated)
('power_requirement', 15, NULL, 'wattage', NULL, 'PSU wattage must meet system requirements')
ON CONFLICT DO NOTHING;

-- Create build compatibility check function
CREATE OR REPLACE FUNCTION check_build_compatibility(p_build_id INTEGER)
RETURNS TABLE(
  rule_type VARCHAR(50),
  is_compatible BOOLEAN,
  error_message TEXT,
  conflicting_products TEXT[]
) AS $$
DECLARE
  cpu_socket TEXT;
  mb_socket TEXT;
  cpu_name TEXT;
  mb_name TEXT;
  mb_max_ram INTEGER;
  mb_ram_slots INTEGER;
  mb_form_factor TEXT;
  case_form_factor_support TEXT;
  case_name TEXT;
  psu_wattage INTEGER;
  psu_name TEXT;
  total_ram_capacity INTEGER := 0;
  total_ram_modules INTEGER := 0;
  estimated_power INTEGER := 100; -- Base system power
BEGIN
  -- Get CPU info
  SELECT p.name, p.specs->>'socket_/_cpu'
  INTO cpu_name, cpu_socket
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.category_name = 'CPU'
  LIMIT 1;

  -- Get Motherboard info
  SELECT p.name, p.specs->>'socket_/_cpu', p.specs->>'form_factor',
         COALESCE((regexp_replace(p.specs->>'max_ram', '[^0-9]', '', 'g'))::INTEGER, 0),
         COALESCE((p.specs->>'ram_slots')::INTEGER, 0)
  INTO mb_name, mb_socket, mb_form_factor, mb_max_ram, mb_ram_slots
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.category_name = 'Motherboard'
  LIMIT 1;

  -- Get Case info
  SELECT p.name, p.specs->>'form_factor_support'
  INTO case_name, case_form_factor_support
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.category_name = 'Case'
  LIMIT 1;

  -- Get PSU info and estimate power
  SELECT p.name, COALESCE((regexp_replace(p.specs->>'wattage', '[^0-9]', '', 'g'))::INTEGER, 0)
  INTO psu_name, psu_wattage
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.category_name = 'PSU'
  LIMIT 1;

  -- Calculate total RAM
  SELECT COALESCE(SUM(
    CASE 
      WHEN p.specs->>'capacity' IS NOT NULL 
      THEN (regexp_replace(p.specs->>'capacity', '[^0-9]', '', 'g'))::INTEGER * bp.quantity
      ELSE 0
    END
  ), 0), COALESCE(SUM(bp.quantity), 0)
  INTO total_ram_capacity, total_ram_modules
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.category_name = 'RAM';

  -- Add power consumption estimates
  SELECT estimated_power + COALESCE(SUM(
    CASE 
      WHEN p.specs->>'tdp' IS NOT NULL 
      THEN (regexp_replace(p.specs->>'tdp', '[^0-9]', '', 'g'))::INTEGER
      ELSE 0
    END
  ), 0)
  INTO estimated_power
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.category_name = 'CPU';

  -- Add GPU power (estimate 150W if not specified)
  SELECT estimated_power + COALESCE(SUM(
    CASE 
      WHEN p.specs->>'power_consumption' IS NOT NULL 
      THEN (regexp_replace(p.specs->>'power_consumption', '[^0-9]', '', 'g'))::INTEGER
      ELSE 150 -- Default GPU power estimate
    END
  ), 0)
  INTO estimated_power
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.category_name = 'GPU';

  -- Check 1: CPU-Motherboard socket compatibility
  IF cpu_socket IS NOT NULL AND mb_socket IS NOT NULL AND cpu_socket != mb_socket THEN
    rule_type := 'socket_mismatch';
    is_compatible := false;
    error_message := format('CPU socket (%s) does not match motherboard socket (%s)', cpu_socket, mb_socket);
    conflicting_products := ARRAY[cpu_name, mb_name];
    RETURN NEXT;
  END IF;

  -- Check 2: RAM capacity vs motherboard limit
  IF mb_max_ram > 0 AND total_ram_capacity > mb_max_ram THEN
    rule_type := 'ram_capacity_exceeded';
    is_compatible := false;
    error_message := format('Total RAM capacity (%s GB) exceeds motherboard limit (%s GB)', total_ram_capacity, mb_max_ram);
    conflicting_products := ARRAY[mb_name];
    RETURN NEXT;
  END IF;

  -- Check 3: RAM slot count
  IF mb_ram_slots > 0 AND total_ram_modules > mb_ram_slots THEN
    rule_type := 'ram_slots_exceeded';
    is_compatible := false;
    error_message := format('Total RAM modules (%s) exceeds available slots (%s)', total_ram_modules, mb_ram_slots);
    conflicting_products := ARRAY[mb_name];
    RETURN NEXT;
  END IF;

  -- Check 4: Form factor compatibility
  IF mb_form_factor IS NOT NULL AND case_form_factor_support IS NOT NULL THEN
    IF position(mb_form_factor in case_form_factor_support) = 0 THEN
      rule_type := 'form_factor_incompatible';
      is_compatible := false;
      error_message := format('Motherboard form factor (%s) not supported by case (%s)', mb_form_factor, case_form_factor_support);
      conflicting_products := ARRAY[mb_name, case_name];
      RETURN NEXT;
    END IF;
  END IF;

  -- Check 5: Power requirements
  IF psu_wattage > 0 THEN
    DECLARE
      required_wattage INTEGER := estimated_power * 1.2; -- 20% headroom
    BEGIN
      IF psu_wattage < required_wattage THEN
        rule_type := 'insufficient_power';
        is_compatible := false;
        error_message := format('PSU wattage (%s W) insufficient for estimated system consumption (%s W with 20%% headroom)', psu_wattage, required_wattage);
        conflicting_products := ARRAY[psu_name];
        RETURN NEXT;
      END IF;
    END;
  END IF;

  -- Return success if no issues found
  IF NOT FOUND THEN
    rule_type := 'all_compatible';
    is_compatible := true;
    error_message := 'All components are compatible';
    conflicting_products := ARRAY[]::TEXT[];
    RETURN NEXT;
  END IF;

END;
$$ LANGUAGE plpgsql;

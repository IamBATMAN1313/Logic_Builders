-- Comprehensive PC Build Compatibility Check System
-- This function checks all possible compatibility issues between PC components

-- Drop existing function and rules to recreate
DROP FUNCTION IF EXISTS check_build_compatibility(INTEGER);
DROP TABLE IF EXISTS compatibility_rules CASCADE;

-- Create compatibility rules table for future extensibility
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

-- Insert basic compatibility rules for reference
INSERT INTO compatibility_rules (rule_type, category1_id, category2_id, spec1_field, spec2_field, rule_description) VALUES
-- CPU-Motherboard socket compatibility
(
  'socket_match',
  (SELECT id FROM product_category WHERE name = 'CPU' LIMIT 1),
  (SELECT id FROM product_category WHERE name = 'Motherboard' LIMIT 1),
  'socket_/_cpu', 'socket_/_cpu',
  'CPU socket must match motherboard socket'
),
-- RAM-Motherboard type compatibility
(
  'ram_type',
  (SELECT id FROM product_category WHERE name = 'RAM' LIMIT 1),
  (SELECT id FROM product_category WHERE name = 'Motherboard' LIMIT 1),
  'type', 'ram_type',
  'RAM type must be supported by motherboard'
),
-- Form factor compatibility (Motherboard-Case)
(
  'form_factor',
  (SELECT id FROM product_category WHERE name = 'Motherboard' LIMIT 1),
  (SELECT id FROM product_category WHERE name = 'Case' LIMIT 1),
  'form_factor', 'form_factor_support',
  'Motherboard form factor must fit in case'
),
-- GPU interface compatibility
(
  'gpu_interface',
  (SELECT id FROM product_category WHERE name = 'GPU' LIMIT 1),
  (SELECT id FROM product_category WHERE name = 'Motherboard' LIMIT 1),
  'interface', 'expansion_slots',
  'GPU interface must match motherboard slots'
),
-- PSU wattage check
(
  'power_requirement',
  (SELECT id FROM product_category WHERE name = 'PSU' LIMIT 1),
  NULL, 'wattage', NULL,
  'PSU wattage must meet system requirements'
)
ON CONFLICT DO NOTHING;

-- Create comprehensive build compatibility check function
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
  mb_ram_type TEXT;
  mb_form_factor TEXT;
  case_form_factor_support TEXT;
  case_name TEXT;
  psu_wattage INTEGER;
  psu_name TEXT;
  total_ram_capacity INTEGER := 0;
  total_ram_modules INTEGER := 0;
  estimated_power INTEGER := 100; -- Base system power
  gpu_interface TEXT;
  gpu_name TEXT;
  mb_expansion_slots TEXT;
  ram_type TEXT;
  cpu_cooler_socket TEXT;
  cpu_cooler_name TEXT;
  case_max_gpu_length INTEGER;
  gpu_length INTEGER;
  case_cpu_cooler_clearance INTEGER;
  cpu_cooler_height INTEGER;
BEGIN
  -- Get CPU info
  SELECT p.name, 
         COALESCE(p.specs->>'socket_/_cpu', p.specs->>'socket'),
         COALESCE(p.specs->>'tdp', '0')
  INTO cpu_name, cpu_socket, estimated_power
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.name = 'CPU'
  LIMIT 1;
  
  -- Convert CPU TDP to integer
  IF cpu_socket IS NOT NULL THEN
    estimated_power := COALESCE((regexp_replace(estimated_power, '[^0-9]', '', 'g'))::INTEGER, 0) + 100;
  END IF;

  -- Get Motherboard info
  SELECT p.name, 
         COALESCE(p.specs->>'socket_/_cpu', p.specs->>'socket'),
         p.specs->>'form_factor',
         COALESCE((regexp_replace(COALESCE(p.specs->>'max_ram', '0'), '[^0-9]', '', 'g'))::INTEGER, 0),
         COALESCE((p.specs->>'ram_slots')::INTEGER, 0),
         p.specs->>'ram_type',
         p.specs->>'expansion_slots'
  INTO mb_name, mb_socket, mb_form_factor, mb_max_ram, mb_ram_slots, mb_ram_type, mb_expansion_slots
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.name = 'Motherboard'
  LIMIT 1;

  -- Get Case info
  SELECT p.name, 
         p.specs->>'form_factor_support',
         COALESCE((regexp_replace(COALESCE(p.specs->>'max_gpu_length', '0'), '[^0-9]', '', 'g'))::INTEGER, 0),
         COALESCE((regexp_replace(COALESCE(p.specs->>'cpu_cooler_clearance', '0'), '[^0-9]', '', 'g'))::INTEGER, 0)
  INTO case_name, case_form_factor_support, case_max_gpu_length, case_cpu_cooler_clearance
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.name = 'Case'
  LIMIT 1;

  -- Get PSU info
  SELECT p.name, 
         COALESCE((regexp_replace(COALESCE(p.specs->>'wattage', '0'), '[^0-9]', '', 'g'))::INTEGER, 0)
  INTO psu_name, psu_wattage
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.name = 'PSU'
  LIMIT 1;

  -- Get GPU info and add to power calculation
  SELECT p.name,
         p.specs->>'interface',
         COALESCE((regexp_replace(COALESCE(p.specs->>'length', '0'), '[^0-9]', '', 'g'))::INTEGER, 0),
         COALESCE((regexp_replace(COALESCE(p.specs->>'power_consumption', '150'), '[^0-9]', '', 'g'))::INTEGER, 150)
  INTO gpu_name, gpu_interface, gpu_length, estimated_power
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.name = 'GPU'
  LIMIT 1;
  
  IF gpu_name IS NOT NULL THEN
    estimated_power := estimated_power + COALESCE((regexp_replace(COALESCE((SELECT p.specs->>'power_consumption' FROM build_product bp JOIN product p ON bp.product_id = p.id JOIN product_category pc ON p.category_id = pc.id WHERE bp.build_id = p_build_id AND pc.name = 'GPU' LIMIT 1), '150'), '[^0-9]', '', 'g'))::INTEGER, 150);
  END IF;

  -- Get CPU Cooler info
  SELECT p.name,
         p.specs->>'socket_compatibility',
         COALESCE((regexp_replace(COALESCE(p.specs->>'height', '0'), '[^0-9]', '', 'g'))::INTEGER, 0)
  INTO cpu_cooler_name, cpu_cooler_socket, cpu_cooler_height
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.name IN ('Cooler', 'CPU Cooler')
  LIMIT 1;

  -- Calculate total RAM and get RAM type
  SELECT COALESCE(SUM(
    CASE 
      WHEN p.specs->>'capacity' IS NOT NULL 
      THEN (regexp_replace(p.specs->>'capacity', '[^0-9]', '', 'g'))::INTEGER * bp.quantity
      ELSE 0
    END
  ), 0), 
  COALESCE(SUM(bp.quantity), 0),
  p.specs->>'type'
  INTO total_ram_capacity, total_ram_modules, ram_type
  FROM build_product bp
  JOIN product p ON bp.product_id = p.id
  JOIN product_category pc ON p.category_id = pc.id
  WHERE bp.build_id = p_build_id AND pc.name = 'RAM'
  GROUP BY p.specs->>'type'
  LIMIT 1;

  -- Add RAM power consumption (approximately 3W per module)
  estimated_power := estimated_power + (total_ram_modules * 3);

  -- Check 1: CPU-Motherboard socket compatibility
  IF cpu_socket IS NOT NULL AND mb_socket IS NOT NULL AND LOWER(cpu_socket) != LOWER(mb_socket) THEN
    rule_type := 'socket_mismatch';
    is_compatible := false;
    error_message := format('CPU socket (%s) does not match motherboard socket (%s)', cpu_socket, mb_socket);
    conflicting_products := ARRAY[COALESCE(cpu_name, 'CPU'), COALESCE(mb_name, 'Motherboard')];
    RETURN NEXT;
  END IF;

  -- Check 2: RAM type compatibility
  IF ram_type IS NOT NULL AND mb_ram_type IS NOT NULL AND LOWER(ram_type) != LOWER(mb_ram_type) THEN
    rule_type := 'ram_type_mismatch';
    is_compatible := false;
    error_message := format('RAM type (%s) not supported by motherboard (supports %s)', ram_type, mb_ram_type);
    conflicting_products := ARRAY[COALESCE(mb_name, 'Motherboard')];
    RETURN NEXT;
  END IF;

  -- Check 3: RAM capacity vs motherboard limit
  IF mb_max_ram > 0 AND total_ram_capacity > mb_max_ram THEN
    rule_type := 'ram_capacity_exceeded';
    is_compatible := false;
    error_message := format('Total RAM capacity (%s GB) exceeds motherboard limit (%s GB)', total_ram_capacity, mb_max_ram);
    conflicting_products := ARRAY[COALESCE(mb_name, 'Motherboard')];
    RETURN NEXT;
  END IF;

  -- Check 4: RAM slot count
  IF mb_ram_slots > 0 AND total_ram_modules > mb_ram_slots THEN
    rule_type := 'ram_slots_exceeded';
    is_compatible := false;
    error_message := format('Total RAM modules (%s) exceeds available slots (%s)', total_ram_modules, mb_ram_slots);
    conflicting_products := ARRAY[COALESCE(mb_name, 'Motherboard')];
    RETURN NEXT;
  END IF;

  -- Check 5: Motherboard form factor compatibility with case
  IF mb_form_factor IS NOT NULL AND case_form_factor_support IS NOT NULL THEN
    IF position(LOWER(mb_form_factor) in LOWER(case_form_factor_support)) = 0 THEN
      rule_type := 'form_factor_incompatible';
      is_compatible := false;
      error_message := format('Motherboard form factor (%s) not supported by case (%s)', mb_form_factor, case_form_factor_support);
      conflicting_products := ARRAY[COALESCE(mb_name, 'Motherboard'), COALESCE(case_name, 'Case')];
      RETURN NEXT;
    END IF;
  END IF;

  -- Check 6: GPU interface compatibility
  IF gpu_interface IS NOT NULL AND mb_expansion_slots IS NOT NULL THEN
    IF position(LOWER(gpu_interface) in LOWER(mb_expansion_slots)) = 0 THEN
      rule_type := 'gpu_interface_incompatible';
      is_compatible := false;
      error_message := format('GPU interface (%s) not supported by motherboard slots (%s)', gpu_interface, mb_expansion_slots);
      conflicting_products := ARRAY[COALESCE(gpu_name, 'GPU'), COALESCE(mb_name, 'Motherboard')];
      RETURN NEXT;
    END IF;
  END IF;

  -- Check 7: GPU length vs case clearance
  IF gpu_length > 0 AND case_max_gpu_length > 0 AND gpu_length > case_max_gpu_length THEN
    rule_type := 'gpu_length_exceeded';
    is_compatible := false;
    error_message := format('GPU length (%s mm) exceeds case clearance (%s mm)', gpu_length, case_max_gpu_length);
    conflicting_products := ARRAY[COALESCE(gpu_name, 'GPU'), COALESCE(case_name, 'Case')];
    RETURN NEXT;
  END IF;

  -- Check 8: CPU cooler socket compatibility
  IF cpu_cooler_socket IS NOT NULL AND cpu_socket IS NOT NULL THEN
    IF position(LOWER(cpu_socket) in LOWER(cpu_cooler_socket)) = 0 THEN
      rule_type := 'cpu_cooler_socket_incompatible';
      is_compatible := false;
      error_message := format('CPU cooler socket compatibility (%s) does not support CPU socket (%s)', cpu_cooler_socket, cpu_socket);
      conflicting_products := ARRAY[COALESCE(cpu_cooler_name, 'CPU Cooler'), COALESCE(cpu_name, 'CPU')];
      RETURN NEXT;
    END IF;
  END IF;

  -- Check 9: CPU cooler height vs case clearance
  IF cpu_cooler_height > 0 AND case_cpu_cooler_clearance > 0 AND cpu_cooler_height > case_cpu_cooler_clearance THEN
    rule_type := 'cpu_cooler_height_exceeded';
    is_compatible := false;
    error_message := format('CPU cooler height (%s mm) exceeds case clearance (%s mm)', cpu_cooler_height, case_cpu_cooler_clearance);
    conflicting_products := ARRAY[COALESCE(cpu_cooler_name, 'CPU Cooler'), COALESCE(case_name, 'Case')];
    RETURN NEXT;
  END IF;

  -- Check 10: Power requirements
  IF psu_wattage > 0 THEN
    DECLARE
      required_wattage INTEGER := estimated_power + (estimated_power * 0.2)::INTEGER; -- 20% headroom
    BEGIN
      IF psu_wattage < required_wattage THEN
        rule_type := 'insufficient_power';
        is_compatible := false;
        error_message := format('PSU wattage (%s W) insufficient for estimated system consumption (%s W with 20%% headroom)', psu_wattage, required_wattage);
        conflicting_products := ARRAY[COALESCE(psu_name, 'PSU')];
        RETURN NEXT;
      END IF;
    END;
  END IF;

  -- Check 11: Missing essential components
  IF cpu_name IS NULL THEN
    rule_type := 'missing_cpu';
    is_compatible := false;
    error_message := 'CPU is required for a complete build';
    conflicting_products := ARRAY[]::TEXT[];
    RETURN NEXT;
  END IF;

  IF mb_name IS NULL THEN
    rule_type := 'missing_motherboard';
    is_compatible := false;
    error_message := 'Motherboard is required for a complete build';
    conflicting_products := ARRAY[]::TEXT[];
    RETURN NEXT;
  END IF;

  IF total_ram_modules = 0 THEN
    rule_type := 'missing_ram';
    is_compatible := false;
    error_message := 'RAM is required for a complete build';
    conflicting_products := ARRAY[]::TEXT[];
    RETURN NEXT;
  END IF;

  IF psu_name IS NULL THEN
    rule_type := 'missing_psu';
    is_compatible := false;
    error_message := 'Power Supply (PSU) is required for a complete build';
    conflicting_products := ARRAY[]::TEXT[];
    RETURN NEXT;
  END IF;

  -- Check for storage (SSD or HDD)
  IF NOT EXISTS (
    SELECT 1 FROM build_product bp
    JOIN product p ON bp.product_id = p.id
    JOIN product_category pc ON p.category_id = pc.id
    WHERE bp.build_id = p_build_id AND pc.name IN ('SSD', 'HDD', 'Storage')
  ) THEN
    rule_type := 'missing_storage';
    is_compatible := false;
    error_message := 'Storage (SSD or HDD) is required for a complete build';
    conflicting_products := ARRAY[]::TEXT[];
    RETURN NEXT;
  END IF;

  -- Return success if no issues found
  IF NOT FOUND THEN
    rule_type := 'all_compatible';
    is_compatible := true;
    error_message := 'All components are compatible and build is complete';
    conflicting_products := ARRAY[]::TEXT[];
    RETURN NEXT;
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Update existing builds to have proper names if they don't already
UPDATE build SET name = 'Build #' || id WHERE name = 'Untitled Build' OR name IS NULL;

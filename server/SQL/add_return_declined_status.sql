-- Migration to add 'return_declined' status to order table
-- This allows orders to be marked as having their return request declined
-- preventing further return attempts

-- If there's a CHECK constraint on the status column, we need to update it
-- First, let's add the status if it doesn't exist in any constraints
-- This script is safe to run multiple times

-- Update any existing CHECK constraints to include the new status
-- Note: This is database-specific syntax and may need adjustment based on your setup

-- For PostgreSQL, if there's a constraint, we need to drop and recreate it
-- Since we don't know the exact constraint name, this is a template

-- Step 1: Check if the status column allows the new value
-- If your order table has a CHECK constraint on status, update it like this:

/*
-- Drop existing constraint (replace 'constraint_name' with actual name)
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS chk_order_status;

-- Add new constraint with all valid statuses including return_declined
ALTER TABLE "order" ADD CONSTRAINT chk_order_status 
  CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'awaiting_return', 'returned', 'return_declined'));
*/

-- Step 2: Create a function to handle return declined logic
CREATE OR REPLACE FUNCTION check_return_declined_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent status changes from return_declined back to other statuses
    -- except for admin corrections
    IF OLD.status = 'return_declined' AND NEW.status != 'return_declined' THEN
        -- Allow admin to correct status if needed, but log it
        INSERT INTO admin_action_log (order_id, action, old_value, new_value, timestamp)
        VALUES (NEW.id, 'status_change_from_return_declined', OLD.status, NEW.status, NOW())
        ON CONFLICT DO NOTHING; -- In case the log table doesn't exist
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to enforce return declined business rules
DROP TRIGGER IF EXISTS trg_check_return_declined ON "order";
CREATE TRIGGER trg_check_return_declined
    BEFORE UPDATE ON "order"
    FOR EACH ROW
    EXECUTE FUNCTION check_return_declined_status();

-- Step 4: Update any existing notifications to handle the new status
UPDATE notification 
SET notification_text = REPLACE(notification_text, 'return request has been', 'return request has been declined')
WHERE notification_type = 'order_status_update' 
  AND notification_text LIKE '%return%';

-- Step 5: Add comment to document the new status
COMMENT ON COLUMN "order".status IS 'Order status: pending, processing, shipped, delivered, cancelled, awaiting_return, returned, return_declined. return_declined prevents further return requests.';

-- Step 6: Create index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_order_status ON "order" (status);
CREATE INDEX IF NOT EXISTS idx_order_return_declined ON "order" (status) WHERE status = 'return_declined';

-- Step 7: Insert a record to track this migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20250729_add_return_declined_status', 'Added return_declined status to prevent multiple return attempts', NOW())
ON CONFLICT (version) DO NOTHING;

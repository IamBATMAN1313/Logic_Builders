-- Update conversation status constraint to include pending and resolved
-- Drop existing constraint
ALTER TABLE conversation DROP CONSTRAINT IF EXISTS conversation_status_check;

-- Add new constraint with pending and resolved
ALTER TABLE conversation ADD CONSTRAINT conversation_status_check 
    CHECK (status IN ('pending', 'active', 'resolved', 'closed', 'archived'));

-- Update any existing conversations that might have invalid status
UPDATE conversation SET status = 'pending' WHERE status NOT IN ('pending', 'active', 'resolved', 'closed', 'archived');

-- Show current status distribution
SELECT status, COUNT(*) as count FROM conversation GROUP BY status;

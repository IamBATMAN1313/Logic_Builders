-- ============================================================================
-- ENHANCED COMMUNICATION SYSTEM SCHEMA
-- Messaging, Q&A, and Notification System Updates
-- ============================================================================

-- ============================================================================
-- Q&A SYSTEM ENHANCEMENTS
-- ============================================================================

-- Update product_qa table to include more fields for better management
ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'published', 'archived'));
ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE product_qa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update qa_answer table to include publication and messaging options
ALTER TABLE qa_answer ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
ALTER TABLE qa_answer ADD COLUMN IF NOT EXISTS send_to_customer BOOLEAN DEFAULT FALSE;
ALTER TABLE qa_answer ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add triggers for updated_at columns
CREATE OR REPLACE TRIGGER trg_product_qa_updated_at
  BEFORE UPDATE ON product_qa
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_qa_answer_updated_at
  BEFORE UPDATE ON qa_answer
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- ENHANCED MESSAGING SYSTEM
-- ============================================================================

-- Add conversation support to message table  
ALTER TABLE message ADD COLUMN IF NOT EXISTS conversation_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE message ADD COLUMN IF NOT EXISTS subject VARCHAR(200);
ALTER TABLE message ADD COLUMN IF NOT EXISTS message_status VARCHAR(20) DEFAULT 'active' CHECK (message_status IN ('active', 'archived', 'deleted'));
ALTER TABLE message ADD COLUMN IF NOT EXISTS parent_message_id INTEGER REFERENCES message(id) ON DELETE SET NULL;
ALTER TABLE message ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN DEFAULT FALSE;
ALTER TABLE message ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE message ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'notification', 'qa_response'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_conversation_id ON message(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_status ON message(message_status);
CREATE INDEX IF NOT EXISTS idx_message_priority ON message(priority);

-- ============================================================================
-- ENHANCED NOTIFICATION SYSTEM
-- ============================================================================

-- Enhanced notification table with more specific types and categories
ALTER TABLE notification ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE notification ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE notification ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE notification ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
ALTER TABLE notification ADD COLUMN IF NOT EXISTS link TEXT;

-- Update notification types to be more specific
UPDATE notification SET notification_type = 'order_status_update' WHERE notification_type = 'general' AND notification_text LIKE '%order%status%';
UPDATE notification SET notification_type = 'qa_answered' WHERE notification_type = 'general' AND notification_text LIKE '%question%answered%';
UPDATE notification SET notification_type = 'promo_available' WHERE notification_type = 'general' AND notification_text LIKE '%voucher%' OR notification_text LIKE '%discount%';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_category ON notification(category);
CREATE INDEX IF NOT EXISTS idx_notification_priority ON notification(priority);
CREATE INDEX IF NOT EXISTS idx_notification_expires_at ON notification(expires_at);

-- ============================================================================
-- CONVERSATION MANAGEMENT
-- ============================================================================

-- Create conversation table for better message threading
CREATE TABLE IF NOT EXISTS conversation (
  id                UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject           VARCHAR(200) NOT NULL,
  status            VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  priority          VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  type              VARCHAR(50) DEFAULT 'general' CHECK (type IN ('general', 'support', 'qa_followup', 'order_inquiry', 'product_inquiry')),
  created_by        UUID      NOT NULL REFERENCES general_user(id) ON DELETE CASCADE,
  assigned_to       UUID      REFERENCES general_user(id) ON DELETE SET NULL,
  last_message_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger for updated_at
CREATE OR REPLACE TRIGGER trg_conversation_updated_at
  BEFORE UPDATE ON conversation
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversation_status ON conversation(status);
CREATE INDEX IF NOT EXISTS idx_conversation_type ON conversation(type);
CREATE INDEX IF NOT EXISTS idx_conversation_created_by ON conversation(created_by);
CREATE INDEX IF NOT EXISTS idx_conversation_assigned_to ON conversation(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversation_last_message ON conversation(last_message_at);

-- ============================================================================
-- PARTICIPANT MANAGEMENT
-- ============================================================================

-- Track conversation participants
CREATE TABLE IF NOT EXISTS conversation_participant (
  id              SERIAL    PRIMARY KEY,
  conversation_id UUID      NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  user_id         UUID      NOT NULL REFERENCES general_user(id) ON DELETE CASCADE,
  role            VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('participant', 'moderator', 'admin')),
  joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active       BOOLEAN   DEFAULT TRUE,
  UNIQUE(conversation_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participant_conversation ON conversation_participant(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participant_user ON conversation_participant(user_id);

-- ============================================================================
-- ENHANCED VIEWS
-- ============================================================================

-- View for admin Q&A management
CREATE OR REPLACE VIEW admin_qa_management AS
SELECT 
  pqa.id as question_id,
  pqa.product_id,
  p.name as product_name,
  pqa.customer_id,
  gu.full_name as customer_name,
  gu.username as customer_username,
  pqa.question_text,
  pqa.priority,
  pqa.status,
  pqa.category,
  pqa.time_asked,
  pqa.updated_at,
  qaa.id as answer_id,
  qaa.answer_text,
  qaa.is_published,
  qaa.send_to_customer,
  qaa.time_answered,
  admin_gu.full_name as answered_by
FROM product_qa pqa
JOIN product p ON pqa.product_id = p.id
JOIN customer c ON pqa.customer_id = c.id
JOIN general_user gu ON c.user_id = gu.id
LEFT JOIN qa_answer qaa ON pqa.id = qaa.question_id
LEFT JOIN admin a ON qaa.admin_id = a.id
LEFT JOIN general_user admin_gu ON a.user_id = admin_gu.id
ORDER BY pqa.priority DESC, pqa.time_asked DESC;

-- View for published Q&A on product pages
CREATE OR REPLACE VIEW published_product_qa AS
SELECT 
  pqa.id as question_id,
  pqa.product_id,
  pqa.question_text,
  pqa.time_asked,
  qaa.answer_text,
  qaa.time_answered,
  admin_gu.full_name as answered_by_name
FROM product_qa pqa
JOIN qa_answer qaa ON pqa.id = qaa.question_id
LEFT JOIN admin a ON qaa.admin_id = a.id
LEFT JOIN general_user admin_gu ON a.user_id = admin_gu.id
WHERE qaa.is_published = TRUE
  AND pqa.status = 'published'
ORDER BY pqa.time_asked DESC;

-- View for user conversations
CREATE OR REPLACE VIEW user_conversations AS
SELECT 
  c.id as conversation_id,
  c.subject,
  c.status,
  c.type,
  c.priority,
  c.last_message_at,
  c.created_at,
  cp.user_id,
  cp.role,
  cp.last_read_at,
  (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id AND m.sent_at > cp.last_read_at) as unread_count,
  (SELECT m.message_text FROM message m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) as last_message,
  (SELECT gu.full_name FROM message m JOIN general_user gu ON m.sender_id = gu.id WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) as last_sender_name
FROM conversation c
JOIN conversation_participant cp ON c.id = cp.conversation_id
WHERE cp.is_active = TRUE
ORDER BY c.last_message_at DESC;

-- View for active notifications
CREATE OR REPLACE VIEW active_notifications AS
SELECT 
  n.*,
  gu.username,
  gu.full_name
FROM notification n
JOIN general_user gu ON n.user_id = gu.id
WHERE (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
  AND n.seen_status = FALSE
ORDER BY n.priority DESC, n.created_at DESC;

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to auto-update conversation last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation 
  SET last_message_at = NEW.sent_at, updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON message
  FOR EACH ROW EXECUTE PROCEDURE update_conversation_last_message();

-- Function to create notification when Q&A is answered
CREATE OR REPLACE FUNCTION notify_qa_answered()
RETURNS TRIGGER AS $$
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
  
  -- Send message if requested
  IF NEW.send_to_customer = TRUE THEN
    INSERT INTO message (
      sender_id,
      receiver_id,
      message_text,
      subject,
      message_type,
      is_system_message
    ) VALUES (
      (SELECT user_id FROM admin WHERE id = NEW.admin_id),
      customer_user_id,
      'Your question: "' || LEFT(question_text, 100) || '..." has been answered: ' || NEW.answer_text,
      'Answer to your product question',
      'text',
      TRUE
    );
  END IF;
  
  -- Update question status
  UPDATE product_qa 
  SET status = CASE 
    WHEN NEW.is_published THEN 'published' 
    ELSE 'answered' 
  END,
  is_answered = TRUE,
  updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.question_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_notify_qa_answered
  AFTER INSERT ON qa_answer
  FOR EACH ROW EXECUTE PROCEDURE notify_qa_answered();

-- Function to create notification when order status changes
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_notify_order_status_change
  AFTER UPDATE ON "order"
  FOR EACH ROW EXECUTE PROCEDURE notify_order_status_change();

-- ============================================================================
-- SAMPLE DATA AND INITIAL SETUP
-- ============================================================================

-- Insert some sample notification types for reference
INSERT INTO notification (user_id, notification_text, notification_type, category, seen_status, priority) 
SELECT 
  gu.id,
  'Welcome to LogicBuilders! Check out our latest products and deals.',
  'welcome',
  'general',
  FALSE,
  'normal'
FROM general_user gu 
WHERE NOT EXISTS (
  SELECT 1 FROM notification n 
  WHERE n.user_id = gu.id AND n.notification_type = 'welcome'
)
LIMIT 5; -- Only for first 5 users as example

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_qa_status ON product_qa(status);
CREATE INDEX IF NOT EXISTS idx_product_qa_priority ON product_qa(priority);
CREATE INDEX IF NOT EXISTS idx_qa_answer_published ON qa_answer(is_published);

-- End of schema updates

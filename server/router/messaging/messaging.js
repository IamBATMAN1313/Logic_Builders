const express = require('express');
const pool = require('../../db/connection');
const auth = require('../../middlewares/authenticateToken');
const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if this is an admin token
    if (decoded.admin_id) {
      const adminResult = await pool.query(`
        SELECT admin_id, user_id, name, clearance_level 
        FROM admin_users 
        WHERE admin_id = $1
      `, [decoded.admin_id]);

      if (adminResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }

      req.user = { id: adminResult.rows[0].user_id };
      req.admin = adminResult.rows[0];
      next();
    } else if (decoded.userId) {
      // General user token - check if they're an admin
      const adminResult = await pool.query(`
        SELECT admin_id, user_id, name, clearance_level 
        FROM admin_users 
        WHERE user_id = $1
      `, [decoded.userId]);

      if (adminResult.rows.length === 0) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.user = { id: decoded.userId };
      req.admin = adminResult.rows[0];
      next();
    } else {
      return res.status(401).json({ error: 'Invalid token format' });
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

// Get user conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await pool.query(`
      SELECT 
        c.id as conversation_id,
        c.subject,
        c.status,
        c.priority,
        c.type,
        c.last_message_at,
        c.created_at,
        m.message_text as last_message,
        (
          SELECT COUNT(*) 
          FROM message msg 
          WHERE msg.conversation_id = c.id 
          AND msg.sender_id != $1 
          AND msg.sent_at > COALESCE(cp.last_read_at, '1970-01-01')
        ) as unread_count
      FROM conversation c
      JOIN conversation_participant cp ON c.id = cp.conversation_id
      LEFT JOIN LATERAL (
        SELECT message_text 
        FROM message 
        WHERE conversation_id = c.id 
        ORDER BY sent_at DESC 
        LIMIT 1
      ) m ON true
      WHERE cp.user_id = $1 AND cp.is_active = TRUE
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `, [userId]);

    res.json(conversations.rows);
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start new conversation
router.post('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, type = 'general', message_text } = req.body;

    if (!subject || !message_text) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create conversation
      const conversationResult = await client.query(`
        INSERT INTO conversation (subject, status, priority, type, created_by, created_at, updated_at)
        VALUES ($1, 'pending', 'normal', $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [subject, type, userId]);
      
      const conversationId = conversationResult.rows[0].id;
      
      // Add user as participant
      await client.query(`
        INSERT INTO conversation_participant (conversation_id, user_id, role, joined_at, last_read_at, is_active)
        VALUES ($1, $2, 'participant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, TRUE)
      `, [conversationId, userId]);
      
      // Create first message
      await client.query(`
        INSERT INTO message (sender_id, receiver_id, message_text, seen_status, sent_at, conversation_id, message_type)
        VALUES ($1, $1, $2, TRUE, CURRENT_TIMESTAMP, $3, 'text')
      `, [userId, message_text, conversationId]);
      
      // Update conversation last_message_at
      await client.query(`
        UPDATE conversation 
        SET last_message_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [conversationId]);
      
      await client.query('COMMIT');
      
      res.json({ 
        success: true, 
        conversation_id: conversationId,
        message: 'Conversation started successfully' 
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// MESSAGE MANAGEMENT
// ============================================================================

// Get messages in a conversation
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    // Verify user is participant
    const participantCheck = await pool.query(`
      SELECT 1 FROM conversation_participant 
      WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE
    `, [conversationId, userId]);

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await pool.query(`
      SELECT 
        m.*,
        gu.full_name as sender_name,
        gu.username as sender_username
      FROM message m
      JOIN general_user gu ON m.sender_id = gu.id
      WHERE m.conversation_id = $1
      ORDER BY m.sent_at ASC
    `, [conversationId]);

    // Update last_read_at for this user
    await pool.query(`
      UPDATE conversation_participant 
      SET last_read_at = CURRENT_TIMESTAMP
      WHERE conversation_id = $1 AND user_id = $2
    `, [conversationId, userId]);

    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message in conversation
router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { message_text, message_type = 'text' } = req.body;

    if (!message_text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Verify user is participant
    const participantCheck = await pool.query(`
      SELECT 1 FROM conversation_participant 
      WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE
    `, [conversationId, userId]);

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get other participants to notify
    const participants = await pool.query(`
      SELECT user_id FROM conversation_participant 
      WHERE conversation_id = $1 AND user_id != $2 AND is_active = TRUE
    `, [conversationId, userId]);

    // Insert message (receiver_id will be the conversation assigned admin or first participant)
    const receiverId = participants.rows.length > 0 ? participants.rows[0].user_id : userId;
    
    const messageResult = await pool.query(`
      INSERT INTO message (sender_id, receiver_id, message_text, conversation_id, message_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, sent_at
    `, [userId, receiverId, message_text, conversationId, message_type]);

    res.json({ 
      success: true, 
      message_id: messageResult.rows[0].id,
      sent_at: messageResult.rows[0].sent_at
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// DIRECT MESSAGING (Legacy support)
// ============================================================================

// Send direct message to admin/support
router.post('/send', auth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { message_text, subject = 'Support Request' } = req.body;

    if (!message_text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Find available admin
    const adminResult = await pool.query(`
      SELECT au.user_id FROM admin_users au
      WHERE au.clearance_level IN (0, 3) AND au.is_active = TRUE
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'No admin available' });
    }

    const receiverId = adminResult.rows[0].user_id;

    const result = await pool.query(`
      INSERT INTO message (sender_id, receiver_id, message_text, subject, message_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [senderId, receiverId, message_text, subject, 'text']);

    res.json({ 
      success: true, 
      message_id: result.rows[0].id,
      message: 'Message sent successfully' 
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user messages (legacy support)
router.get('/messages', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await pool.query(`
      SELECT 
        m.*,
        sender_gu.full_name as sender_name,
        receiver_gu.full_name as receiver_name
      FROM message m
      JOIN general_user sender_gu ON m.sender_id = sender_gu.id
      JOIN general_user receiver_gu ON m.receiver_id = receiver_gu.id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY m.sent_at DESC
    `, [userId]);

    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark message as read
router.patch('/messages/:messageId/read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    await pool.query(`
      UPDATE message 
      SET seen_status = TRUE 
      WHERE id = $1 AND receiver_id = $2
    `, [messageId, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// ADMIN MESSAGING ENDPOINTS
// ============================================================================

// Test admin endpoint
router.get('/admin/test', authenticateAdmin, (req, res) => {
  res.json({ message: 'Admin messaging auth working!', admin: req.admin.name });
});

// Get all conversations for admin
router.get('/admin/conversations', authenticateAdmin, async (req, res) => {
  try {
    const { status = 'all', priority, type } = req.query;

    let queryConditions = [];
    let queryParams = [];
    let paramCount = 0;

    // Handle status filter
    if (status !== 'all') {
      paramCount++;
      queryConditions.push(`c.status = $${paramCount}`);
      queryParams.push(status);
    }

    if (priority) {
      paramCount++;
      queryConditions.push(`c.priority = $${paramCount}`);
      queryParams.push(priority);
    }

    if (type) {
      paramCount++;
      queryConditions.push(`c.type = $${paramCount}`);
      queryParams.push(type);
    }

    const conversations = await pool.query(`
      SELECT 
        c.id,
        c.subject,
        c.status,
        c.type,
        c.created_at,
        c.last_message_at,
        creator.full_name as customer_name,
        creator.email as customer_email,
        assignee.name as assigned_to_name,
        latest_msg.message_text as last_message,
        COALESCE(unread.unread_count, 0) as unread_count
      FROM conversation c
      LEFT JOIN general_user creator ON c.created_by = creator.id
      LEFT JOIN admin_users assignee ON c.assigned_to = assignee.user_id
      LEFT JOIN (
        SELECT DISTINCT ON (conversation_id) 
          conversation_id, message_text
        FROM message 
        ORDER BY conversation_id, sent_at DESC
      ) latest_msg ON c.id = latest_msg.conversation_id
      LEFT JOIN (
        SELECT 
          conversation_id,
          COUNT(*) as unread_count
        FROM message m
        WHERE m.seen_status = false AND m.sender_id != $${paramCount + 1}
        GROUP BY conversation_id
      ) unread ON c.id = unread.conversation_id
      ${queryConditions.length > 0 ? 'WHERE ' + queryConditions.join(' AND ') : ''}
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `, [...queryParams, req.admin.user_id]);

    res.json(conversations.rows);
  } catch (error) {
    console.error('Error fetching admin conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation messages for admin
router.get('/admin/conversation/:conversationId', authenticateAdmin, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await pool.query(`
      SELECT 
        m.id,
        m.message_text,
        m.sent_at,
        m.seen_status,
        m.is_system_message,
        m.priority,
        m.message_type,
        sender.full_name as sender_name,
        sender.email as sender_email,
        CASE 
          WHEN admin_sender.name IS NOT NULL THEN admin_sender.name
          ELSE sender.full_name
        END as display_name
      FROM message m
      LEFT JOIN general_user sender ON m.sender_id = sender.id
      LEFT JOIN admin_users admin_sender ON m.sender_id = admin_sender.user_id
      WHERE m.conversation_id = $1
      ORDER BY m.sent_at ASC
    `, [conversationId]);

    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send admin reply
router.post('/admin/conversation/:conversationId/reply', authenticateAdmin, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message_text } = req.body;
    const adminUserId = req.admin.user_id || req.admin.admin_id; // Use admin's user_id or admin_id

    if (!message_text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Get conversation details
    const conversation = await pool.query(`
      SELECT created_by, status FROM conversation WHERE id = $1
    `, [conversationId]);

    if (conversation.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const receiverId = conversation.rows[0].created_by;
    const currentStatus = conversation.rows[0].status;

    // Insert message
    const messageResult = await pool.query(`
      INSERT INTO message (
        sender_id, receiver_id, conversation_id, message_text, 
        message_type, is_system_message
      ) VALUES ($1, $2, $3, $4, 'text', false)
      RETURNING id, sent_at
    `, [adminUserId, receiverId, conversationId, message_text]);

    // Update conversation last_message_at and set status to 'active' if it's currently 'pending'
    if (currentStatus === 'pending') {
      await pool.query(`
        UPDATE conversation 
        SET last_message_at = CURRENT_TIMESTAMP, status = 'active'
        WHERE id = $1
      `, [conversationId]);
    } else {
      await pool.query(`
        UPDATE conversation 
        SET last_message_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [conversationId]);
    }

    res.json({
      success: true,
      message_id: messageResult.rows[0].id,
      sent_at: messageResult.rows[0].sent_at
    });
  } catch (error) {
    console.error('Error sending admin reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update conversation status
router.patch('/admin/conversation/:conversationId', authenticateAdmin, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { status, assigned_to } = req.body;

    let updateFields = [];
    let updateValues = [];
    let paramCount = 0;

    if (status) {
      // Only allow these statuses for admin updates
      const allowedStatuses = ['active', 'resolved', 'closed'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ 
          error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` 
        });
      }
      
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
    }

    if (assigned_to) {
      paramCount++;
      updateFields.push(`assigned_to = $${paramCount}`);
      updateValues.push(assigned_to);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updated_at
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Add conversation ID
    paramCount++;
    updateValues.push(conversationId);

    await pool.query(`
      UPDATE conversation 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
    `, updateValues);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

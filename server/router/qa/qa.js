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
        SELECT admin_id, employee_id, name, clearance_level, user_id 
        FROM admin_users 
        WHERE admin_id = $1
      `, [decoded.admin_id]);

      if (adminResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }

      // Set user id from admin's user_id field, or use admin_id if user_id is null
      const admin = adminResult.rows[0];
      req.user = { id: admin.user_id || admin.admin_id };
      req.admin = admin;
      next();
    } else if (decoded.userId) {
      // General user token - check if they're an admin
      const adminResult = await pool.query(`
        SELECT admin_id, employee_id, name, clearance_level, user_id 
        FROM admin_users 
        WHERE user_id::text = $1
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

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Q&A router is working!', timestamp: new Date().toISOString() });
});

// ============================================================================
// CUSTOMER Q&A ENDPOINTS
// ============================================================================

// Get published Q&A for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const qa = await pool.query(`
      SELECT 
        pqa.id as question_id,
        pqa.question_text,
        pqa.time_asked,
        qaa.answer_text,
        qaa.time_answered,
        admin_users.name as answered_by_name
      FROM product_qa pqa
      JOIN qa_answer qaa ON pqa.id = qaa.question_id
      JOIN admin_users ON qaa.admin_id = admin_users.admin_id
      WHERE pqa.product_id = $1 
        AND qaa.is_published = TRUE
        AND pqa.status = 'published'
      ORDER BY pqa.time_asked DESC
    `, [productId]);

    res.json(qa.rows);
  } catch (error) {
    console.error('Error fetching product Q&A:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit question for a product
router.post('/product/:productId/ask', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { question_text, category = 'general' } = req.body;

    if (!question_text) {
      return res.status(400).json({ error: 'Question text is required' });
    }

    // Get customer ID
    const customerResult = await pool.query(`
      SELECT id FROM customer WHERE user_id = $1
    `, [userId]);

    if (customerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Only customers can ask questions' });
    }

    const customerId = customerResult.rows[0].id;

    // Insert question (priority will use default 'normal' value)
    const result = await pool.query(`
      INSERT INTO product_qa (product_id, customer_id, question_text, category)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [productId, customerId, question_text, category]);

    res.json({ 
      success: true, 
      question_id: result.rows[0].id,
      message: 'Question submitted successfully. You will be notified when it is answered.' 
    });

  } catch (error) {
    console.error('Error submitting question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get customer's own questions
router.get('/my-questions', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get customer ID
    const customerResult = await pool.query(`
      SELECT id FROM customer WHERE user_id = $1
    `, [userId]);

    if (customerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Only customers can view questions' });
    }

    const customerId = customerResult.rows[0].id;

    const questions = await pool.query(`
      SELECT 
        pqa.id as question_id,
        pqa.product_id,
        p.name as product_name,
        pqa.question_text,
        pqa.priority,
        pqa.status,
        pqa.category,
        pqa.time_asked,
        CASE WHEN qaa.id IS NOT NULL THEN true ELSE false END as is_answered,
        qaa.answer_text,
        qaa.time_answered,
        qaa.is_published,
        NULL as answered_by
      FROM product_qa pqa
      JOIN product p ON pqa.product_id = p.id
      LEFT JOIN qa_answer qaa ON pqa.id = qaa.question_id
      WHERE pqa.customer_id = $1
      ORDER BY pqa.time_asked DESC
    `, [customerId]);

    res.json(questions.rows);
  } catch (error) {
    console.error('Error fetching customer questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alias for customer questions (frontend compatibility)
router.get('/customer/questions', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get customer ID
    const customerResult = await pool.query(`
      SELECT id FROM customer WHERE user_id = $1
    `, [userId]);

    if (customerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Only customers can view questions' });
    }

    const customerId = customerResult.rows[0].id;

    const questions = await pool.query(`
      SELECT 
        pqa.id as question_id,
        pqa.product_id,
        p.name as product_name,
        pqa.question_text,
        pqa.priority,
        pqa.status,
        pqa.category,
        pqa.time_asked,
        CASE WHEN qaa.id IS NOT NULL THEN true ELSE false END as is_answered,
        qaa.answer_text,
        qaa.time_answered,
        qaa.is_published,
        admin_users.name as answered_by
      FROM product_qa pqa
      JOIN product p ON pqa.product_id = p.id
      LEFT JOIN qa_answer qaa ON pqa.id = qaa.question_id
      LEFT JOIN admin_users ON qaa.admin_id = admin_users.admin_id
      WHERE pqa.customer_id = $1
      ORDER BY pqa.time_asked DESC
    `, [customerId]);

    res.json(questions.rows);
  } catch (error) {
    console.error('Error fetching customer questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all published Q&A (public endpoint)
router.get('/published', async (req, res) => {
  try {
    const { product_id, category, limit = 50 } = req.query;

    let queryConditions = ['qaa.is_published = TRUE', 'pqa.status = $1'];
    let queryParams = ['published'];
    let paramCount = 1;

    if (product_id) {
      paramCount++;
      queryConditions.push(`pqa.product_id = $${paramCount}`);
      queryParams.push(product_id);
    }

    if (category) {
      paramCount++;
      queryConditions.push(`pqa.category = $${paramCount}`);
      queryParams.push(category);
    }

    // Add limit
    paramCount++;
    queryParams.push(parseInt(limit));

    const publishedQA = await pool.query(`
      SELECT 
        pqa.id as question_id,
        pqa.product_id,
        p.name as product_name,
        pqa.question_text,
        pqa.category,
        pqa.time_asked,
        qaa.id as answer_id,
        qaa.answer_text,
        qaa.time_answered,
        admin_users.name as answered_by_name
      FROM product_qa pqa
      JOIN product p ON pqa.product_id = p.id
      JOIN qa_answer qaa ON pqa.id = qaa.question_id
      JOIN admin_users ON qaa.admin_id = admin_users.admin_id
      WHERE ${queryConditions.join(' AND ')}
      ORDER BY pqa.time_asked DESC
      LIMIT $${paramCount}
    `, queryParams);

    res.json(publishedQA.rows);
  } catch (error) {
    console.error('Error fetching published Q&A:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// ADMIN Q&A MANAGEMENT ENDPOINTS
// ============================================================================

// Get all pending questions for admin review
router.get('/admin/pending', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'pending', priority, category } = req.query;

    let queryConditions = [];
    let queryParams = [];
    let paramCount = 0;

    // Handle status filter - if not 'all', filter by specific status
    if (status !== 'all') {
      paramCount++;
      queryConditions.push(`pqa.status = $${paramCount}`);
      queryParams.push(status);
    }

    if (priority) {
      paramCount++;
      queryConditions.push(`pqa.priority = $${paramCount}`);
      queryParams.push(priority);
    }

    if (category) {
      paramCount++;
      queryConditions.push(`pqa.category = $${paramCount}`);
      queryParams.push(category);
    }

    const questions = await pool.query(`
      SELECT 
        pqa.id as question_id,
        pqa.product_id,
        p.name as product_name,
        pqa.customer_id,
        gu.full_name as customer_name,
        gu.email as customer_email,
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
        admin_users.name as answered_by
      FROM product_qa pqa
      JOIN product p ON pqa.product_id = p.id
      JOIN customer c ON pqa.customer_id = c.id
      JOIN general_user gu ON c.user_id = gu.id
      LEFT JOIN qa_answer qaa ON pqa.id = qaa.question_id
      LEFT JOIN admin_users ON qaa.admin_id = admin_users.admin_id
      ${queryConditions.length > 0 ? 'WHERE ' + queryConditions.join(' AND ') : ''}
      ORDER BY pqa.priority DESC, pqa.time_asked DESC
    `, queryParams);

    res.json(questions.rows);
  } catch (error) {
    console.error('Error fetching admin questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Answer a question
router.post('/admin/answer/:questionId', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId } = req.params;
    const { answer_text, is_published = false, send_to_customer = false } = req.body;

    if (!answer_text) {
      return res.status(400).json({ error: 'Answer text is required' });
    }

    const adminId = req.admin.admin_id;

    // Check if question exists and is not already answered
    const questionCheck = await pool.query(`
      SELECT id FROM product_qa WHERE id = $1
    `, [questionId]);

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Insert answer (triggers will handle notifications and status updates)
    const result = await pool.query(`
      INSERT INTO qa_answer (question_id, admin_id, answer_text, is_published, send_to_customer)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [questionId, adminId, answer_text, is_published, send_to_customer]);

    res.json({ 
      success: true, 
      answer_id: result.rows[0].id,
      message: 'Answer submitted successfully' 
    });

  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update question status/priority
router.patch('/admin/question/:questionId', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId } = req.params;
    const { status, priority, category } = req.body;

    // Check if user is admin
    const adminCheck = await pool.query(`
      SELECT 1 FROM admin_users
      WHERE user_id = $1 AND clearance_level IN (0, 1, 3)
    `, [userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let updateFields = [];
    let updateValues = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
    }

    if (priority) {
      paramCount++;
      updateFields.push(`priority = $${paramCount}`);
      updateValues.push(priority);
    }

    if (category) {
      paramCount++;
      updateFields.push(`category = $${paramCount}`);
      updateValues.push(category);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updated_at
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Add question ID
    paramCount++;
    updateValues.push(questionId);

    await pool.query(`
      UPDATE product_qa 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
    `, updateValues);

    res.json({ success: true, message: 'Question updated successfully' });

  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update answer publication status
router.patch('/admin/answer/:answerId', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const { answerId } = req.params;
    const { answer_text, is_published, send_to_customer } = req.body;

    let updateFields = [];
    let updateValues = [];
    let paramCount = 0;

    if (answer_text !== undefined) {
      paramCount++;
      updateFields.push(`answer_text = $${paramCount}`);
      updateValues.push(answer_text);
    }

    if (typeof is_published === 'boolean') {
      paramCount++;
      updateFields.push(`is_published = $${paramCount}`);
      updateValues.push(is_published);
    }

    if (typeof send_to_customer === 'boolean') {
      paramCount++;
      updateFields.push(`send_to_customer = $${paramCount}`);
      updateValues.push(send_to_customer);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updated_at
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Add answer ID
    paramCount++;
    updateValues.push(answerId);

    await pool.query(`
      UPDATE qa_answer 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
    `, updateValues);

    // If publishing, update question status
    if (is_published === true) {
      await pool.query(`
        UPDATE product_qa 
        SET status = 'published', updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT question_id FROM qa_answer WHERE id = $1)
      `, [answerId]);
    }

    res.json({ success: true, message: 'Answer updated successfully' });

  } catch (error) {
    console.error('Error updating answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Q&A statistics for admin dashboard
router.get('/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const adminCheck = await pool.query(`
      SELECT 1 FROM admin_users
      WHERE user_id = $1 AND clearance_level IN (0, 1, 3)
    `, [userId]);

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_questions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_questions,
        COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered_questions,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_questions,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_questions,
        COUNT(CASE WHEN time_asked >= CURRENT_DATE THEN 1 END) as todays_questions
      FROM product_qa
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching Q&A stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

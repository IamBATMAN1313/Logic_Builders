const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../db/connection');
const { 
  logAdminAction, 
  createNotificationForClearance, 
  getUnreadNotificationsCount,
  markNotificationsAsRead 
} = require('../../utils/adminUtils');
const {
  getAccessLevels,
  getAssignableAccessLevels,
  requireClearance,
  hasPermission,
  canManageAdmin,
  getAccessNameByLevel
} = require('../../utils/accessLevels');

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const adminResult = await pool.query(`
      SELECT a.admin_id, a.employee_id, a.name, a.clearance_level, al.access_name as clearance_name 
      FROM admin_users a 
      LEFT JOIN access_levels al ON a.clearance_level = al.access_level 
      WHERE a.admin_id = $1
    `, [decoded.admin_id]);

    if (adminResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    req.admin = adminResult.rows[0];
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { employee_id, password } = req.body;

    // Get admin by employee_id with access level name
    const adminResult = await pool.query(`
      SELECT a.*, al.access_name as clearance_name 
      FROM admin_users a 
      LEFT JOIN access_levels al ON a.clearance_level = al.access_level 
      WHERE a.employee_id = $1
    `, [employee_id]);

    if (adminResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const admin = adminResult.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { admin_id: admin.admin_id, employee_id: admin.employee_id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' }
    );

    // Return admin data (without password)
    const { password: _, ...adminData } = admin;
    res.json({
      token,
      admin: adminData
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate admin token
router.get('/validate', authenticateAdmin, async (req, res) => {
  res.json(req.admin);
});

// Dashboard stats
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM product'),
      pool.query('SELECT COUNT(*) as count FROM general_user'),
      pool.query('SELECT COUNT(*) as count FROM admin_users'),
      pool.query('SELECT COUNT(*) as count FROM admin_signup_requests WHERE status = $1', ['PENDING']),
      pool.query('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = false'),
      pool.query('SELECT COUNT(*) as count FROM product WHERE availability = false')
    ]);

    res.json({
      totalProducts: parseInt(stats[0].rows[0].count) || 0,
      totalUsers: parseInt(stats[1].rows[0].count) || 0,
      totalAdmins: parseInt(stats[2].rows[0].count) || 0,
      pendingRequests: parseInt(stats[3].rows[0].count) || 0,
      unreadNotifications: parseInt(stats[4].rows[0].count) || 0,
      outOfStockProducts: parseInt(stats[5].rows[0].count) || 0
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard stats',
      totalProducts: 0,
      totalUsers: 0,
      totalAdmins: 0,
      pendingRequests: 0,
      unreadNotifications: 0,
      outOfStockProducts: 0
    });
  }
});

// Admin management routes (GENERAL_MANAGER only)
router.get('/admins', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT admin_id, employee_id, name, clearance_level, created_at FROM admin_users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/admins', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { employee_id, name, password, clearance_level } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO admin_users (employee_id, name, password, clearance_level) VALUES ($1, $2, $3, $4) RETURNING admin_id, employee_id, name, clearance_level, created_at',
      [employee_id, name, hashedPassword, clearance_level]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create admin error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Employee ID already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

router.put('/admins/:admin_id', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { admin_id } = req.params;
    const { name, clearance_level } = req.body;

    const result = await pool.query(
      'UPDATE admin_users SET name = $1, clearance_level = $2 WHERE admin_id = $3 RETURNING admin_id, employee_id, name, clearance_level',
      [name, clearance_level, admin_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin signup request (public endpoint)
router.post('/signup-request', async (req, res) => {
  try {
    console.log('📝 Admin signup request received:', {
      employee_id: req.body.employee_id,
      name: req.body.name,
      email: req.body.email,
      department: req.body.department,
      position: req.body.position,
      requested_clearance: req.body.requested_clearance
    });

    const { 
      employee_id, 
      name, 
      email, 
      password, 
      phone, 
      department, 
      position, 
      reason_for_access,
      requested_clearance 
    } = req.body;

    // Validate required fields
    if (!employee_id || !name || !email || !password || !requested_clearance) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['employee_id', 'name', 'email', 'password', 'requested_clearance'],
        received: Object.keys(req.body)
      });
    }

    // Validate clearance level exists
    const clearanceCheck = await pool.query(
      'SELECT access_level, access_name FROM access_levels WHERE access_level = $1',
      [requested_clearance]
    );

    if (clearanceCheck.rows.length === 0) {
      console.log('❌ Invalid clearance level:', requested_clearance);
      const availableLevels = await pool.query('SELECT access_level, access_name FROM access_levels ORDER BY access_level');
      return res.status(400).json({ 
        message: 'Invalid clearance level',
        available_levels: availableLevels.rows
      });
    }

    // Check if employee_id already exists in requests
    const existingRequest = await pool.query(
      'SELECT request_id, status FROM admin_signup_requests WHERE employee_id = $1',
      [employee_id]
    );

    if (existingRequest.rows.length > 0) {
      console.log('❌ Request already exists for employee_id:', employee_id);
      return res.status(400).json({ 
        message: 'Request already exists for this employee ID',
        existing_status: existingRequest.rows[0].status,
        request_id: existingRequest.rows[0].request_id
      });
    }

    // Check if already an active admin
    const existingAdmin = await pool.query(
      'SELECT admin_id, name FROM admin_users WHERE employee_id = $1',
      [employee_id]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('❌ Admin already exists for employee_id:', employee_id);
      return res.status(400).json({ 
        message: 'Admin already exists with this employee ID',
        admin_name: existingAdmin.rows[0].name
      });
    }

    // Hash password
    console.log('🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create signup request
    console.log('💾 Creating signup request in database...');
    const result = await pool.query(`
      INSERT INTO admin_signup_requests 
      (employee_id, name, email, password, phone, department, position, reason_for_access, requested_clearance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING request_id, employee_id, name, email, department, position, requested_clearance, created_at, status
    `, [employee_id, name, email, hashedPassword, phone, department, position, reason_for_access, requested_clearance]);

    const request = result.rows[0];
    console.log('✅ Signup request created with ID:', request.request_id);

    // Try to notify managers (don't fail if notification fails)
    try {
      console.log('📧 Attempting to notify GENERAL_MANAGERS...');
      
      // Check if we have any general managers first
      const managers = await pool.query(`
        SELECT admin_id, name FROM admin_users au
        JOIN access_levels al ON au.clearance_level = al.access_level
        WHERE al.access_name = 'General Manager'
      `);

      if (managers.rows.length > 0) {
        // Simple notification insertion instead of using utility function
        for (const manager of managers.rows) {
          await pool.query(`
            INSERT INTO admin_notifications (admin_id, type, title, message, related_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            manager.admin_id,
            'SIGNUP_REQUEST',
            'New Admin Signup Request',
            `${name} (${employee_id}) has requested admin access for ${department} department.`,
            request.request_id
          ]);
        }
        console.log('✅ Notifications sent to', managers.rows.length, 'managers');
      } else {
        console.log('⚠️  No general managers found to notify');
      }
    } catch (notifyError) {
      console.log('⚠️  Notification failed (non-critical):', notifyError.message);
      // Don't fail the request if notification fails
    }

    console.log('🎉 Admin signup request completed successfully');
    res.status(201).json({
      message: 'Admin signup request submitted successfully',
      request: {
        request_id: request.request_id,
        employee_id: request.employee_id,
        name: request.name,
        status: request.status || 'PENDING',
        created_at: request.created_at
      }
    });

  } catch (error) {
    console.error('❌ Admin signup request error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get pending signup requests (GENERAL_MANAGER only)
router.get('/signup-requests', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        asr.request_id, asr.employee_id, asr.name, asr.email, asr.phone, asr.department, asr.position,
        asr.reason_for_access, asr.requested_clearance, asr.status, asr.created_at,
        asr.assigned_clearance, asr.approved_at,
        au.name as approved_by_name
      FROM admin_signup_requests asr
      LEFT JOIN admin_users au ON asr.approved_by = au.admin_id
      ORDER BY 
        CASE WHEN asr.status = 'PENDING' THEN 0 ELSE 1 END,
        asr.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get signup requests error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
});

// Approve or reject signup request (GENERAL_MANAGER only)
router.put('/signup-requests/:request_id', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { request_id } = req.params;
    const { action, assigned_clearance, rejection_reason } = req.body; // action: 'approve' or 'reject'

    // Get the signup request
    const requestResult = await pool.query(
      'SELECT * FROM admin_signup_requests WHERE request_id = $1',
      [request_id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Signup request not found' });
    }

    const signupRequest = requestResult.rows[0];

    if (signupRequest.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    if (action === 'approve') {
      // Create the admin user
      const result = await pool.query(`
        INSERT INTO admin_users (employee_id, name, password, clearance_level)
        VALUES ($1, $2, $3, $4)
        RETURNING admin_id, employee_id, name, clearance_level
      `, [signupRequest.employee_id, signupRequest.name, signupRequest.password, assigned_clearance]);

      // Update signup request status
      await pool.query(`
        UPDATE admin_signup_requests 
        SET status = 'APPROVED', assigned_clearance = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
        WHERE request_id = $3
      `, [assigned_clearance, req.admin.admin_id, request_id]);

      // Log the action
      await logAdminAction(
        req.admin.admin_id,
        'APPROVE_ADMIN_SIGNUP',
        'ADMIN',
        result.rows[0].admin_id,
        {
          employee_id: signupRequest.employee_id,
          assigned_clearance,
          original_request: assigned_clearance
        },
        req
      );

      res.json({
        message: 'Admin signup approved successfully',
        new_admin: result.rows[0]
      });

    } else if (action === 'reject') {
      // Update signup request status
      await pool.query(`
        UPDATE admin_signup_requests 
        SET status = 'REJECTED', approved_by = $1, approved_at = CURRENT_TIMESTAMP
        WHERE request_id = $2
      `, [req.admin.admin_id, request_id]);

      // Log the action
      await logAdminAction(
        req.admin.admin_id,
        'REJECT_ADMIN_SIGNUP',
        'SIGNUP_REQUEST',
        request_id,
        {
          employee_id: signupRequest.employee_id,
          rejection_reason
        },
        req
      );

      res.json({ message: 'Admin signup rejected successfully' });
    } else {
      res.status(400).json({ message: 'Invalid action. Use "approve" or "reject"' });
    }

  } catch (error) {
    console.error('Process signup request error:', error);
    if (error.code === '23505') {
      res.status(400).json({ message: 'Employee ID already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Get all users (GENERAL_MANAGER only)
router.get('/users', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        user_id, username, email, full_name, contact_no, gender, created_at,
        CASE WHEN user_id IN (SELECT user_id FROM customer) THEN 'Customer' ELSE 'User' END as user_type
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin logs (GENERAL_MANAGER only)
router.get('/logs', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { page = 1, limit = 50, admin_id, action, target_type, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (admin_id) {
      whereConditions.push(`al.admin_id = $${paramIndex}`);
      queryParams.push(admin_id);
      paramIndex++;
    }

    if (action) {
      whereConditions.push(`al.action ILIKE $${paramIndex}`);
      queryParams.push(`%${action}%`);
      paramIndex++;
    }

    if (target_type) {
      whereConditions.push(`al.target_type = $${paramIndex}`);
      queryParams.push(target_type);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`al.created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`al.created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    queryParams.push(limit, offset);

    const result = await pool.query(`
      SELECT 
        al.log_id, al.action, al.target_type, al.target_id, al.details,
        al.ip_address, al.created_at,
        au.name as admin_name, au.employee_id
      FROM admin_logs al
      JOIN admin_users au ON al.admin_id = au.admin_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, queryParams);

    // Get total count for pagination
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM admin_logs al
      JOIN admin_users au ON al.admin_id = au.admin_id
      ${whereClause}
    `, queryParams.slice(0, -2));

    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    });

  } catch (error) {
    console.error('Get admin logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notifications for current admin
router.get('/notifications', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT notification_id, type, title, message, related_id, is_read, created_at
      FROM admin_notifications
      WHERE admin_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.admin.admin_id, limit, offset]);

    // Get unread count
    const unreadCount = await getUnreadNotificationsCount(req.admin.admin_id);

    res.json({
      notifications: result.rows,
      unread_count: unreadCount
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notifications as read
router.put('/notifications/read', authenticateAdmin, async (req, res) => {
  try {
    const { notification_ids } = req.body; // Array of notification IDs, or empty for all

    await markNotificationsAsRead(req.admin.admin_id, notification_ids);

    res.json({ message: 'Notifications marked as read' });

  } catch (error) {
    console.error('Mark notifications as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================
// PRODUCT MANAGEMENT ENDPOINTS
// =====================

// Get all products with pagination and filters
router.get('/products', authenticateAdmin, requireClearance('PRODUCT_MANAGER'), async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, availability, sort_by = 'created_at', sort_order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      whereClause += ` AND p.category_id = $${paramCount}`;
      values.push(category);
    }

    if (search) {
      paramCount++;
      // Search by name, excerpt, or product ID
      whereClause += ` AND (p.name ILIKE $${paramCount} OR p.excerpt ILIKE $${paramCount} OR p.id::text = $${paramCount.toString()})`;
      values.push(`%${search}%`);
    }

    if (availability !== undefined && availability !== '') {
      paramCount++;
      whereClause += ` AND p.availability = $${paramCount}`;
      values.push(availability === 'true');
    }

    // Safe sorting options
    const validSortFields = {
      'name': 'p.name',
      'cost': 'pa.cost',
      'stock': 'pa.stock',
      'units_sold': 'pa.units_sold',
      'created_at': 'p.created_at',
      'price': 'p.price'
    };

    const sortField = validSortFields[sort_by] || 'p.created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        p.*,
        pc.name as category_name,
        pa.stock,
        pa.cost,
        pa.units_sold
      FROM product p
      LEFT JOIN product_category pc ON p.category_id = pc.id
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*)
      FROM product p
      LEFT JOIN product_category pc ON p.category_id = pc.id
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values.slice(0, -2));

    await logAdminAction(req.admin.admin_id, 'VIEW_PRODUCTS', 'PRODUCT', null, {
      page,
      limit,
      filters: { category, search, availability }
    });

    res.json({
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product
router.get('/products/:id', authenticateAdmin, requireClearance('PRODUCT_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        pc.name as category_name,
        pa.stock,
        pa.cost,
        pa.units_sold
      FROM product p
      LEFT JOIN product_category pc ON p.category_id = pc.id
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new product
router.post('/products', authenticateAdmin, requireClearance('PRODUCT_MANAGER'), async (req, res) => {
  try {
    const {
      name,
      excerpt,
      image_url,
      price,
      discount_status = false,
      discount_percent = 0,
      availability = true,
      category_id,
      specs = {},
      stock = 0,
      cost = 0
    } = req.body;

    // Validate required fields
    if (!name || !price || !category_id) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create product
      const productResult = await client.query(`
        INSERT INTO product (name, excerpt, image_url, price, discount_status, discount_percent, availability, category_id, specs)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [name, excerpt, image_url, price, discount_status, discount_percent, availability, category_id, specs]);

      const product = productResult.rows[0];

      // Create product attributes
      await client.query(`
        INSERT INTO product_attribute (product_id, stock, cost)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [product.id, stock, cost]);

      await client.query('COMMIT');

      await logAdminAction(req.admin.admin_id, 'CREATE_PRODUCT', 'PRODUCT', product.id, {
        product_name: name,
        price,
        category_id
      });

      res.status(201).json({ message: 'Product created successfully', product });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product
router.put('/products/:id', authenticateAdmin, requireClearance('PRODUCT_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      excerpt,
      image_url,
      price,
      discount_status,
      discount_percent,
      availability,
      category_id,
      specs,
      stock,
      cost
    } = req.body;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Set default values for required fields if not provided
      const finalDiscountStatus = discount_status !== undefined ? discount_status : (discount_percent > 0);
      const finalDiscountPercent = discount_percent !== undefined ? discount_percent : 0;
      const finalAvailability = availability !== undefined ? availability : true;

      // Update product
      const productResult = await client.query(`
        UPDATE product 
        SET name = $1, excerpt = $2, image_url = $3, price = $4, 
            discount_status = $5, discount_percent = $6, availability = $7, 
            category_id = $8, specs = $9, updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *
      `, [name, excerpt, image_url, price, finalDiscountStatus, finalDiscountPercent, finalAvailability, category_id, specs, id]);

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      // Update product attributes
      if (stock !== undefined || cost !== undefined) {
        await client.query(`
          UPDATE product_attribute 
          SET stock = COALESCE($1, stock), cost = COALESCE($2, cost), updated_at = CURRENT_TIMESTAMP
          WHERE product_id = $3
        `, [stock, cost, id]);
      }

      await client.query('COMMIT');

      await logAdminAction(req.admin.admin_id, 'UPDATE_PRODUCT', 'PRODUCT', id, {
        product_name: name,
        changes: req.body
      });

      res.json({ message: 'Product updated successfully', product: productResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete product
router.delete('/products/:id', authenticateAdmin, requireClearance('PRODUCT_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get product info before deletion
      const productResult = await client.query('SELECT name FROM product WHERE id = $1', [id]);
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      const productName = productResult.rows[0].name;

      // Delete product attributes first
      await client.query('DELETE FROM product_attribute WHERE product_id = $1', [id]);
      
      // Delete product
      await client.query('DELETE FROM product WHERE id = $1', [id]);

      await client.query('COMMIT');

      await logAdminAction(req.admin.admin_id, 'DELETE_PRODUCT', 'PRODUCT', id, {
        product_name: productName
      });

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product categories
router.get('/categories', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pc.*,
        COUNT(p.id) as product_count
      FROM product_category pc
      LEFT JOIN product p ON pc.id = p.category_id
      GROUP BY pc.id
      ORDER BY pc.name
    `);

    res.json({
      categories: result.rows
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category
router.post('/categories', authenticateAdmin, requireClearance('PRODUCT_MANAGER'), async (req, res) => {
  try {
    const { name, description, image_url } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const result = await pool.query(`
      INSERT INTO product_category (name, description, image_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, description, image_url]);

    await logAdminAction(req.admin.admin_id, 'CREATE_CATEGORY', 'CATEGORY', result.rows[0].id, {
      category_name: name
    });

    res.status(201).json({ message: 'Category created successfully', category: result.rows[0] });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// INVENTORY MANAGEMENT ENDPOINTS
// =====================

// Get inventory overview
router.get('/inventory', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      low_stock_only = false, 
      sort_by = 'stock', 
      sort_order = 'ASC',
      category,
      search
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (low_stock_only === 'true') {
      whereClause += ' AND pa.stock <= 10';
    }

    if (category) {
      paramCount++;
      whereClause += ` AND p.category_id = $${paramCount}`;
      values.push(category);
    }

    if (search) {
      paramCount++;
      // Search by name or product ID
      whereClause += ` AND (p.name ILIKE $${paramCount} OR p.id::text = $${paramCount.toString()})`;
      values.push(`%${search}%`);
    }

    // Safe sorting options for inventory
    const validSortFields = {
      'name': 'p.name',
      'stock': 'pa.stock',
      'cost': 'pa.cost',
      'units_sold': 'pa.units_sold',
      'value': '(pa.stock * pa.cost)',
      'category': 'pc.name',
      'selling_price': 'p.price'
    };

    const sortField = validSortFields[sort_by] || 'pa.stock';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        p.id,
        p.name,
        p.price as selling_price,
        pa.stock,
        pa.cost as inventory_cost,
        pa.units_sold,
        pc.name as category_name,
        p.availability
      FROM product p
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      LEFT JOIN product_category pc ON p.category_id = pc.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*)
      FROM product p
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      LEFT JOIN product_category pc ON p.category_id = pc.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values.slice(0, -2));

    // Get inventory stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN pa.stock <= 10 THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN pa.stock = 0 THEN 1 END) as out_of_stock_count,
        SUM(pa.stock * pa.cost) as total_inventory_value
      FROM product p
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
    `);

    res.json({
      inventory: result.rows,
      stats: statsResult.rows[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update stock
router.put('/inventory/:product_id/stock', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
  try {
    const { product_id } = req.params;
    const { stock, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'

    if (stock === undefined) {
      return res.status(400).json({ error: 'Stock value is required' });
    }

    let updateQuery;
    let stockValue;

    switch (operation) {
      case 'add':
        updateQuery = 'UPDATE product_attribute SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 RETURNING stock';
        stockValue = stock;
        break;
      case 'subtract':
        updateQuery = 'UPDATE product_attribute SET stock = GREATEST(stock - $1, 0), updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 RETURNING stock';
        stockValue = stock;
        break;
      default: // 'set'
        updateQuery = 'UPDATE product_attribute SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 RETURNING stock';
        stockValue = stock;
    }

    const result = await pool.query(updateQuery, [stockValue, product_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await logAdminAction(req.admin.admin_id, 'UPDATE_STOCK', 'PRODUCT', product_id, {
      operation,
      stock_change: stock,
      new_stock: result.rows[0].stock
    });

    res.json({ message: 'Stock updated successfully', new_stock: result.rows[0].stock });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// ORDER MANAGEMENT ENDPOINTS
// =====================

// Get all orders with filters
router.get('/orders', authenticateAdmin, requireClearance('ORDER_MANAGER'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, payment_status, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND o.status = $${paramCount}`;
      values.push(status);
    }

    if (payment_status !== undefined && payment_status !== '') {
      paramCount++;
      whereClause += ` AND o.payment_status = $${paramCount}`;
      values.push(payment_status === 'true');
    }

    if (date_from) {
      paramCount++;
      whereClause += ` AND o.order_date >= $${paramCount}`;
      values.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereClause += ` AND o.order_date <= $${paramCount}`;
      values.push(date_to);
    }

    const query = `
      SELECT 
        o.*,
        gu.full_name as customer_name,
        gu.email as customer_email,
        gu.contact_no as customer_phone,
        COUNT(oi.id) as item_count,
        CONCAT(sa.address, ', ', sa.city, ', ', sa.zip_code, ', ', sa.country) as shipping_address
      FROM "order" o
      LEFT JOIN customer c ON o.customer_id = c.id
      LEFT JOIN general_user gu ON c.user_id = gu.id
      LEFT JOIN order_item oi ON o.id = oi.order_id
      LEFT JOIN shipping_address sa ON o.shipping_address_id = sa.id
      ${whereClause}
      GROUP BY o.id, gu.full_name, gu.email, gu.contact_no, sa.address, sa.city, sa.zip_code, sa.country
      ORDER BY o.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT o.id)
      FROM "order" o
      LEFT JOIN customer c ON o.customer_id = c.id
      LEFT JOIN general_user gu ON c.user_id = gu.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values.slice(0, -2));

    res.json({
      orders: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single order with items
router.get('/orders/:id', authenticateAdmin, requireClearance('ORDER_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get order details
    const orderResult = await pool.query(`
      SELECT 
        o.*,
        gu.full_name as customer_name,
        gu.email as customer_email,
        gu.contact_no as customer_phone,
        CONCAT(sa.address, ', ', sa.city, ', ', sa.zip_code, ', ', sa.country) as shipping_address,
        sa.city,
        sa.zip_code,
        sa.country
      FROM "order" o
      LEFT JOIN customer c ON o.customer_id = c.id
      LEFT JOIN general_user gu ON c.user_id = gu.id
      LEFT JOIN shipping_address sa ON o.shipping_address_id = sa.id
      WHERE o.id = $1
    `, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order items
    const itemsResult = await pool.query(`
      SELECT 
        oi.*,
        p.name as product_name,
        p.image_url as product_image
      FROM order_item oi
      LEFT JOIN product p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [id]);

    const order = {
      ...orderResult.rows[0],
      items: itemsResult.rows
    };

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status with stock management
router.put('/orders/:id/status', authenticateAdmin, requireClearance('ORDER_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_status, admin_notes } = req.body;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current order status
      const currentOrderResult = await client.query('SELECT status FROM "order" WHERE id = $1', [id]);
      if (currentOrderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }

      const currentStatus = currentOrderResult.rows[0].status;

      // If approving order (changing from pending to processing), deduct stock
      if (currentStatus === 'pending' && status === 'processing') {
        // Get order items
        const itemsResult = await client.query(`
          SELECT oi.product_id, oi.quantity, p.name as product_name
          FROM order_item oi
          LEFT JOIN product p ON oi.product_id = p.id
          WHERE oi.order_id = $1 AND oi.product_id IS NOT NULL
        `, [id]);

        // Check and deduct stock for each item
        for (const item of itemsResult.rows) {
          // Check current stock
          const stockResult = await client.query(
            'SELECT stock FROM product_attribute WHERE product_id = $1',
            [item.product_id]
          );

          if (stockResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: `Product attribute not found for product: ${item.product_name}` 
            });
          }

          const currentStock = stockResult.rows[0].stock;
          if (currentStock < item.quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: `Insufficient stock for ${item.product_name}. Available: ${currentStock}, Required: ${item.quantity}` 
            });
          }

          // Deduct stock
          await client.query(
            'UPDATE product_attribute SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2',
            [item.quantity, item.product_id]
          );
        }
      }

      // If cancelling order (changing to cancelled), restore stock
      if (status === 'cancelled' && currentStatus !== 'cancelled') {
        // Get order items
        const itemsResult = await client.query(`
          SELECT oi.product_id, oi.quantity
          FROM order_item oi
          WHERE oi.order_id = $1 AND oi.product_id IS NOT NULL
        `, [id]);

        // Restore stock for each item
        for (const item of itemsResult.rows) {
          await client.query(
            'UPDATE product_attribute SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2',
            [item.quantity, item.product_id]
          );
        }
      }

      // Update order
      const updateFields = [];
      const values = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        values.push(status);
      }

      if (payment_status !== undefined) {
        paramCount++;
        updateFields.push(`payment_status = $${paramCount}`);
        values.push(payment_status);
      }

      if (admin_notes !== undefined) {
        paramCount++;
        updateFields.push(`admin_notes = $${paramCount}`);
        values.push(admin_notes);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE "order" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1}
        RETURNING *
      `;

      const result = await client.query(query, values);
      await client.query('COMMIT');

      await logAdminAction(req.admin.admin_id, 'UPDATE_ORDER', 'ORDER', id, {
        old_status: currentStatus,
        new_status: status,
        payment_status,
        admin_notes
      });

      res.json({ 
        message: 'Order updated successfully', 
        order: result.rows[0],
        stock_updated: currentStatus === 'pending' && status === 'processing'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk update order status
router.put('/orders/bulk/status', authenticateAdmin, requireClearance('ORDER_MANAGER'), async (req, res) => {
  try {
    const { order_ids, status, payment_status } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ error: 'order_ids array is required' });
    }

    const client = await pool.connect();
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      await client.query('BEGIN');

      for (const orderId of order_ids) {
        try {
          // Get current order status for stock management
          const currentOrderResult = await client.query('SELECT status FROM "order" WHERE id = $1', [orderId]);
          if (currentOrderResult.rows.length === 0) {
            results.push({ order_id: orderId, success: false, error: 'Order not found' });
            errorCount++;
            continue;
          }

          const currentStatus = currentOrderResult.rows[0].status;

          // Handle stock management if approving order
          if (currentStatus === 'pending' && status === 'processing') {
            const itemsResult = await client.query(`
              SELECT oi.product_id, oi.quantity, p.name as product_name
              FROM order_item oi
              LEFT JOIN product p ON oi.product_id = p.id
              WHERE oi.order_id = $1 AND oi.product_id IS NOT NULL
            `, [orderId]);

            // Check and deduct stock
            for (const item of itemsResult.rows) {
              const stockResult = await client.query(
                'SELECT stock FROM product_attribute WHERE product_id = $1',
                [item.product_id]
              );

              if (stockResult.rows.length === 0 || stockResult.rows[0].stock < item.quantity) {
                results.push({ 
                  order_id: orderId, 
                  success: false, 
                  error: `Insufficient stock for ${item.product_name}` 
                });
                errorCount++;
                continue;
              }
            }
          }

          // Update order
          const updateFields = [];
          const values = [];
          let paramCount = 0;

          if (status) {
            paramCount++;
            updateFields.push(`status = $${paramCount}`);
            values.push(status);
          }

          if (payment_status !== undefined) {
            paramCount++;
            updateFields.push(`payment_status = $${paramCount}`);
            values.push(payment_status);
          }

          updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
          values.push(orderId);

          const query = `
            UPDATE "order" 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount + 1}
            RETURNING *
          `;

          await client.query(query, values);
          
          await logAdminAction(req.admin.admin_id, 'BULK_UPDATE_ORDER', 'ORDER', orderId, {
            old_status: currentStatus,
            new_status: status,
            payment_status
          });

          results.push({ order_id: orderId, success: true });
          successCount++;
        } catch (error) {
          results.push({ order_id: orderId, success: false, error: error.message });
          errorCount++;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({
      message: `Bulk update completed. Success: ${successCount}, Errors: ${errorCount}`,
      results,
      summary: { success: successCount, errors: errorCount }
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add notes to order
router.put('/orders/:id/notes', authenticateAdmin, requireClearance('ORDER_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const result = await pool.query(`
      UPDATE "order" 
      SET admin_notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [admin_notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await logAdminAction(req.admin.admin_id, 'UPDATE_ORDER_NOTES', 'ORDER', id, {
      notes: admin_notes
    });

    res.json({ message: 'Order notes updated successfully', order: result.rows[0] });
  } catch (error) {
    console.error('Error updating order notes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get order analytics
router.get('/orders/analytics/dashboard', authenticateAdmin, requireClearance('ORDER_MANAGER'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'year':
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '365 days'";
        break;
      default:
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const analytics = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN payment_status = true THEN 1 END) as paid_orders,
        SUM(total_price) as total_revenue,
        AVG(total_price) as average_order_value,
        SUM(CASE WHEN status = 'delivered' THEN total_price ELSE 0 END) as delivered_revenue
      FROM "order"
      ${dateFilter}
    `);

    // Get daily order trends
    const trends = await pool.query(`
      SELECT 
        DATE(order_date) as date,
        COUNT(*) as orders_count,
        SUM(total_price) as daily_revenue
      FROM "order"
      ${dateFilter}
      GROUP BY DATE(order_date)
      ORDER BY date DESC
      LIMIT 30
    `);

    // Get top products
    const topProducts = await pool.query(`
      SELECT 
        p.name as product_name,
        SUM(oi.quantity) as order_count,
        SUM(oi.total_price) as total_revenue,
        AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating ELSE NULL END) as avg_rating
      FROM order_item oi
      JOIN product p ON oi.product_id = p.id
      JOIN "order" o ON oi.order_id = o.id
      LEFT JOIN review r ON p.id = r.product_id
      ${dateFilter.replace('WHERE', 'WHERE o.')}
      GROUP BY p.id, p.name
      ORDER BY order_count DESC
      LIMIT 10
    `);

    res.json({
      overview: analytics.rows[0],
      trends: trends.rows,
      top_products: topProducts.rows
    });
  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// CUSTOMER MANAGEMENT ENDPOINTS
// =====================

// Get all customers
router.get('/customers', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (gu.full_name ILIKE $${paramCount} OR gu.email ILIKE $${paramCount} OR gu.username ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    const query = `
      SELECT 
        gu.*,
        c.points,
        COUNT(DISTINCT o.id) as order_count,
        SUM(o.total_price) as total_spent,
        MAX(o.order_date) as last_order_date
      FROM general_user gu
      LEFT JOIN customer c ON gu.id = c.user_id
      LEFT JOIN "order" o ON gu.id = o.customer_id
      ${whereClause}
      GROUP BY gu.id, c.points
      ORDER BY gu.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*)
      FROM general_user gu
      LEFT JOIN customer c ON gu.id = c.user_id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values.slice(0, -2));

    res.json({
      customers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get customer details
router.get('/customers/:id', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get customer info
    const customerResult = await pool.query(`
      SELECT 
        gu.*,
        c.points
      FROM general_user gu
      LEFT JOIN customer c ON gu.id = c.user_id
      WHERE gu.id = $1
    `, [id]);

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get customer orders
    const ordersResult = await pool.query(`
      SELECT id, order_date, status, total_price, payment_status
      FROM "order"
      WHERE customer_id = $1
      ORDER BY order_date DESC
      LIMIT 10
    `, [id]);

    // Get customer reviews
    const reviewsResult = await pool.query(`
      SELECT 
        r.*,
        p.name as product_name
      FROM review r
      LEFT JOIN product p ON r.product_id = p.id
      WHERE r.customer_id = $1
      ORDER BY r.time_added DESC
      LIMIT 5
    `, [id]);

    const customer = {
      ...customerResult.rows[0],
      recent_orders: ordersResult.rows,
      recent_reviews: reviewsResult.rows
    };

    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// PROMOTION MANAGEMENT ENDPOINTS
// =====================

// Get all promotions
router.get('/promotions', authenticateAdmin, requireClearance('PROMO_MANAGER'), async (req, res) => {
  console.log('=== PROMOTIONS ENDPOINT HIT ===');
  try {
    console.log('Fetching promotions for admin:', req.admin.admin_id);
    const result = await pool.query(`
      SELECT 
        id,
        name,
        code,
        discount_percent,
        status,
        start_date,
        end_date,
        usage_limit,
        usage_count,
        created_at,
        updated_at,
        CASE 
          WHEN start_date > CURRENT_DATE THEN 'inactive'
          WHEN end_date < CURRENT_DATE THEN 'expired'
          WHEN status = 'active' THEN 'active'
          ELSE 'inactive'
        END as computed_status,
        CASE 
          WHEN usage_limit IS NOT NULL THEN usage_count * 100.0 / usage_limit
          ELSE 0
        END as usage_percentage
      FROM promo
      ORDER BY created_at DESC
    `);

    console.log('Promotions query result:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create promotion
router.post('/promotions', authenticateAdmin, requireClearance('PROMO_MANAGER'), async (req, res) => {
  try {
    const { name, code, discount_percent, status, start_date, end_date, usage_limit } = req.body;

    // Validation
    if (!name || !code || discount_percent === undefined || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, code, discount percent, start date, and end date are required' });
    }

    if (discount_percent < 0 || discount_percent > 100) {
      return res.status(400).json({ error: 'Discount percent must be between 0 and 100' });
    }

    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Check if code already exists
    const existingPromo = await pool.query('SELECT id FROM promo WHERE code = $1', [code]);
    if (existingPromo.rows.length > 0) {
      return res.status(400).json({ error: 'Promotion code already exists' });
    }

    const result = await pool.query(`
      INSERT INTO promo (name, code, discount_percent, status, start_date, end_date, usage_limit, usage_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, code, discount_percent, status || 'active', start_date, end_date, usage_limit || null, 0]);

    await logAdminAction(req.admin.admin_id, 'CREATE_PROMOTION', 'PROMO', result.rows[0].id, {
      promotion_name: name,
      code: code,
      discount_percent: discount_percent
    });

    res.status(201).json({ message: 'Promotion created successfully', promotion: result.rows[0] });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ error: 'Failed to create promotion: ' + error.message });
  }
});

// Update promotion
router.put('/promotions/:id', authenticateAdmin, requireClearance('PROMO_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, discount_percent, status, start_date, end_date, usage_limit } = req.body;

    // Validation
    if (discount_percent !== undefined && (discount_percent < 0 || discount_percent > 100)) {
      return res.status(400).json({ error: 'Discount percent must be between 0 and 100' });
    }

    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Check if code already exists for other promotions
    if (code) {
      const existingPromo = await pool.query('SELECT id FROM promo WHERE code = $1 AND id != $2', [code, id]);
      if (existingPromo.rows.length > 0) {
        return res.status(400).json({ error: 'Promotion code already exists' });
      }
    }

    const result = await pool.query(`
      UPDATE promo 
      SET name = $1, code = $2, discount_percent = $3, status = $4, 
          start_date = $5, end_date = $6, usage_limit = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [name, code, discount_percent, status, start_date, end_date, usage_limit, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    await logAdminAction(req.admin.admin_id, 'UPDATE_PROMOTION', 'PROMO', id, {
      promotion_name: name,
      code: code
    });

    res.json({ message: 'Promotion updated successfully', promotion: result.rows[0] });
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ error: 'Failed to update promotion: ' + error.message });
  }
});

// =====================
// Q&A MANAGEMENT ENDPOINTS
// =====================

// Get all product questions
router.get('/qa', authenticateAdmin, async (req, res) => {
  try {
    // Check if admin has required clearance - Product Manager or higher
    const adminLevel = req.admin.clearance_level;
    const hasAccess = adminLevel <= 3; // Product Manager (level 3) or higher (lower number)
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied. Requires Product Manager clearance or higher.' 
      });
    }

    const { page = 1, limit = 20, answered = null } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (answered !== null) {
      paramCount++;
      if (answered === 'false') {
        whereClause += ` AND qa.answer_text IS NULL`;
      } else {
        whereClause += ` AND qa.answer_text IS NOT NULL`;
      }
    }

    const query = `
      SELECT 
        pqa.*,
        p.name as product_name,
        gu.full_name as customer_name,
        qaa.answer_text,
        qaa.time_answered,
        admin_u.name as answered_by
      FROM product_qa pqa
      LEFT JOIN product p ON pqa.product_id = p.id
      LEFT JOIN general_user gu ON pqa.customer_id = gu.id
      LEFT JOIN qa_answer qaa ON pqa.id = qaa.question_id
      LEFT JOIN admin_users admin_u ON qaa.admin_id::integer = admin_u.admin_id
      ${whereClause}
      ORDER BY pqa.time_asked DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    res.json({
      questions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching Q&A:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Answer a question
router.post('/qa/:question_id/answer', authenticateAdmin, async (req, res) => {
  try {
    // Check if admin has required clearance - Product Manager or higher
    const adminLevel = req.admin.clearance_level;
    const hasAccess = adminLevel <= 3; // Product Manager (level 3) or higher (lower number)
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied. Requires Product Manager clearance or higher.' 
      });
    }

    const { question_id } = req.params;
    const { answer_text } = req.body;

    if (!answer_text) {
      return res.status(400).json({ error: 'Answer text is required' });
    }

    const result = await pool.query(`
      INSERT INTO qa_answer (question_id, answer_text, admin_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [question_id, answer_text, req.admin.admin_id]);

    await logAdminAction(req.admin.admin_id, 'ANSWER_QUESTION', 'QA', question_id, {
      answer_text
    });

    res.status(201).json({ message: 'Answer posted successfully', answer: result.rows[0] });
  } catch (error) {
    console.error('Error posting answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PROFILE MANAGEMENT ENDPOINTS
// ============================================================================

// Get current admin profile
router.get('/profile', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         a.admin_id,
         a.employee_id,
         a.name,
         a.email,
         a.clearance_level,
         a.hire_date,
         a.last_login,
         a.created_at
       FROM admin_users a 
       WHERE a.admin_id = $1`,
      [req.admin.admin_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];
    res.json(profile);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update admin profile
router.put('/profile', authenticateAdmin, async (req, res) => {
  try {
    const { name, email } = req.body;
    const adminId = req.admin.admin_id;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if email is already taken by another admin
    const emailCheck = await pool.query(
      'SELECT admin_id FROM admin_users WHERE email = $1 AND admin_id != $2',
      [email, adminId]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already taken by another admin' });
    }

    // Update profile
    const result = await pool.query(
      `UPDATE admin_users 
       SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
       WHERE admin_id = $3 
       RETURNING admin_id, employee_id, name, email, clearance_level, hire_date`,
      [name, email, adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Log the action
    await logAdminAction(adminId, 'UPDATE_PROFILE', 'admin_users', adminId, {}, { name, email });

    res.json({
      message: 'Profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change admin password
router.put('/profile/password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.admin_id;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current admin data
    const adminResult = await pool.query(
      'SELECT password FROM admin_users WHERE admin_id = $1',
      [adminId]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, adminResult.rows[0].password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE admin_users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE admin_id = $2',
      [hashedNewPassword, adminId]
    );

    // Log the action
    await logAdminAction(adminId, 'CHANGE_PASSWORD', 'admin_users', adminId, {}, {});

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove admin access (General Manager only)
router.delete('/admins/:admin_id', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { admin_id } = req.params;
    const currentAdminId = req.admin.admin_id;

    // Prevent self-removal
    if (admin_id === currentAdminId) {
      return res.status(400).json({ error: 'Cannot remove your own admin access' });
    }

    // Check if admin exists
    const adminResult = await pool.query(
      'SELECT name, email, clearance_level FROM admin_users WHERE admin_id = $1',
      [admin_id]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const adminToRemove = adminResult.rows[0];

    // Prevent removal of other General Managers (optional business rule)
    if (adminToRemove.clearance_level === 'GENERAL_MANAGER') {
      return res.status(400).json({ error: 'Cannot remove other General Managers' });
    }

    // Remove admin access (soft delete by setting is_employed to false)
    await pool.query(
      'UPDATE admin_users SET is_employed = FALSE, updated_at = CURRENT_TIMESTAMP WHERE admin_id = $1',
      [admin_id]
    );

    // Log the action
    await logAdminAction(
      currentAdminId, 
      'REMOVE_ADMIN_ACCESS', 
      'admin_users', 
      admin_id, 
      adminToRemove, 
      { is_employed: false }
    );

    // Create notification for the removed admin
    await pool.query(
      `INSERT INTO admin_notifications (admin_id, title, message, type, priority)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        admin_id,
        'Access Removed',
        `Your admin access has been removed by ${req.admin.name}`,
        'SYSTEM_ALERT',
        'high'
      ]
    );

    res.json({ 
      message: `Admin access removed for ${adminToRemove.name}`,
      removedAdmin: {
        admin_id,
        name: adminToRemove.name,
        email: adminToRemove.email,
        clearance_level: adminToRemove.clearance_level
      }
    });
  } catch (error) {
    console.error('Error removing admin access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove admin (deactivate)
router.delete('/admins/:admin_id/remove', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { admin_id } = req.params;

    // Check if trying to remove self
    if (parseInt(admin_id) === req.admin.admin_id) {
      return res.status(400).json({ message: 'Cannot remove your own admin access' });
    }

    const result = await pool.query(
      'DELETE FROM admin_users WHERE admin_id = $1 RETURNING employee_id, name',
      [admin_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const removedAdmin = result.rows[0];

    res.json({ 
      message: `Successfully removed admin access for ${removedAdmin.name}`,
      admin: removedAdmin 
    });

  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================
// ANALYTICS ENDPOINTS
// =====================

// Get order analytics (for dashboard)
router.get('/analytics/orders', authenticateAdmin, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    let dateFilter = '';
    switch (timeframe) {
      case '24h':
        dateFilter = "WHERE order_date >= CURRENT_DATE";
        break;
      case '7d':
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case '30d':
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      case '90d':
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '90 days'";
        break;
      default:
        dateFilter = "WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'";
    }

    const result = await pool.query(`
      SELECT 
        DATE(order_date) as date,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
      FROM orders 
      ${dateFilter}
      GROUP BY DATE(order_date)
      ORDER BY date ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product performance analytics
router.get('/analytics/products', authenticateAdmin, requireClearance('ANALYTICS'), async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.price,
        pa.units_sold,
        pa.stock,
        pa.units_sold * p.price as total_revenue,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count
      FROM products p
      LEFT JOIN product_attributes pa ON p.id = pa.product_id
      LEFT JOIN reviews r ON p.id = r.product_id
      GROUP BY p.id, p.name, p.price, pa.units_sold, pa.stock
      ORDER BY pa.units_sold DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sub-routers
const promotionsRouter = require('./promotions');
router.use('/promotions', authenticateAdmin, requireClearance('PROMO_MANAGER'), promotionsRouter);

// Get all access levels
router.get('/access-levels', authenticateAdmin, async (req, res) => {
  try {
    const accessLevels = await getAccessLevels();
    res.json(accessLevels);
  } catch (error) {
    console.error('Get access levels error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assignable access levels for current admin
router.get('/assignable-access-levels', authenticateAdmin, async (req, res) => {
  try {
    const assignableLevels = await getAssignableAccessLevels(req.admin.clearance_level);
    res.json(assignableLevels);
  } catch (error) {
    console.error('Get assignable access levels error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public endpoint to get access levels for signup form
router.get('/public/access-levels', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT access_level, access_name, description 
      FROM access_levels 
      WHERE access_level > 0 
      ORDER BY access_level ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get public access levels error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================
// REPORT GENERATION ENDPOINTS
// =====================

// Generate sales report
router.get('/reports/sales', authenticateAdmin, requireClearance('ANALYTICS_SPECIALIST'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        DATE(o.order_date) as date,
        COUNT(*) as orders_count,
        SUM(o.total_price) as total_revenue,
        AVG(o.total_price) as avg_order_value,
        COUNT(CASE WHEN o.payment_status = true THEN 1 END) as paid_orders
      FROM "order" o
      WHERE o.order_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(o.order_date)
      ORDER BY date DESC
    `);

    // Generate CSV
    const csvHeader = 'Date,Orders Count,Total Revenue,Average Order Value,Paid Orders\n';
    const csvData = result.rows.map(row => 
      `${row.date},${row.orders_count},${parseFloat(row.total_revenue || 0).toFixed(2)},${parseFloat(row.avg_order_value || 0).toFixed(2)},${row.paid_orders}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sales_report_${days}days.csv"`);
    res.send(csvHeader + csvData);

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
});

// Generate product performance report
router.get('/reports/products', authenticateAdmin, requireClearance('ANALYTICS_SPECIALIST'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        pc.name as category,
        pa.stock,
        pa.cost,
        p.price,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.total_price), 0) as revenue,
        COALESCE(AVG(r.rating), 0) as avg_rating
      FROM product p
      LEFT JOIN product_category pc ON p.category_id = pc.id
      LEFT JOIN product_attribute pa ON p.id = pa.product_id
      LEFT JOIN order_item oi ON p.id = oi.product_id
      LEFT JOIN "order" o ON oi.order_id = o.id AND o.order_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      LEFT JOIN review r ON p.id = r.product_id
      GROUP BY p.id, p.name, pc.name, pa.stock, pa.cost, p.price
      ORDER BY units_sold DESC
    `);

    // Generate CSV
    const csvHeader = 'Product ID,Product Name,Category,Stock,Cost,Price,Units Sold,Revenue,Average Rating\n';
    const csvData = result.rows.map(row => 
      `${row.id},"${row.name}","${row.category || ''}",${row.stock || 0},${parseFloat(row.cost || 0).toFixed(2)},${parseFloat(row.price || 0).toFixed(2)},${row.units_sold},${parseFloat(row.revenue || 0).toFixed(2)},${parseFloat(row.avg_rating || 0).toFixed(2)}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products_report_${days}days.csv"`);
    res.send(csvHeader + csvData);

  } catch (error) {
    console.error('Products report error:', error);
    res.status(500).json({ error: 'Failed to generate products report' });
  }
});

// Generate user analytics report
router.get('/reports/users', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        DATE(gu.created_at) as registration_date,
        COUNT(*) as new_users,
        COUNT(CASE WHEN c.user_id IS NOT NULL THEN 1 END) as customers,
        AVG(CASE WHEN c.points IS NOT NULL THEN c.points ELSE 0 END) as avg_points
      FROM general_user gu
      LEFT JOIN customer c ON gu.id = c.user_id
      WHERE gu.created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(gu.created_at)
      ORDER BY registration_date DESC
    `);

    // Generate CSV
    const csvHeader = 'Registration Date,New Users,Customers,Average Points\n';
    const csvData = result.rows.map(row => 
      `${row.registration_date},${row.new_users},${row.customers},${parseFloat(row.avg_points || 0).toFixed(2)}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users_report_${days}days.csv"`);
    res.send(csvHeader + csvData);

  } catch (error) {
    console.error('Users report error:', error);
    res.status(500).json({ error: 'Failed to generate users report' });
  }
});

// Generate orders analytics report
router.get('/reports/orders', authenticateAdmin, requireClearance('ORDER_MANAGER'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        o.id,
        o.order_date,
        o.status,
        o.payment_status,
        o.total_price,
        gu.full_name as customer_name,
        gu.email as customer_email,
        COUNT(oi.id) as items_count
      FROM "order" o
      LEFT JOIN customer c ON o.customer_id = c.id
      LEFT JOIN general_user gu ON c.user_id = gu.id
      LEFT JOIN order_item oi ON o.id = oi.order_id
      WHERE o.order_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY o.id, o.order_date, o.status, o.payment_status, o.total_price, gu.full_name, gu.email
      ORDER BY o.order_date DESC
    `);

    // Generate CSV
    const csvHeader = 'Order ID,Order Date,Status,Payment Status,Total Price,Customer Name,Customer Email,Items Count\n';
    const csvData = result.rows.map(row => 
      `${row.id},${row.order_date},${row.status},${row.payment_status ? 'Paid' : 'Unpaid'},${parseFloat(row.total_price || 0).toFixed(2)},"${row.customer_name || ''}","${row.customer_email || ''}",${row.items_count}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders_report_${days}days.csv"`);
    res.send(csvHeader + csvData);

  } catch (error) {
    console.error('Orders report error:', error);
    res.status(500).json({ error: 'Failed to generate orders report' });
  }
});

// Reviews Management Endpoints
// Get all reviews and ratings (PRODUCT_MANAGER and GENERAL_MANAGER can access)
router.get('/reviews', authenticateAdmin, async (req, res) => {
  try {
    // Check if admin has required clearance
    const adminLevel = req.admin.clearance_level;
    const hasAccess = adminLevel <= 3; // Product Manager (level 3) or higher (lower number)
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied. Requires Product Manager clearance or higher.' 
      });
    }

    const result = await pool.query(`
      SELECT 
        r.id,
        r.product_id,
        r.user_id,
        r.order_id,
        r.order_item_id,
        r.rating,
        r.review_text,
        r.created_at,
        r.updated_at,
        p.name as product_name,
        p.image_url as product_image,
        gu.username,
        gu.full_name,
        gu.email as user_email
      FROM ratings r
      JOIN product p ON r.product_id = p.id
      JOIN general_user gu ON r.user_id = gu.id
      ORDER BY r.created_at DESC
    `);

    await logAdminAction(req.admin.admin_id, 'VIEW_REVIEWS', `Viewed all reviews (${result.rows.length} total)`);
    res.json(result.rows);

  } catch (error) {
    console.error('Fetch reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Delete a review (PRODUCT_MANAGER and GENERAL_MANAGER can delete)
router.delete('/reviews/:review_id', authenticateAdmin, async (req, res) => {
  try {
    const { review_id } = req.params;
    const adminLevel = req.admin.clearance_level;
    const hasAccess = adminLevel <= 3; // Product Manager (level 3) or higher (lower number)
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied. Requires Product Manager clearance or higher.' 
      });
    }

    // Get review details before deletion for logging
    const reviewResult = await pool.query(`
      SELECT r.id, r.rating, r.review_text, p.name as product_name, gu.username
      FROM ratings r
      JOIN product p ON r.product_id = p.id
      JOIN general_user gu ON r.user_id = gu.id
      WHERE r.id = $1
    `, [review_id]);

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = reviewResult.rows[0];

    // Delete the review
    const deleteResult = await pool.query(
      'DELETE FROM ratings WHERE id = $1 RETURNING id',
      [review_id]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await logAdminAction(
      req.admin.admin_id, 
      'DELETE_REVIEW', 
      `Deleted review ID ${review_id} by ${review.username} for product "${review.product_name}" (Rating: ${review.rating}/10)`
    );

    res.json({ 
      message: 'Review deleted successfully',
      deleted_review: {
        id: review_id,
        product_name: review.product_name,
        username: review.username,
        rating: review.rating
      }
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Get reviews statistics for analytics
router.get('/reviews/stats', authenticateAdmin, async (req, res) => {
  try {
    const adminLevel = req.admin.clearance_level;
    const hasAccess = adminLevel <= 3; // Product Manager (level 3) or higher (lower number)
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied. Requires Product Manager clearance or higher.' 
      });
    }

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_reviews,
        ROUND(AVG(rating), 2) as average_rating,
        COUNT(CASE WHEN rating >= 8 THEN 1 END) as high_ratings,
        COUNT(CASE WHEN rating >= 4 AND rating < 8 THEN 1 END) as medium_ratings,
        COUNT(CASE WHEN rating < 4 THEN 1 END) as low_ratings,
        COUNT(CASE WHEN review_text IS NOT NULL AND review_text != '' THEN 1 END) as reviews_with_text,
        COUNT(DISTINCT product_id) as products_with_reviews,
        COUNT(DISTINCT user_id) as users_who_reviewed
      FROM ratings
    `);

    const topRatedProductsResult = await pool.query(`
      SELECT 
        p.id,
        p.name,
        ROUND(AVG(r.rating), 2) as average_rating,
        COUNT(r.id) as review_count
      FROM ratings r
      JOIN product p ON r.product_id = p.id
      GROUP BY p.id, p.name
      HAVING COUNT(r.id) >= 3
      ORDER BY AVG(r.rating) DESC, COUNT(r.id) DESC
      LIMIT 10
    `);

    const recentActivityResult = await pool.query(`
      SELECT 
        DATE(r.created_at) as review_date,
        COUNT(*) as reviews_count,
        ROUND(AVG(r.rating), 2) as avg_rating
      FROM ratings r
      WHERE r.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(r.created_at)
      ORDER BY review_date DESC
    `);

    res.json({
      overall_stats: statsResult.rows[0],
      top_rated_products: topRatedProductsResult.rows,
      recent_activity: recentActivityResult.rows
    });

  } catch (error) {
    console.error('Reviews stats error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews statistics' });
  }
});

module.exports = router;

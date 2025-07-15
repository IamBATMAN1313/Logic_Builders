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

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const adminResult = await pool.query(
      'SELECT admin_id, employee_id, name, clearance_level FROM admin_users WHERE admin_id = $1',
      [decoded.admin_id]
    );

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

// Check admin clearance
const requireClearance = (requiredClearance) => {
  return (req, res, next) => {
    const { clearance_level } = req.admin;
    
    // GENERAL_MANAGER has access to everything
    if (clearance_level === 'GENERAL_MANAGER') {
      return next();
    }
    
    // Check specific clearance
    if (clearance_level === requiredClearance) {
      return next();
    }
    
    return res.status(403).json({ 
      message: 'Insufficient clearance level.',
      required: requiredClearance,
      current: clearance_level
    });
  };
};

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { employee_id, password } = req.body;

    // Get admin by employee_id
    const adminResult = await pool.query(
      'SELECT * FROM admin_users WHERE employee_id = $1',
      [employee_id]
    );

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

    // Check if employee_id already exists
    const existingRequest = await pool.query(
      'SELECT * FROM admin_signup_requests WHERE employee_id = $1',
      [employee_id]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ message: 'Request already exists for this employee ID' });
    }

    // Check if already an active admin
    const existingAdmin = await pool.query(
      'SELECT * FROM admin_users WHERE employee_id = $1',
      [employee_id]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ message: 'Admin already exists with this employee ID' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create signup request
    const result = await pool.query(`
      INSERT INTO admin_signup_requests 
      (employee_id, name, email, password, phone, department, position, reason_for_access, requested_clearance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING request_id, employee_id, name, email, department, position, requested_clearance, created_at
    `, [employee_id, name, email, hashedPassword, phone, department, position, reason_for_access, requested_clearance]);

    const request = result.rows[0];

    // Notify all GENERAL_MANAGERS
    await createNotificationForClearance(
      'GENERAL_MANAGER',
      'SIGNUP_REQUEST',
      'New Admin Signup Request',
      `${name} (${employee_id}) has requested admin access for ${department} department.`,
      request.request_id
    );

    res.status(201).json({
      message: 'Admin signup request submitted successfully',
      request: {
        request_id: request.request_id,
        employee_id: request.employee_id,
        name: request.name,
        status: 'PENDING'
      }
    });

  } catch (error) {
    console.error('Admin signup request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending signup requests (GENERAL_MANAGER only)
router.get('/signup-requests', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        request_id, employee_id, name, email, phone, department, position,
        reason_for_access, requested_clearance, status, created_at,
        assigned_clearance, approved_at,
        au.name as approved_by_name
      FROM admin_signup_requests asr
      LEFT JOIN admin_users au ON asr.approved_by = au.admin_id
      ORDER BY 
        CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
        created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get signup requests error:', error);
    res.status(500).json({ message: 'Server error' });
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
router.get('/products', authenticateAdmin, requireClearance('PRODUCT_EXPERT'), async (req, res) => {
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
router.get('/products/:id', authenticateAdmin, requireClearance('PRODUCT_EXPERT'), async (req, res) => {
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
router.post('/products', authenticateAdmin, requireClearance('PRODUCT_EXPERT'), async (req, res) => {
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
router.put('/products/:id', authenticateAdmin, requireClearance('PRODUCT_EXPERT'), async (req, res) => {
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
router.delete('/products/:id', authenticateAdmin, requireClearance('PRODUCT_EXPERT'), async (req, res) => {
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
router.post('/categories', authenticateAdmin, requireClearance('PRODUCT_EXPERT'), async (req, res) => {
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
router.get('/orders', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
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
router.get('/orders/:id', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
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
router.put('/orders/:id/status', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
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
router.put('/orders/bulk/status', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
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

              await client.query(
                'UPDATE product_attribute SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2',
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
router.put('/orders/:id/notes', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
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
router.get('/orders/analytics/dashboard', authenticateAdmin, requireClearance('INVENTORY_MANAGER'), async (req, res) => {
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
        AVG(CASE WHEN pr.rating IS NOT NULL THEN pr.rating ELSE NULL END) as avg_rating
      FROM order_item oi
      JOIN product p ON oi.product_id = p.id
      JOIN "order" o ON oi.order_id = o.id
      LEFT JOIN product_review pr ON p.id = pr.product_id
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
router.get('/promotions', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        *,
        CASE 
          WHEN start_date > CURRENT_DATE THEN 'upcoming'
          WHEN end_date < CURRENT_DATE THEN 'expired'
          ELSE 'active'
        END as computed_status
      FROM promo
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create promotion
router.post('/promotions', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { name, discount_percent, status, start_date, end_date } = req.body;

    if (!name || !discount_percent || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, discount percent, start date, and end date are required' });
    }

    const result = await pool.query(`
      INSERT INTO promo (name, discount_percent, status, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, discount_percent, status || 'active', start_date, end_date]);

    await logAdminAction(req.admin.admin_id, 'CREATE_PROMOTION', 'PROMOTION', result.rows[0].id, {
      promotion_name: name,
      discount_percent
    });

    res.status(201).json({ message: 'Promotion created successfully', promotion: result.rows[0] });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update promotion
router.put('/promotions/:id', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, discount_percent, status, start_date, end_date } = req.body;

    const result = await pool.query(`
      UPDATE promo 
      SET name = $1, discount_percent = $2, status = $3, start_date = $4, end_date = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [name, discount_percent, status, start_date, end_date, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    await logAdminAction(req.admin.admin_id, 'UPDATE_PROMOTION', 'PROMOTION', id, {
      promotion_name: name
    });

    res.json({ message: 'Promotion updated successfully', promotion: result.rows[0] });
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// Q&A MANAGEMENT ENDPOINTS
// =====================

// Get all product questions
router.get('/qa', authenticateAdmin, async (req, res) => {
  try {
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

// Get admin management analytics
router.get('/analytics/dashboard', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    // Get clearance distribution
    const clearanceDistribution = await pool.query(`
      SELECT 
        clearance_level,
        COUNT(*) as count
      FROM admin_users 
      GROUP BY clearance_level
      ORDER BY count DESC
    `);

    // Get user growth over time (last 12 months)
    const userGrowth = await pool.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as new_users
      FROM general_user 
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `);

    res.json({
      clearanceDistribution: clearanceDistribution.rows,
      userGrowth: userGrowth.rows
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update admin clearance level
router.put('/admins/:adminId/clearance', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { adminId } = req.params;
    const { clearance_level } = req.body;

    if (!clearance_level) {
      return res.status(400).json({ error: 'Clearance level is required' });
    }

    const validClearances = ['INVENTORY_MANAGER', 'PRODUCT_EXPERT', 'ORDER_MANAGER', 'PROMO_MANAGER', 'ANALYTICS', 'GENERAL_MANAGER'];
    if (!validClearances.includes(clearance_level)) {
      return res.status(400).json({ error: 'Invalid clearance level' });
    }

    // Check if admin exists
    const adminCheck = await pool.query('SELECT * FROM admin_users WHERE admin_id = $1', [adminId]);
    if (adminCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const oldAdmin = adminCheck.rows[0];

    // Update clearance level
    await pool.query(
      'UPDATE admin_users SET clearance_level = $1, updated_at = CURRENT_TIMESTAMP WHERE admin_id = $2',
      [clearance_level, adminId]
    );

    // Log the action
    await logAdminAction(req.admin.admin_id, 'UPDATE_CLEARANCE', 'ADMIN', adminId, {
      old_clearance: oldAdmin.clearance_level,
      new_clearance: clearance_level,
      target_employee_id: oldAdmin.employee_id
    });

    res.json({ message: 'Clearance level updated successfully' });
  } catch (error) {
    console.error('Error updating admin clearance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get logs for specific admin
router.get('/logs', authenticateAdmin, requireClearance('GENERAL_MANAGER'), async (req, res) => {
  try {
    const { admin_id } = req.query;
    let query = `
      SELECT 
        al.*,
        au.name as admin_name,
        au.employee_id
      FROM admin_logs al
      JOIN admin_users au ON al.admin_id = au.admin_id
    `;
    
    const values = [];
    let paramCount = 0;

    if (admin_id) {
      paramCount++;
      query += ` WHERE al.admin_id = $${paramCount}`;
      values.push(admin_id);
    }

    query += ' ORDER BY al.created_at DESC LIMIT 100';

    const result = await pool.query(query, values);
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate reports
router.get('/reports/:type', authenticateAdmin, requireClearance('ANALYTICS'), async (req, res) => {
  try {
    const { type } = req.params;
    const { days = 30 } = req.query;
    
    let query, filename;
    const values = [days];

    switch (type) {
      case 'sales':
        query = `
          SELECT 
            o.id as order_id,
            o.order_date,
            o.total_price,
            o.status,
            o.payment_status,
            gu.full_name as customer_name,
            gu.email as customer_email
          FROM "order" o
          JOIN customer c ON o.customer_id = c.id
          JOIN general_user gu ON c.user_id = gu.id
          WHERE o.order_date >= CURRENT_DATE - INTERVAL '${days} days'
          ORDER BY o.order_date DESC
        `;
        filename = 'sales_report.csv';
        break;

      case 'products':
        query = `
          SELECT 
            p.name,
            p.brand,
            p.category,
            pa.price,
            pa.stock,
            COUNT(oi.product_id) as total_orders,
            SUM(oi.total_price) as total_revenue
          FROM product p
          LEFT JOIN product_attribute pa ON p.id = pa.product_id
          LEFT JOIN order_item oi ON p.id = oi.product_id
          LEFT JOIN "order" o ON oi.order_id = o.id AND o.order_date >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY p.id, p.name, p.brand, p.category, pa.price, pa.stock
          ORDER BY total_revenue DESC NULLS LAST
        `;
        filename = 'product_performance.csv';
        break;

      case 'users':
        query = `
          SELECT 
            gu.username,
            gu.full_name,
            gu.email,
            gu.contact_no,
            gu.created_at,
            COUNT(o.id) as total_orders,
            COALESCE(SUM(o.total_price), 0) as total_spent
          FROM general_user gu
          LEFT JOIN customer c ON gu.id = c.user_id
          LEFT JOIN "order" o ON c.id = o.customer_id
          WHERE gu.created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY gu.id, gu.username, gu.full_name, gu.email, gu.contact_no, gu.created_at
          ORDER BY gu.created_at DESC
        `;
        filename = 'user_analytics.csv';
        break;

      case 'orders':
        query = `
          SELECT 
            o.id,
            o.order_date,
            o.status,
            o.payment_status,
            o.payment_method,
            o.total_price,
            o.delivery_charge,
            o.discount_amount,
            gu.full_name as customer_name,
            COUNT(oi.id) as item_count
          FROM "order" o
          JOIN customer c ON o.customer_id = c.id
          JOIN general_user gu ON c.user_id = gu.id
          LEFT JOIN order_item oi ON o.id = oi.order_id
          WHERE o.order_date >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY o.id, o.order_date, o.status, o.payment_status, o.payment_method, 
                   o.total_price, o.delivery_charge, o.discount_amount, gu.full_name
          ORDER BY o.order_date DESC
        `;
        filename = 'order_analytics.csv';
        break;

      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    const result = await pool.query(query);
    
    // Convert to CSV
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified period' });
    }

    const headers = Object.keys(result.rows[0]);
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Notifications endpoints
router.get('/notifications', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.admin_id;
    const { limit = 50, unread_only = false } = req.query;
    
    let query = `
      SELECT id, type, title, message, link, is_read, created_at
      FROM notifications
      WHERE admin_id = $1
    `;
    
    const values = [adminId];
    
    if (unread_only === 'true') {
      query += ' AND is_read = FALSE';
    }
    
    query += ' ORDER BY created_at DESC LIMIT $2';
    values.push(limit);
    
    const result = await pool.query(query, values);
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications/unread-count', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.admin_id;
    
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE admin_id = $1 AND is_read = FALSE',
      [adminId]
    );
    
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/notifications/:id/read', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.admin_id;
    
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND admin_id = $2 RETURNING *',
      [id, adminId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/notifications/mark-all-read', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.admin_id;
    
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE admin_id = $1 AND is_read = FALSE',
      [adminId]
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sub-routers
const promotionsRouter = require('./promotions');
router.use('/promotions', authenticateAdmin, requireClearance('PROMO_MANAGER'), promotionsRouter);

module.exports = router;

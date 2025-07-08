const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../../db/connection');
const authenticateToken = require('../../middlewares/authenticateToken');

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Changed from req.user.userId to req.user.id
    
    const userQuery = `
      SELECT u.username, u.email, u.full_name, u.contact_no, u.gender, u.profile_img,
             c.id as customer_id
      FROM general_user u
      LEFT JOIN customer c ON u.id = c.user_id
      WHERE u.id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Split full_name into firstName and lastName
    const nameParts = user.full_name ? user.full_name.split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    res.json({
      username: user.username,
      email: user.email,
      firstName,
      lastName,
      phone: user.contact_no,
      gender: user.gender,
      profileImg: user.profile_img,
      customerId: user.customer_id
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Changed from req.user.userId
    const { email, firstName, lastName, phone, gender } = req.body;

    // Combine firstName and lastName into full_name
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();

    const updateQuery = `
      UPDATE general_user 
      SET email = $1, full_name = $2, contact_no = $3, gender = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING username, email, full_name, contact_no, gender, profile_img
    `;

    const result = await pool.query(updateQuery, [email, fullName, phone, gender, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    // Split full_name back into firstName and lastName for response
    const nameParts = user.full_name ? user.full_name.split(' ') : ['', ''];
    const responseFirstName = nameParts[0] || '';
    const responseLastName = nameParts.slice(1).join(' ') || '';

    res.json({
      username: user.username,
      email: user.email,
      firstName: responseFirstName,
      lastName: responseLastName,
      phone: user.contact_no,
      gender: user.gender,
      profileImg: user.profile_img
    });
  } catch (err) {
    console.error('Update profile error:', err);
    if (err.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Email or phone number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
});

// Update password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Fixed: changed from req.user.userId
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current password hash
    const userQuery = 'SELECT password_hash FROM general_user WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and update
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    const updateQuery = `
      UPDATE general_user 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    await pool.query(updateQuery, [newPasswordHash, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Get user addresses
router.get('/addresses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Fixed: changed from req.user.userId
    
    // First get customer_id
    const customerQuery = 'SELECT id FROM customer WHERE user_id = $1';
    const customerResult = await pool.query(customerQuery, [userId]);
    
    if (customerResult.rows.length === 0) {
      return res.json([]); // No customer record, return empty addresses
    }

    const customerId = customerResult.rows[0].id;

    const addressesQuery = `
      SELECT id, address, city, zip_code, country
      FROM shipping_address
      WHERE customer_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(addressesQuery, [customerId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get addresses error:', err);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// Add new address
router.post('/addresses', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Fixed: changed from req.user.userId
    const { address, city, zipCode, country } = req.body;

    if (!address || !city || !zipCode || !country) {
      return res.status(400).json({ error: 'All address fields are required' });
    }

    // Get or create customer record
    let customerQuery = 'SELECT id FROM customer WHERE user_id = $1';
    let customerResult = await pool.query(customerQuery, [userId]);
    
    let customerId;
    if (customerResult.rows.length === 0) {
      // Create customer record
      const createCustomerQuery = `
        INSERT INTO customer (user_id, created_at, updated_at) 
        VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        RETURNING id
      `;
      const newCustomerResult = await pool.query(createCustomerQuery, [userId]);
      customerId = newCustomerResult.rows[0].id;
    } else {
      customerId = customerResult.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO shipping_address (customer_id, address, city, zip_code, country)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, address, city, zip_code, country
    `;

    const result = await pool.query(insertQuery, [customerId, address, city, zipCode, country]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add address error:', err);
    res.status(500).json({ error: 'Failed to add address' });
  }
});

// Update address
router.put('/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Fixed: changed from req.user.userId
    const { id } = req.params;
    const { address, city, zipCode, country } = req.body;

    if (!address || !city || !zipCode || !country) {
      return res.status(400).json({ error: 'All address fields are required' });
    }

    // Verify address belongs to user
    const verifyQuery = `
      SELECT sa.id 
      FROM shipping_address sa
      JOIN customer c ON sa.customer_id = c.id
      WHERE sa.id = $1 AND c.user_id = $2
    `;

    const verifyResult = await pool.query(verifyQuery, [id, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found or not authorized' });
    }

    const updateQuery = `
      UPDATE shipping_address
      SET address = $1, city = $2, zip_code = $3, country = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, address, city, zip_code, country
    `;

    const result = await pool.query(updateQuery, [address, city, zipCode, country, id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update address error:', err);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// Delete address
router.delete('/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Fixed: changed from req.user.userId
    const { id } = req.params;

    // Verify address belongs to user
    const verifyQuery = `
      SELECT sa.id 
      FROM shipping_address sa
      JOIN customer c ON sa.customer_id = c.id
      WHERE sa.id = $1 AND c.user_id = $2
    `;

    const verifyResult = await pool.query(verifyQuery, [id, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found or not authorized' });
    }

    const deleteQuery = 'DELETE FROM shipping_address WHERE id = $1';
    await pool.query(deleteQuery, [id]);

    res.json({ message: 'Address deleted successfully' });
  } catch (err) {
    console.error('Delete address error:', err);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

module.exports = router;

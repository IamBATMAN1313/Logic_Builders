// Access Level Helper Functions
// Provides utilities for working with the numerical clearance level system

const pool = require('../db/connection');

// Access level mapping for backward compatibility
const ACCESS_LEVEL_MAP = {
  'GENERAL_MANAGER': 0,
  'PRODUCT_DIRECTOR': 1,
  'INVENTORY_MANAGER': 2,
  'PRODUCT_EXPERT': 3,
  'ORDER_MANAGER': 4,
  'PROMO_MANAGER': 5,
  'ANALYTICS': 6,
  'INVENTORY_SPECIALIST': 7,
  'DELIVERY_COORDINATOR': 8
};

// Reverse mapping (numbers to names)
const ACCESS_NAME_MAP = {
  0: 'GENERAL_MANAGER',
  1: 'PRODUCT_DIRECTOR',
  2: 'INVENTORY_MANAGER',
  3: 'PRODUCT_EXPERT',
  4: 'ORDER_MANAGER',
  5: 'PROMO_MANAGER',
  6: 'ANALYTICS',
  7: 'INVENTORY_SPECIALIST',
  8: 'DELIVERY_COORDINATOR'
};

/**
 * Get all available access levels from database
 */
async function getAccessLevels() {
  try {
    const result = await pool.query(
      'SELECT access_level, access_name, description FROM access_levels ORDER BY access_level'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching access levels:', error);
    throw error;
  }
}

/**
 * Convert string clearance to numerical level
 */
function stringToLevel(clearanceString) {
  return ACCESS_LEVEL_MAP[clearanceString] ?? null;
}

/**
 * Convert numerical level to string clearance
 */
function levelToString(clearanceLevel) {
  return ACCESS_NAME_MAP[clearanceLevel] ?? null;
}

/**
 * Check if admin has required permission
 * @param {number} adminLevel - Admin's clearance level
 * @param {number|string} requiredLevel - Required clearance level
 */
function hasPermission(adminLevel, requiredLevel) {
  // Convert string to number if needed
  const requiredLevelNum = typeof requiredLevel === 'string' 
    ? stringToLevel(requiredLevel) 
    : requiredLevel;
  
  const adminLevelNum = typeof adminLevel === 'string' 
    ? stringToLevel(adminLevel) 
    : adminLevel;

  // Lower or equal number means higher or equal authority
  return adminLevelNum <= requiredLevelNum;
}

/**
 * Check if an admin can manage another admin
 * @param {number} managerLevel - Manager's clearance level
 * @param {number} targetLevel - Target admin's clearance level
 */
function canManageAdmin(managerLevel, targetLevel) {
  // Can only manage admins with higher level numbers (lower authority)
  return managerLevel < targetLevel;
}

/**
 * Get access levels that an admin can assign to others
 * @param {number} adminLevel - Admin's clearance level
 */
async function getAssignableAccessLevels(adminLevel) {
  try {
    // Can only assign levels with higher numbers (lower authority) than their own
    const result = await pool.query(
      'SELECT access_level, access_name, description FROM access_levels WHERE access_level > $1 ORDER BY access_level',
      [adminLevel]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching assignable access levels:', error);
    throw error;
  }
}

/**
 * Get human-readable access name by level
 */
async function getAccessNameByLevel(level) {
  try {
    const result = await pool.query(
      'SELECT access_name FROM access_levels WHERE access_level = $1',
      [level]
    );
    return result.rows[0]?.access_name || null;
  } catch (error) {
    console.error('Error fetching access name:', error);
    return null;
  }
}

/**
 * Middleware to require specific clearance level
 */
function requireClearance(requiredLevel) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    if (!hasPermission(req.admin.clearance_level, requiredLevel)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: typeof requiredLevel === 'number' 
          ? levelToString(requiredLevel) 
          : requiredLevel,
        current: typeof req.admin.clearance_level === 'number' 
          ? levelToString(req.admin.clearance_level) 
          : req.admin.clearance_level
      });
    }

    next();
  };
}

module.exports = {
  ACCESS_LEVEL_MAP,
  ACCESS_NAME_MAP,
  getAccessLevels,
  stringToLevel,
  levelToString,
  hasPermission,
  canManageAdmin,
  getAssignableAccessLevels,
  getAccessNameByLevel,
  requireClearance
};

import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if admin is logged in on app start
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      validateToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const validateToken = async (token) => {
    try {
      const response = await fetch('/api/admin/validate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const adminData = await response.json();
        setAdmin(adminData);
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('adminToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (employeeId, password) => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ employee_id: employeeId, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('adminToken', data.token);
        setAdmin(data.admin);
        return { success: true };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error occurred' };
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setAdmin(null);
  };

  const hasPermission = (requiredClearance) => {
    if (!admin) return false;
    
    // Convert string clearance names to numbers for compatibility
    const clearanceLevelMap = {
      'GENERAL_MANAGER': 0,
      'PRODUCT_DIRECTOR': 1,
      'INVENTORY_MANAGER': 2,
      'PRODUCT_MANAGER': 3,
      'ORDER_MANAGER': 4,
      'PROMO_MANAGER': 5,
      'ANALYTICS': 6,
      'INVENTORY_SPECIALIST': 7,
      'DELIVERY_COORDINATOR': 8
    };

    // Get admin's current clearance level as number
    const adminLevel = typeof admin.clearance_level === 'string' 
      ? clearanceLevelMap[admin.clearance_level] 
      : admin.clearance_level;

    // Specific access rules based on your requirements:
    // 1) General manager: all
    // 2) Inventory manager: inventory
    // 3) Product manager: all except admin management
    // 4) Order manager: orders
    // 5) Promotion manager: promotions, analytics
    // 6) Analytics specialist: analytics
    // Everyone: dashboard and settings (but not admin management part of settings)

    const accessRules = {
      0: ['DASHBOARD', 'INVENTORY_MANAGER', 'PRODUCT_MANAGER', 'ORDER_MANAGER', 'PROMO_MANAGER', 'ANALYTICS', 'GENERAL_MANAGER', 'SETTINGS'], // General Manager - all
      2: ['DASHBOARD', 'INVENTORY_MANAGER', 'SETTINGS'], // Inventory Manager - inventory only
      3: ['DASHBOARD', 'INVENTORY_MANAGER', 'PRODUCT_MANAGER', 'ORDER_MANAGER', 'PROMO_MANAGER', 'ANALYTICS', 'SETTINGS'], // Product Manager - all except admin management
      4: ['DASHBOARD', 'ORDER_MANAGER', 'SETTINGS'], // Order Manager - orders only
      5: ['DASHBOARD', 'PROMO_MANAGER', 'ANALYTICS', 'SETTINGS'], // Promotion Manager - promotions, analytics
      6: ['DASHBOARD', 'ANALYTICS', 'SETTINGS'] // Analytics Specialist - analytics only
    };

    const allowedPermissions = accessRules[adminLevel] || ['DASHBOARD', 'SETTINGS'];
    const hasAccess = allowedPermissions.includes(requiredClearance);

    // Debug logging for troubleshooting
    console.log('Permission check:', {
      requiredClearance,
      adminLevel,
      allowedPermissions,
      admin: admin,
      hasAccess
    });

    return hasAccess;
  };

  const value = {
    admin,
    loading,
    login,
    logout,
    hasPermission
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

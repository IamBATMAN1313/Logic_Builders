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
    
    const clearanceLevels = {
      'INVENTORY_MANAGER': 1,
      'PRODUCT_EXPERT': 2,
      'ORDER_MANAGER': 3,
      'PROMO_MANAGER': 4,
      'ANALYTICS': 5,
      'GENERAL_MANAGER': 6
    };

    const adminLevel = clearanceLevels[admin.clearance_level] || 0;
    const requiredLevel = clearanceLevels[requiredClearance] || 0;

    // GENERAL_MANAGER has access to everything
    if (admin.clearance_level === 'GENERAL_MANAGER') return true;
    
    // Otherwise, check specific clearance
    return admin.clearance_level === requiredClearance;
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

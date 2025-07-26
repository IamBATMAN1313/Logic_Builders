import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import NotificationDropdown from './NotificationDropdown';

const AdminLayout = ({ children }) => {
  const { admin, logout, hasPermission } = useAdminAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊', permission: 'DASHBOARD' },
    { path: '/inventory', label: 'Inventory', icon: '📦', permission: 'INVENTORY_MANAGER' },
    { path: '/products', label: 'Products', icon: '🛍️', permission: 'PRODUCT_MANAGER' },
    { path: '/orders', label: 'Orders', icon: '📋', permission: 'ORDER_MANAGER' },
    { path: '/promotions', label: 'Promotions', icon: '🎯', permission: 'PROMO_MANAGER' },
    { path: '/reviews', label: 'Reviews', icon: '⭐', permission: 'PRODUCT_MANAGER' },
    { path: '/analytics', label: 'Analytics', icon: '📈', permission: 'ANALYTICS' },
    { path: '/admin-management', label: 'Admin Management', icon: '👥', permission: 'GENERAL_MANAGER' },
    { path: '/settings', label: 'Settings', icon: '⚙️', permission: 'SETTINGS' }
  ];

  const visibleMenuItems = menuItems.filter(item => {
    // Special case for reviews - multiple permissions can access
    if (item.path === '/reviews') {
      return hasPermission('PRODUCT_MANAGER') || hasPermission('PRODUCT_DIRECTOR') || hasPermission('GENERAL_MANAGER');
    }
    return hasPermission(item.permission);
  });

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div style={{ marginBottom: '2rem' }}>
          <h2>LogicBuilders Admin</h2>
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#34495e', borderRadius: '5px' }}>
            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Welcome, {admin.name}
            </div>
            <div className="clearance-badge">
              {admin.clearance_name || 'Admin'}
            </div>
          </div>
        </div>

        <nav>
          <ul className="nav-menu">
            {visibleMenuItems.map(item => (
              <li key={item.path}>
                <Link 
                  to={item.path}
                  className={location.pathname === item.path ? 'active' : ''}
                >
                  <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <button 
            onClick={logout}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <h1>Admin Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <NotificationDropdown />
            <div style={{ color: 'white' }}>
              Welcome, {admin.name}
            </div>
            <button 
              onClick={logout}
              style={{
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <div style={{ padding: '2rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

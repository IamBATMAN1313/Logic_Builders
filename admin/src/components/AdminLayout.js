import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const AdminLayout = ({ children }) => {
  const { admin, logout, hasPermission } = useAdminAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications on component mount and periodically
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationIds = null) => {
    try {
      const token = localStorage.getItem('adminToken');
      await fetch('/api/admin/notifications/read', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_ids: notificationIds })
      });
      fetchNotifications(); // Refresh notifications
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊', permission: null },
    { path: '/inventory', label: 'Inventory', icon: '📦', permission: 'INVENTORY_MANAGER' },
    { path: '/products', label: 'Products', icon: '🛍️', permission: 'PRODUCT_EXPERT' },
    { path: '/orders', label: 'Orders', icon: '📋', permission: 'ORDER_MANAGER' },
    { path: '/promotions', label: 'Promotions', icon: '🎯', permission: 'PROMO_MANAGER' },
    { path: '/analytics', label: 'Analytics', icon: '📈', permission: 'ANALYTICS' },
    { path: '/admin-management', label: 'Admin Management', icon: '👥', permission: 'GENERAL_MANAGER' }
  ];

  const visibleMenuItems = menuItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

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
              {admin.clearance_level.replace('_', ' ')}
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
            {/* Notifications Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  position: 'relative'
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#e74c3c',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  width: '350px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}>
                  <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h4 style={{ margin: 0, color: '#2c3e50' }}>Notifications</h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAsRead()}
                        style={{
                          background: '#3498db',
                          color: 'white',
                          border: 'none',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '3px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#7f8c8d' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                      No notifications
                    </div>
                  ) : (
                    <div>
                      {notifications.slice(0, 10).map(notification => (
                        <div
                          key={notification.notification_id}
                          style={{
                            padding: '1rem',
                            borderBottom: '1px solid #f8f9fa',
                            background: notification.is_read ? 'white' : '#f8f9fa',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            if (!notification.is_read) {
                              markAsRead([notification.notification_id]);
                            }
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '0.5rem'
                          }}>
                            <strong style={{
                              color: '#2c3e50',
                              fontSize: '0.9rem'
                            }}>
                              {notification.title}
                            </strong>
                            {!notification.is_read && (
                              <div style={{
                                width: '8px',
                                height: '8px',
                                background: '#3498db',
                                borderRadius: '50%'
                              }}></div>
                            )}
                          </div>
                          <div style={{
                            color: '#7f8c8d',
                            fontSize: '0.85rem',
                            marginBottom: '0.5rem'
                          }}>
                            {notification.message}
                          </div>
                          <div style={{
                            color: '#95a5a6',
                            fontSize: '0.75rem'
                          }}>
                            {new Date(notification.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              Employee ID: {admin.employee_id}
            </div>
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

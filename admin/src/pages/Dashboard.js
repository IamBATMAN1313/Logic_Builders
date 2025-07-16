import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Dashboard = () => {
  const { admin, hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalAdmins: 0,
    pendingRequests: 0,
    unreadNotifications: 0,
    outOfStockProducts: 0,
    totalRevenue: 0,
    recentOrders: []
  });
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [orderAnalytics, setOrderAnalytics] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentActivities();
    if (hasPermission('ORDER_MANAGER')) {
      fetchOrderAnalytics();
    }
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(prevStats => ({
          ...prevStats,
          totalProducts: data.totalProducts || 0,
          totalUsers: data.totalUsers || 0,
          totalAdmins: data.totalAdmins || 0,
          pendingRequests: data.pendingRequests || 0,
          unreadNotifications: data.unreadNotifications || 0,
          outOfStockProducts: data.outOfStockProducts || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/orders/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrderAnalytics(data.overview);
        setStats(prevStats => ({
          ...prevStats,
          totalOrders: parseInt(data.overview?.total_orders) || 0,
          totalRevenue: parseFloat(data.overview?.total_revenue) || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching order analytics:', error);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/logs?limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentActivities(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const formatNumber = (num) => {
    return typeof num === 'number' && !isNaN(num) ? num.toLocaleString() : '0';
  };

  const formatCurrency = (num) => {
    return typeof num === 'number' && !isNaN(num) ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
  };

  const renderDashboardCards = () => {
    const cards = [];

    // General Manager sees everything
    if (hasPermission('GENERAL_MANAGER')) {
      cards.push(
        <div key="totalAdmins" className="dashboard-card">
          <h3>Total Admins</h3>
          <p>{stats.totalAdmins}</p>
        </div>,
        <div key="pendingRequests" className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
          <h3>Pending Requests</h3>
          <p>{stats.pendingRequests}</p>
        </div>,
        <div key="totalUsers" className="dashboard-card">
          <h3>Total Users</h3>
          <p>{stats.totalUsers}</p>
        </div>
      );
    }

    // Product Manager sees product-related data
    if (hasPermission('PRODUCT_MANAGER')) {
      cards.push(
        <div key="totalProducts" className="dashboard-card">
          <h3>Total Products</h3>
          <p>{stats.totalProducts}</p>
        </div>
      );
    }

    // Inventory Manager sees stock data
    if (hasPermission('INVENTORY_MANAGER')) {
      cards.push(
        <div key="lowStock" className="dashboard-card" style={{ borderLeftColor: '#e74c3c' }}>
          <h3>Low Stock Items</h3>
          <p>{stats.outOfStockProducts}</p>
        </div>
      );
    }

    // Order Manager sees order data
    if (hasPermission('ORDER_MANAGER')) {
      cards.push(
        <div key="totalOrders" className="dashboard-card">
          <h3>Total Orders</h3>
          <p>{stats.totalOrders}</p>
        </div>,
        <div key="totalRevenue" className="dashboard-card" style={{ borderLeftColor: '#27ae60' }}>
          <h3>Total Revenue</h3>
          <p>{formatCurrency(stats.totalRevenue)}</p>
        </div>
      );

      if (orderAnalytics) {
        cards.push(
          <div key="pendingOrders" className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
            <h3>Pending Orders</h3>
            <p>{orderAnalytics.pending_orders || 0}</p>
          </div>,
          <div key="deliveredOrders" className="dashboard-card" style={{ borderLeftColor: '#27ae60' }}>
            <h3>Delivered Orders</h3>
            <p>{orderAnalytics.delivered_orders || 0}</p>
          </div>
        );
      }
    }

    // Show at least some basic info for all users
    if (cards.length === 0) {
      cards.push(
        <div key="welcome" className="dashboard-card">
          <h3>Welcome</h3>
          <p>Admin Dashboard</p>
        </div>
      );
    }

    return cards;
  };

  const renderQuickActions = () => {
    const actions = [];

    if (hasPermission('ORDER_MANAGER')) {
      actions.push(
        <button 
          key="orders"
          className="btn btn-sm" 
          style={{ background: '#3498db', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/orders')}
        >
          View Orders
        </button>
      );
    }

    if (hasPermission('PRODUCT_MANAGER')) {
      actions.push(
        <button 
          key="products"
          className="btn btn-sm" 
          style={{ background: '#2ecc71', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/products')}
        >
          Manage Products
        </button>
      );
    }

    if (hasPermission('INVENTORY_MANAGER')) {
      actions.push(
        <button 
          key="inventory"
          className="btn btn-sm" 
          style={{ background: '#e67e22', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/inventory')}
        >
          Check Inventory
        </button>
      );
    }

    if (hasPermission('ANALYTICS')) {
      actions.push(
        <button 
          key="analytics"
          className="btn btn-sm" 
          style={{ background: '#9b59b6', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/analytics')}
        >
          View Analytics
        </button>
      );
    }

    if (hasPermission('PROMO_MANAGER')) {
      actions.push(
        <button 
          key="promotions"
          className="btn btn-sm" 
          style={{ background: '#f39c12', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/promotions')}
        >
          Manage Promotions
        </button>
      );
    }

    if (hasPermission('GENERAL_MANAGER')) {
      actions.push(
        <button 
          key="admin-management"
          className="btn btn-sm" 
          style={{ background: '#8e44ad', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/admin-management')}
        >
          Admin Management
        </button>,
        <button 
          key="settings"
          className="btn btn-sm" 
          style={{ background: '#95a5a6', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/settings')}
        >
          Settings
        </button>
      );
    }

    // Settings for all admins
    if (!hasPermission('GENERAL_MANAGER')) {
      actions.push(
        <button 
          key="settings"
          className="btn btn-sm" 
          style={{ background: '#95a5a6', color: 'white', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => navigate('/settings')}
        >
          Settings
        </button>
      );
    }

    return actions;
  };

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2>Welcome back, {admin.name}!</h2>
        <p style={{ color: '#7f8c8d' }}>
          {hasPermission('GENERAL_MANAGER') ? "You have full administrative access to the system." :
           hasPermission('ORDER_MANAGER') ? "Manage orders and view sales analytics." :
           hasPermission('PRODUCT_MANAGER') ? "Manage products and inventory items." :
           hasPermission('INVENTORY_MANAGER') ? "Monitor and manage inventory levels." :
           hasPermission('PROMO_MANAGER') ? "Create and manage promotional campaigns." :
           hasPermission('ANALYTICS') ? "View detailed analytics and reports." :
           "Welcome to your admin dashboard."}
        </p>
      </div>

      <div className="dashboard-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {renderDashboardCards()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Recent Activity</h3>
          <div style={{ color: '#7f8c8d' }}>
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <p key={index} style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  • {activity.admin_name} {activity.action.toLowerCase().replace('_', ' ')} 
                  {activity.target_type && ` ${activity.target_type.toLowerCase()}`}
                  <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: '#bdc3c7' }}>
                    ({new Date(activity.created_at).toLocaleDateString()})
                  </span>
                </p>
              ))
            ) : (
              <>
                <p style={{ fontSize: '0.9rem' }}>• No recent activities</p>
                <p style={{ fontSize: '0.9rem' }}>• System running smoothly</p>
                <p style={{ fontSize: '0.9rem' }}>• All metrics up to date</p>
              </>
            )}
          </div>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {renderQuickActions()}
          </div>
        </div>
      </div>

      {hasPermission('ORDER_MANAGER') && orderAnalytics && (
        <div style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Order Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3498db' }}>
                {orderAnalytics.pending_orders || 0}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>Pending</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f39c12' }}>
                {orderAnalytics.processing_orders || 0}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>Processing</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#27ae60' }}>
                {orderAnalytics.delivered_orders || 0}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>Delivered</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e74c3c' }}>
                {orderAnalytics.cancelled_orders || 0}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>Cancelled</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

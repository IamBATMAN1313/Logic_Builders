import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Dashboard = () => {
  const { admin } = useAdminAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    lowStockProducts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
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
        setStats({
          totalProducts: data.totalProducts || 0,
          totalOrders: data.totalOrders || 0,
          totalUsers: data.totalUsers || 0,
          totalRevenue: data.totalRevenue || 0,
          pendingOrders: data.pendingRequests || 0,
          lowStockProducts: data.outOfStockProducts || 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return typeof num === 'number' && !isNaN(num) ? num.toLocaleString() : '0';
  };

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2>Welcome back, {admin.name}!</h2>
        <p style={{ color: '#7f8c8d' }}>Here's what's happening with your business today.</p>
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>Total Products</h3>
          <p>{stats.totalProducts}</p>
        </div>

        <div className="dashboard-card">
          <h3>Total Orders</h3>
          <p>{stats.totalOrders}</p>
        </div>

        <div className="dashboard-card">
          <h3>Total Users</h3>
          <p>{stats.totalUsers}</p>
        </div>

        <div className="dashboard-card">
          <h3>Total Revenue</h3>
          <p>${formatNumber(stats.totalRevenue)}</p>
        </div>

        <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
          <h3>Pending Orders</h3>
          <p>{stats.pendingOrders}</p>
        </div>

        <div className="dashboard-card" style={{ borderLeftColor: '#e74c3c' }}>
          <h3>Low Stock Items</h3>
          <p>{stats.lowStockProducts}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Recent Activity</h3>
          <div style={{ color: '#7f8c8d' }}>
            <p>• New order #1234 received</p>
            <p>• Product "Gaming Laptop" updated</p>
            <p>• User registration increased by 12%</p>
            <p>• 5 products running low on stock</p>
          </div>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="btn" style={{ background: '#3498db', color: 'white', textAlign: 'left' }}>
              View Pending Orders
            </button>
            <button className="btn" style={{ background: '#2ecc71', color: 'white', textAlign: 'left' }}>
              Add New Product
            </button>
            <button className="btn" style={{ background: '#e67e22', color: 'white', textAlign: 'left' }}>
              Check Low Stock
            </button>
            <button className="btn" style={{ background: '#9b59b6', color: 'white', textAlign: 'left' }}>
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

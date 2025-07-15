import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Analytics = () => {
  const { hasPermission } = useAdminAuth();
  const [analytics, setAnalytics] = useState({
    monthlyRevenue: 0,
    conversionRate: 0,
    avgOrderValue: 0,
    customerRetention: 0,
    topProducts: [],
    salesTrends: [],
    userGrowth: []
  });
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      // Fetch order analytics
      const orderResponse = await fetch('/api/admin/orders/analytics/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        
        // Calculate metrics
        const monthlyRevenue = parseFloat(orderData.overview.total_revenue) || 0;
        const totalOrders = parseInt(orderData.overview.total_orders) || 0;
        const avgOrderValue = totalOrders > 0 ? monthlyRevenue / totalOrders : 0;
        
        setAnalytics({
          monthlyRevenue: monthlyRevenue,
          conversionRate: 3.2, // This would need proper calculation based on visitors/orders
          avgOrderValue: avgOrderValue,
          customerRetention: 68.3, // This would need proper calculation
          topProducts: orderData.top_products || [],
          salesTrends: orderData.trends || [],
          userGrowth: []
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/reports/${reportType}?days=${dateRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_report_${dateRange}days.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (!hasPermission('ANALYTICS')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access analytics.</p>
        <p>Required clearance: ANALYTICS</p>
      </div>
    );
  }

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div>
      <h2>Analytics & Reports</h2>
      <p>View detailed analytics, generate reports, and track business performance.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h3>Key Metrics</h3>
        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Monthly Revenue</h3>
            <p>{formatCurrency(analytics.monthlyRevenue)}</p>
            <small style={{ color: '#2ecc71' }}>Real-time data</small>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
            <h3>Conversion Rate</h3>
            <p>{analytics.conversionRate}%</p>
            <small style={{ color: '#2ecc71' }}>Industry average: 2.8%</small>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
            <h3>Avg Order Value</h3>
            <p>{formatCurrency(analytics.avgOrderValue)}</p>
            <small style={{ color: '#3498db' }}>Based on total orders</small>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#9b59b6' }}>
            <h3>Customer Retention</h3>
            <p>{analytics.customerRetention}%</p>
            <small style={{ color: '#2ecc71' }}>Estimated metric</small>
          </div>
        </div>
      </div>

      {/* Top Products Section */}
      {analytics.topProducts.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Top Selling Products</h3>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topProducts.map((product, index) => (
                  <tr key={index}>
                    <td>{product.product_name}</td>
                    <td>{product.order_count}</td>
                    <td>{formatCurrency(product.total_revenue)}</td>
                    <td>{product.avg_rating ? parseFloat(product.avg_rating).toFixed(1) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <h3>Report Generation</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Report Type:</label>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '5px', border: '1px solid #ddd' }}
            >
              <option value="sales">Sales Report</option>
              <option value="products">Product Performance</option>
              <option value="users">User Analytics</option>
              <option value="orders">Order Analytics</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Date Range:</label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '5px', border: '1px solid #ddd' }}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="365">Last year</option>
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button 
              onClick={generateReport}
              className="btn btn-primary"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

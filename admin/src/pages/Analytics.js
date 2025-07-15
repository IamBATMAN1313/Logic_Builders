import React from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Analytics = () => {
  const { hasPermission } = useAdminAuth();

  if (!hasPermission('ANALYTICS')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access analytics.</p>
        <p>Required clearance: ANALYTICS</p>
      </div>
    );
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
            <p>$234,567</p>
            <small style={{ color: '#2ecc71' }}>↑ 12.5% from last month</small>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
            <h3>Conversion Rate</h3>
            <p>3.2%</p>
            <small style={{ color: '#2ecc71' }}>↑ 0.3% from last month</small>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
            <h3>Avg Order Value</h3>
            <p>$127.45</p>
            <small style={{ color: '#e74c3c' }}>↓ 2.1% from last month</small>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#9b59b6' }}>
            <h3>Customer Retention</h3>
            <p>68.3%</p>
            <small style={{ color: '#2ecc71' }}>↑ 5.2% from last month</small>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Report Generation</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn btn-primary">Sales Report</button>
          <button className="btn" style={{ background: '#2ecc71', color: 'white' }}>Customer Analytics</button>
          <button className="btn" style={{ background: '#e67e22', color: 'white' }}>Product Performance</button>
          <button className="btn" style={{ background: '#9b59b6', color: 'white' }}>Financial Summary</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>Top Selling Products</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Sales</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gaming Laptop RTX 4070</td>
                <td>234</td>
                <td>$304,266</td>
              </tr>
              <tr>
                <td>Wireless Gaming Mouse</td>
                <td>567</td>
                <td>$45,333</td>
              </tr>
              <tr>
                <td>Mechanical Keyboard</td>
                <td>345</td>
                <td>$51,705</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>Traffic Sources</h3>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Direct Traffic</span>
              <span>45.2%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#ecf0f1', borderRadius: '4px', marginBottom: '1rem' }}>
              <div style={{ width: '45.2%', height: '100%', backgroundColor: '#3498db', borderRadius: '4px' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Google Search</span>
              <span>32.1%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#ecf0f1', borderRadius: '4px', marginBottom: '1rem' }}>
              <div style={{ width: '32.1%', height: '100%', backgroundColor: '#2ecc71', borderRadius: '4px' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Social Media</span>
              <span>15.8%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#ecf0f1', borderRadius: '4px', marginBottom: '1rem' }}>
              <div style={{ width: '15.8%', height: '100%', backgroundColor: '#e67e22', borderRadius: '4px' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Referrals</span>
              <span>6.9%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#ecf0f1', borderRadius: '4px' }}>
              <div style={{ width: '6.9%', height: '100%', backgroundColor: '#9b59b6', borderRadius: '4px' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

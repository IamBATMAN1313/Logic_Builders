import React from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Promotions = () => {
  const { hasPermission } = useAdminAuth();

  if (!hasPermission('PROMO_MANAGER')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access promotion management.</p>
        <p>Required clearance: PROMO_MANAGER</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Promotion Management</h2>
      <p>Create and manage discounts, deals, coupons, and marketing campaigns.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h3>Promotion Overview</h3>
        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Active Promotions</h3>
            <p>12</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
            <h3>Total Coupons Used</h3>
            <p>847</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
            <h3>Discount Given</h3>
            <p>$12,450</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#9b59b6' }}>
            <h3>Campaign ROI</h3>
            <p>245%</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Promotion Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn btn-primary">Create New Promotion</button>
          <button className="btn" style={{ background: '#2ecc71', color: 'white' }}>Generate Coupon Codes</button>
          <button className="btn" style={{ background: '#e67e22', color: 'white' }}>Schedule Campaign</button>
          <button className="btn" style={{ background: '#9b59b6', color: 'white' }}>Analytics Report</button>
        </div>
      </div>

      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h3>Active Promotions</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Promotion Name</th>
              <th>Type</th>
              <th>Discount</th>
              <th>Usage</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Winter Sale 2024</td>
              <td>Percentage</td>
              <td>25%</td>
              <td>234/500</td>
              <td>2024-02-29</td>
              <td><span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Active</span></td>
              <td>
                <button style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', border: 'none', background: '#3498db', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>Edit</button>
                <button style={{ padding: '0.25rem 0.5rem', border: 'none', background: '#e74c3c', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>End</button>
              </td>
            </tr>
            <tr>
              <td>NEWUSER20</td>
              <td>Fixed Amount</td>
              <td>$20</td>
              <td>67/∞</td>
              <td>2024-12-31</td>
              <td><span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Active</span></td>
              <td>
                <button style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', border: 'none', background: '#3498db', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>Edit</button>
                <button style={{ padding: '0.25rem 0.5rem', border: 'none', background: '#e74c3c', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>End</button>
              </td>
            </tr>
            <tr>
              <td>FREESHIPPING</td>
              <td>Free Shipping</td>
              <td>100%</td>
              <td>156/∞</td>
              <td>2024-03-15</td>
              <td><span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Active</span></td>
              <td>
                <button style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', border: 'none', background: '#3498db', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>Edit</button>
                <button style={{ padding: '0.25rem 0.5rem', border: 'none', background: '#e74c3c', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>End</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Promotions;

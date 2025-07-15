import React from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Orders = () => {
  const { hasPermission } = useAdminAuth();

  if (!hasPermission('ORDER_MANAGER')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access order management.</p>
        <p>Required clearance: ORDER_MANAGER</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Order Management</h2>
      <p>Process orders, handle shipping, manage returns and customer support.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h3>Order Overview</h3>
        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Total Orders</h3>
            <p>2,847</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
            <h3>Pending Orders</h3>
            <p>23</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#3498db' }}>
            <h3>Processing</h3>
            <p>67</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
            <h3>Completed</h3>
            <p>2,745</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Order Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn btn-primary">Process Pending Orders</button>
          <button className="btn" style={{ background: '#2ecc71', color: 'white' }}>Bulk Update Status</button>
          <button className="btn" style={{ background: '#e67e22', color: 'white' }}>Generate Shipping Labels</button>
          <button className="btn" style={{ background: '#9b59b6', color: 'white' }}>Export Orders</button>
        </div>
      </div>

      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h3>Recent Orders</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>#ORD-001234</td>
              <td>John Smith</td>
              <td>$1,299.99</td>
              <td><span style={{ color: '#f39c12', fontWeight: 'bold' }}>Pending</span></td>
              <td>2024-01-15</td>
              <td>
                <button style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', border: 'none', background: '#3498db', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>View</button>
                <button style={{ padding: '0.25rem 0.5rem', border: 'none', background: '#2ecc71', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>Process</button>
              </td>
            </tr>
            <tr>
              <td>#ORD-001235</td>
              <td>Sarah Johnson</td>
              <td>$79.99</td>
              <td><span style={{ color: '#3498db', fontWeight: 'bold' }}>Processing</span></td>
              <td>2024-01-14</td>
              <td>
                <button style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', border: 'none', background: '#3498db', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>View</button>
                <button style={{ padding: '0.25rem 0.5rem', border: 'none', background: '#e67e22', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>Ship</button>
              </td>
            </tr>
            <tr>
              <td>#ORD-001236</td>
              <td>Mike Davis</td>
              <td>$229.98</td>
              <td><span style={{ color: '#2ecc71', fontWeight: 'bold' }}>Completed</span></td>
              <td>2024-01-13</td>
              <td>
                <button style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', border: 'none', background: '#3498db', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>View</button>
                <button style={{ padding: '0.25rem 0.5rem', border: 'none', background: '#95a5a6', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>Invoice</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Orders;

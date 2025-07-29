import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImage from '../ReUse/ProductImage';
import api from '../../api';
import '../css/Orders.css';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (err) {
      setError('Failed to fetch orders');
      console.error('Orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'processing': return '#007bff';
      case 'shipped': return '#17a2b8';
      case 'delivered': return '#28a745';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>Your Orders</h2>
        <p>Track and manage your order history</p>
      </div>

      {orders.length === 0 ? (
        <div className="no-orders">
          <div className="no-orders-content">
            <span className="no-orders-icon">📦</span>
            <h3>No orders yet</h3>
            <p>When you place orders, they'll appear here.</p>
            <button 
              className="browse-products-btn"
              onClick={() => navigate('/categories')}
            >
              Browse Products
            </button>
          </div>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div className="order-info">
                  <h3>Order #{order.id}</h3>
                  <p className="order-date">
                    Placed on {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="order-status">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className="order-items">
                {order.items?.map((item, index) => (
                  <div key={index} className="order-item">
                    <ProductImage 
                      src={item.image_url}
                      alt={item.name}
                      size="thumbnail"
                      className="order-item-image"
                    />
                    <div className="item-details">
                      <h4>{item.name}</h4>
                      <p>Quantity: {item.quantity}</p>
                      <p className="item-price">${item.price}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-footer">
                <div className="order-total">
                  <strong>Total: ${order.total}</strong>
                </div>
                <div className="order-actions">
                  <button className="view-details-btn">View Details</button>
                  {order.status === 'delivered' && (
                    <button className="reorder-btn">Reorder</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

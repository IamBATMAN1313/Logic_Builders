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
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [userRatings, setUserRatings] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

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

  const getExpectedDeliveryDate = (status, orderDate) => {
    const date = new Date(orderDate);
    let daysToAdd = 7; // Default delivery time
    
    switch (status) {
      case 'pending':
        daysToAdd = 7;
        break;
      case 'processing':
        daysToAdd = 5;
        break;
      case 'shipped':
        daysToAdd = 3;
        break;
      default:
        daysToAdd = 7;
    }
    
    date.setDate(date.getDate() + daysToAdd);
    return date.toLocaleDateString();
  };

  const canCancelOrder = (status) => {
    return ['pending', 'processing'].includes(status);
  };

  const canRequestReturn = (status, orderDate) => {
    if (status !== 'delivered') return false;
    const deliveryDate = new Date(orderDate);
    const now = new Date();
    const daysDiff = (now - deliveryDate) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30; // 30 days return policy
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    
    setActionLoading(true);
    try {
      await api.put(`/orders/${orderId}/cancel`);
      fetchOrders(); // Refresh orders list
      setShowOrderModal(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error('Cancel order error:', err);
      alert('Failed to cancel order. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to request a return for this order?')) return;
    
    setActionLoading(true);
    try {
      await api.put(`/orders/${orderId}/return`);
      fetchOrders(); // Refresh orders list
      setShowOrderModal(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error('Return order error:', err);
      alert('Failed to request return. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRateProduct = async (productId) => {
    const rating = prompt('Rate this product (1-10):');
    if (!rating || isNaN(rating) || rating < 1 || rating > 10) {
      alert('Please enter a valid rating between 1-10');
      return;
    }
    
    try {
      await api.post('/ratings', {
        product_id: productId,
        rating: parseInt(rating)
      });
      
      setUserRatings(prev => ({
        ...prev,
        [productId]: { rating: parseInt(rating) }
      }));
    } catch (err) {
      console.error('Rate product error:', err);
      alert('Failed to rate product. Please try again.');
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

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Order Details - #{selectedOrder.id}</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowOrderModal(false);
                  setSelectedOrder(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="order-summary">
                <div className="order-info-grid">
                  <div className="info-item">
                    <strong>Order Date:</strong>
                    <span>{new Date(selectedOrder.order_date || selectedOrder.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="info-item">
                    <strong>Status:</strong>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(selectedOrder.status) }}
                    >
                      {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1).replace('_', ' ')}
                    </span>
                  </div>
                  {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'returned' && (
                    <div className="info-item">
                      <strong>Expected Delivery:</strong>
                      <span>{getExpectedDeliveryDate(selectedOrder.status, selectedOrder.order_date || selectedOrder.created_at)}</span>
                    </div>
                  )}
                  <div className="info-item">
                    <strong>Payment Status:</strong>
                    <span className={`payment-status ${selectedOrder.payment_status ? 'paid' : 'unpaid'}`}>
                      {selectedOrder.payment_status ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  {(selectedOrder.address || selectedOrder.city || selectedOrder.zip_code || selectedOrder.country) && (
                    <div className="info-item full-width">
                      <strong>Delivery Address:</strong>
                      <span>
                        {[
                          selectedOrder.address,
                          selectedOrder.city,
                          selectedOrder.zip_code,
                          selectedOrder.country
                        ].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {selectedOrder.promo_code && (
                    <div className="info-item">
                      <strong>Voucher Applied:</strong>
                      <span className="voucher-info">
                        {selectedOrder.promo_code}
                        {selectedOrder.discount_amount && parseFloat(selectedOrder.discount_amount) > 0 && (
                          <span className="voucher-discount"> (-${parseFloat(selectedOrder.discount_amount).toFixed(2)})</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="order-items-detail">
                <h4>Order Items</h4>
                {selectedOrder.items?.map((item, index) => (
                  <div key={index} className="order-item-detail">
                    <ProductImage 
                      src={item.product_image || item.build_image}
                      alt={item.product_name || item.build_name}
                      size="thumbnail"
                      className="order-item-image"
                    />
                    <div className="item-details">
                      <h5>{item.product_name || item.name}</h5>
                      <div className="item-info-grid">
                        <div className="item-info">
                          <strong>Product Name:</strong> {item.product_name || item.name}
                        </div>
                        <div className="item-info">
                          <strong>Quantity:</strong> {item.quantity}
                        </div>
                        <div className="item-info">
                          <strong>Unit Price:</strong> ${parseFloat(item.unit_price || item.price || 0).toFixed(2)}
                        </div>
                        <div className="item-info">
                          <strong>Subtotal:</strong> ${(parseFloat(item.unit_price || item.price || 0) * parseInt(item.quantity || 0)).toFixed(2)}
                        </div>
                        {item.specs && (
                          <div className="item-info full-width">
                            <strong>Specifications:</strong>
                            <div className="specs-list">
                              {Object.entries(item.specs).map(([key, value]) => (
                                <span key={key} className="spec-item">
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {selectedOrder.status === 'delivered' && (
                        <div className="item-actions">
                          {userRatings[item.product_id] ? (
                            <span className="rated-badge">
                              Rated {userRatings[item.product_id].rating}/10
                            </span>
                          ) : (
                            <button 
                              className="rate-product-btn"
                              onClick={() => handleRateProduct(item.product_id)}
                            >
                              Rate Product
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-total-detail">
                <div className="total-breakdown">
                  <div className="total-line">
                    <span>Subtotal:</span>
                    <span>${((parseFloat(selectedOrder.total_price || 0) - parseFloat(selectedOrder.delivery_charge || 0) + parseFloat(selectedOrder.discount_amount || 0))).toFixed(2)}</span>
                  </div>
                  {selectedOrder.discount_amount && parseFloat(selectedOrder.discount_amount) > 0 && (
                    <div className="total-line voucher-line">
                      <span>Voucher Discount ({selectedOrder.promo_code}):</span>
                      <span className="discount-amount">-${parseFloat(selectedOrder.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_charge && parseFloat(selectedOrder.delivery_charge) > 0 && (
                    <div className="total-line">
                      <span>Delivery Charge:</span>
                      <span>${parseFloat(selectedOrder.delivery_charge).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="total-line final-total">
                    <span><strong>Order Total:</strong></span>
                    <span><strong>${parseFloat(selectedOrder.total_price || 0).toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>

              {selectedOrder.admin_notes && (
                <div className="admin-notes">
                  <h4>Notes:</h4>
                  <p>{selectedOrder.admin_notes}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <div className="modal-actions">
                {canCancelOrder(selectedOrder.status) && (
                  <button 
                    className="btn cancel-btn"
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
                {canRequestReturn(selectedOrder.status, selectedOrder.created_at) && (
                  <button 
                    className="btn return-btn"
                    onClick={() => handleReturnOrder(selectedOrder.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Return Order'}
                  </button>
                )}
                <button 
                  className="btn close-btn"
                  onClick={() => {
                    setShowOrderModal(false);
                    setSelectedOrder(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

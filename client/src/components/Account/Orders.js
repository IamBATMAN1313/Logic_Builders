import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImage from '../ReUse/ProductImage';
import { useNotification } from '../../contexts/NotificationContext';
import api from '../../api';
import '../css/Orders.css';

export default function Orders() {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRatings, setUserRatings] = useState({});

  useEffect(() => {
    fetchOrders();
    fetchUserRatings();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (err) {
      showError('Failed to fetch orders');
      console.error('Orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRatings = async () => {
    try {
      const response = await api.get('/ratings/my-ratings');
      const ratingsMap = {};
      response.data.forEach(rating => {
        const key = `${rating.product_id}`;
        ratingsMap[key] = rating;
      });
      setUserRatings(ratingsMap);
    } catch (err) {
      console.error('Failed to fetch user ratings:', err);
    }
  };

  const handleRateProduct = (productId) => {
    navigate('/account/reviews', { state: { focusProduct: productId } });
  };

  const getExpectedDeliveryDate = (status, orderDate) => {
    const order = new Date(orderDate);
    let daysToAdd = 2; // Default 2 days for most statuses
    
    if (status === 'shipped') {
      daysToAdd = 1; // Next day for shipped orders
    }
    
    const deliveryDate = new Date(order);
    deliveryDate.setDate(order.getDate() + daysToAdd);
    
    return deliveryDate.toLocaleDateString();
  };

  const canCancelOrder = (status) => {
    return ['pending', 'processing'].includes(status);
  };

  const canReturnOrder = (status, orderDate) => {
    if (status !== 'delivered') return false;
    
    const delivered = new Date(orderDate);
    const now = new Date();
    const daysDiff = Math.floor((now - delivered) / (1000 * 60 * 60 * 24));
    
    return daysDiff <= 3; // Can return within 3 days of delivery
  };

  const canRequestReturn = (status, orderDate) => {
    // Cannot request return if status is return_declined, awaiting_return, or returned
    if (['return_declined', 'awaiting_return', 'returned'].includes(status)) {
      return false;
    }
    
    return canReturnOrder(status, orderDate);
  };

  const handleViewDetails = async (orderId) => {
    try {
      setLoading(true);
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data);
      setShowOrderModal(true);
    } catch (err) {
      showError('Failed to fetch order details');
      console.error('Order details fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to cancel this order? This action cannot be undone.',
      () => {}, // onConfirm callback
      () => {}  // onCancel callback
    );
    
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.put(`/orders/${orderId}/status`, { 
        status: 'cancelled' 
      });
      fetchOrders(); // Refresh orders list
      setShowOrderModal(false);
      showSuccess('Order cancelled successfully!');
    } catch (err) {
      showError('Failed to cancel order');
      console.error('Cancel order error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnOrder = async (orderId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to return this order? You can return this order within 3 days of delivery.',
      () => {}, // onConfirm callback
      () => {}  // onCancel callback
    );
    
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.put(`/orders/${orderId}/status`, { 
        status: 'awaiting_return' 
      });
      fetchOrders(); // Refresh orders list
      setShowOrderModal(false);
      showSuccess('Return request submitted successfully!');
    } catch (err) {
      showError('Failed to request return. Please contact customer support.');
      console.error('Return order error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'processing': return '#007bff';
      case 'shipped': return '#17a2b8';
      case 'delivered': return '#28a745';
      case 'cancelled': return '#dc3545';
      case 'awaiting_return': return '#fd7e14';
      case 'returned': return '#6c757d';
      case 'return_declined': return '#dc3545';
      default: return '#6c757d';
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;

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
                    Placed on {new Date(order.order_date || order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="order-status">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
                  </span>
                  {order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'returned' && (
                    <p className="expected-delivery">
                      Expected: {getExpectedDeliveryDate(order.status, order.order_date || order.created_at)}
                    </p>
                  )}
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
                      <p className="item-price">${parseFloat(item.unit_price || item.price || 0).toFixed(2)}</p>
                      {order.status === 'delivered' && (
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

              <div className="order-footer">
                <div className="order-total">
                  <strong>Total: ${parseFloat(order.total_price || 0).toFixed(2)}</strong>
                </div>
                <div className="order-actions">
                  <button 
                    className="view-details-btn"
                    onClick={() => handleViewDetails(order.id)}
                  >
                    View Details
                  </button>
                  {canCancelOrder(order.status) && (
                    <button 
                      className="cancel-btn"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={actionLoading}
                    >
                      Cancel Order
                    </button>
                  )}
                  {canRequestReturn(order.status, order.created_at) && (
                    <button 
                      className="return-btn"
                      onClick={() => handleReturnOrder(order.id)}
                      disabled={actionLoading}
                    >
                      Return Order
                    </button>
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
                      src={item.product_image || item.image_url}
                      alt={item.product_name || item.name}
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

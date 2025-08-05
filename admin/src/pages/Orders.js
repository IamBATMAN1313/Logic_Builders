import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNotification } from '../contexts/NotificationContext';
import DualRangeSlider from '../components/DualRangeSlider';
import './AdminPages.css';

const Orders = () => {
  const { hasPermission } = useAdminAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({
    overview: {},
    trends: [],
    top_products: []
  });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  
  // Separate applied filters from form filters
  const [appliedFilters, setAppliedFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    payment_status: '',
    date_from: '',
    date_to: '',
    min_total: '',
    max_total: ''
  });
  
  const [formFilters, setFormFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    payment_status: '',
    date_from: '',
    date_to: '',
    min_total: '',
    max_total: ''
  });
  
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [bulkAction, setBulkAction] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesForm, setNotesForm] = useState('');

  // Price range state for order total filtering
  const [priceRange, setPriceRange] = useState({
    min: 0,
    max: 5000,
    currentMin: 0,
    currentMax: 5000
  });

  useEffect(() => {
    fetchOrders();
    fetchAnalytics();
    fetchPriceRange();
  }, [appliedFilters]);

  const fetchPriceRange = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/orders/price-range', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const minTotal = data.min_total || 0;
        const maxTotal = data.max_total || 5000;
        
        setPriceRange({
          min: minTotal,
          max: maxTotal,
          currentMin: appliedFilters.min_total || formFilters.min_total || minTotal,
          currentMax: appliedFilters.max_total || formFilters.max_total || maxTotal
        });
      }
    } catch (error) {
      console.error('Error fetching price range:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const queryParams = new URLSearchParams(appliedFilters);
      
      const response = await fetch(`/api/admin/orders?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/orders/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleApplyFilters = () => {
    const newFilters = {
      ...formFilters,
      page: 1, // Reset to first page when applying filters
      min_total: priceRange.currentMin > priceRange.min ? priceRange.currentMin : '',
      max_total: priceRange.currentMax < priceRange.max ? priceRange.currentMax : ''
    };
    
    // Update formFilters to include the price range values so they don't reset
    setFormFilters(prev => ({
      ...prev,
      min_total: newFilters.min_total,
      max_total: newFilters.max_total
    }));
    
    setAppliedFilters(newFilters);
  };

  const handleResetFilters = () => {
    const resetFilters = {
      page: 1,
      limit: 20,
      status: '',
      payment_status: '',
      date_from: '',
      date_to: '',
      min_total: '',
      max_total: ''
    };
    setFormFilters(resetFilters);
    setPriceRange(prev => ({
      ...prev,
      currentMin: prev.min,
      currentMax: prev.max
    }));
    setAppliedFilters(resetFilters);
  };

  const fetchOrderDetails = async (orderId) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrderDetails(data);
        setSelectedOrder(data);
        setNotesForm(data.admin_notes || '');
        setShowOrderModal(true);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  const updateOrderStatus = async (orderId, status, paymentStatus = undefined) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          payment_status: paymentStatus
        })
      });

      if (response.ok) {
        const result = await response.json();
        fetchOrders();
        fetchAnalytics();
        if (result.stock_updated) {
          showSuccess(`Order ${orderId} approved!`);
        } else {
          showSuccess('Order updated successfully!');
        }
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      showError('Error updating order');
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedOrders.length === 0) {
      showInfo('Please select orders and an action');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      let endpoint, body;

      if (bulkAction.includes('status:')) {
        const status = bulkAction.split(':')[1];
        endpoint = '/api/admin/orders/bulk/status';
        body = {
          order_ids: selectedOrders,
          status: status
        };
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        showSuccess(result.message);
        fetchOrders();
        fetchAnalytics();
        setSelectedOrders([]);
        setBulkAction('');
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error in bulk action:', error);
      showError('Error performing bulk action');
    }
  };

  const updateOrderNotes = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/orders/${selectedOrder.id}/notes`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_notes: notesForm
        })
      });

      if (response.ok) {
        showSuccess('Notes updated successfully!');
        setShowNotesModal(false);
        fetchOrderDetails(selectedOrder.id);
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating notes:', error);
      showError('Error updating notes');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.floor(amount || 0));
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: '#f39c12',
      processing: '#3498db',
      shipped: '#17a2b8',
      delivered: '#28a745',
      cancelled: '#e74c3c',
      awaiting_return: '#fd7e14',
      returned: '#6c757d',
      return_declined: '#dc3545'
    };
    
    return (
      <span style={{
        background: colors[status] || '#6c757d',
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
      }}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(order => order.id));
    }
  };

  const handlePageChange = (newPage) => {
    setAppliedFilters({...appliedFilters, page: newPage});
  };

  const renderPriceSlider = () => {
    return (
      <div className="price-slider-container">
        <label className="filter-label">Order Total Range</label>
        <DualRangeSlider
          min={priceRange.min}
          max={priceRange.max}
          value={[priceRange.currentMin, priceRange.currentMax]}
          onChange={([min, max]) => setPriceRange({...priceRange, currentMin: min, currentMax: max})}
          step={1}
        />
      </div>
    );
  };

  const renderPagination = () => {
    const { page, pages } = pagination;
    const pageNumbers = [];
    
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(pages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="pagination">
        <button 
          className="pagination-button"
          onClick={() => handlePageChange(1)}
          disabled={page === 1}
        >
          First
        </button>
        <button 
          className="pagination-button"
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
        >
          Previous
        </button>
        
        {pageNumbers.map(pageNum => (
          <button
            key={pageNum}
            className={`pagination-button ${page === pageNum ? 'active' : ''}`}
            onClick={() => handlePageChange(pageNum)}
          >
            {pageNum}
          </button>
        ))}
        
        <button 
          className="pagination-button"
          onClick={() => handlePageChange(page + 1)}
          disabled={page === pages}
        >
          Next
        </button>
        <button 
          className="pagination-button"
          onClick={() => handlePageChange(pages)}
          disabled={page === pages}
        >
          Last
        </button>
        
        <div className="pagination-info">
          Page {page} of {pages} ({pagination.total} total orders)
        </div>
      </div>
    );
  };

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
    <div className="admin-page">
      <div className="page-header">
        <h1>Order Management</h1>
        <div className="page-actions">
          <button 
            className="btn btn-sm btn-secondary"
            onClick={fetchAnalytics}
          >
            Refresh Analytics
          </button>
        </div>
      </div>
      {/* Analytics Dashboard */}
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>Total Orders</h3>
          <p>{analytics.overview.total_orders || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
          <h3>Pending Orders</h3>
          <p>{analytics.overview.pending_orders || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#3498db' }}>
          <h3>Processing</h3>
          <p>{analytics.overview.processing_orders || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#28a745' }}>
          <h3>Delivered</h3>
          <p>{analytics.overview.delivered_orders || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#fd7e14' }}>
          <h3>Awaiting Return</h3>
          <p>{analytics.overview.awaiting_return_orders || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#6c757d' }}>
          <h3>Returned Orders</h3>
          <p>{analytics.overview.returned_orders || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#dc3545' }}>
          <h3>Returns Declined</h3>
          <p>{analytics.overview.return_declined_orders || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
          <h3>Total Revenue</h3>
          <p>{formatCurrency(analytics.overview.total_revenue)}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#e74c3c' }}>
          <h3>Returns Impact</h3>
          <p>{formatCurrency(analytics.overview.returned_revenue || 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters-panel">
        <div className="filters">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select
                value={formFilters.status}
                onChange={(e) => setFormFilters({...formFilters, status: e.target.value})}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="awaiting_return">Awaiting Return</option>
                <option value="returned">Returned</option>
                <option value="return_declined">Return Declined</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label className="filter-label">Payment Status</label>
              <select
                value={formFilters.payment_status}
                onChange={(e) => setFormFilters({...formFilters, payment_status: e.target.value})}
              >
                <option value="">All</option>
                <option value="true">Paid</option>
                <option value="false">Unpaid</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">From Date</label>
              <input
                type="date"
                value={formFilters.date_from}
                onChange={(e) => setFormFilters({...formFilters, date_from: e.target.value})}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">To Date</label>
              <input
                type="date"
                value={formFilters.date_to}
                onChange={(e) => setFormFilters({...formFilters, date_to: e.target.value})}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Items per page</label>
              <select
                value={formFilters.limit}
                onChange={(e) => setFormFilters({...formFilters, limit: parseInt(e.target.value)})}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          
          <div className="filter-row">
            {renderPriceSlider()}
          </div>
        </div>

        <div className="filter-actions">
          <button 
            className="btn btn-primary apply-filters-btn"
            onClick={handleApplyFilters}
          >
            Apply Filters
          </button>
          <button 
            className="btn btn-secondary reset-filters-btn"
            onClick={handleResetFilters}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <div className="bulk-actions">
          <span>{selectedOrders.length} orders selected</span>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
          >
            <option value="">Select Action</option>
            <option value="status:processing">Approve Orders</option>
            <option value="status:shipped">Mark as Shipped</option>
            <option value="status:delivered">Mark as Delivered</option>
            <option value="status:cancelled">Cancel Orders</option>
            <option value="status:returned">Approve Returns</option>
            <option value="status:delivered">Decline Returns</option>
          </select>
          <button 
            className="btn btn-sm btn-primary"
            onClick={handleBulkAction}
            disabled={!bulkAction}
          >
            Apply Action
          </button>
          <button 
            className="btn btn-sm btn-secondary"
            onClick={() => setSelectedOrders([])}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === orders.length && orders.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                    />
                  </td>
                  <td>#{order.id}</td>
                  <td>
                    <div>
                      <div className="customer-name">{order.customer_name}</div>
                      <div className="customer-email">{order.customer_email}</div>
                    </div>
                  </td>
                  <td>{order.item_count} items</td>
                  <td>{formatCurrency(order.total_price)}</td>
                  <td>{getStatusBadge(order.status)}</td>
                  <td>
                    <span className={`payment-status ${order.payment_status ? 'paid' : 'unpaid'}`}>
                      {order.payment_status ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td>{new Date(order.order_date).toLocaleDateString()}</td>
                  <td className="actions">
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => fetchOrderDetails(order.id)}
                    >
                      View
                    </button>
                    {order.status === 'pending' && (
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => updateOrderStatus(order.id, 'processing')}
                      >
                        Approve
                      </button>
                    )}
                    {order.status === 'processing' && (
                      <button 
                        className="btn btn-sm"
                        style={{ background: '#17a2b8', color: 'white' }}
                        onClick={() => updateOrderStatus(order.id, 'shipped')}
                      >
                        Ship
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => updateOrderStatus(order.id, 'delivered')}
                      >
                        Deliver
                      </button>
                    )}
                    {order.status === 'awaiting_return' && (
                      <>
                        <button 
                          className="btn btn-sm"
                          style={{ background: '#28a745', color: 'white' }}
                          onClick={() => updateOrderStatus(order.id, 'returned')}
                        >
                          Approve Return
                        </button>
                        <button 
                          className="btn btn-sm"
                          style={{ background: '#e74c3c', color: 'white', marginLeft: '0.25rem' }}
                          onClick={() => updateOrderStatus(order.id, 'return_declined')}
                        >
                          Decline Return
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && renderPagination()}

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>Order Details - #{selectedOrder.id}</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowOrderModal(false);
                  setSelectedOrder(null);
                  setOrderDetails(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="order-details-grid">
                <div className="order-section">
                  <h4>Order Information</h4>
                  <div className="detail-row">
                    <span>Order Date:</span>
                    <span>{new Date(selectedOrder.order_date).toLocaleString()}</span>
                  </div>
                  <div className="detail-row">
                    <span>Status:</span>
                    <span>{getStatusBadge(selectedOrder.status)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Payment Status:</span>
                    <span className={`payment-status ${selectedOrder.payment_status ? 'paid' : 'unpaid'}`}>
                      {selectedOrder.payment_status ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Payment Method:</span>
                    <span>{selectedOrder.payment_method}</span>
                  </div>
                  <div className="detail-row">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedOrder.total_price)}</span>
                  </div>
                </div>

                <div className="order-section">
                  <h4>Customer Information</h4>
                  <div className="detail-row">
                    <span>Name:</span>
                    <span>{selectedOrder.customer_name}</span>
                  </div>
                  <div className="detail-row">
                    <span>Email:</span>
                    <span>{selectedOrder.customer_email}</span>
                  </div>
                  <div className="detail-row">
                    <span>Phone:</span>
                    <span>{selectedOrder.customer_phone || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Shipping Address:</span>
                    <span>{selectedOrder.shipping_address}</span>
                  </div>
                </div>
              </div>

              {orderDetails && orderDetails.items && (
                <div className="order-section">
                  <h4>Order Items</h4>
                  <table className="order-items-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderDetails.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.product_name || `Build #${item.build_id}`}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td>{formatCurrency(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="order-section">
                <div className="section-header">
                  <h4>Admin Notes</h4>
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowNotesModal(true)}
                  >
                    Edit Notes
                  </button>
                </div>
                <div className="admin-notes">
                  {selectedOrder.admin_notes || 'No notes added yet.'}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="order-actions">
                {selectedOrder.status === 'pending' && (
                  <>
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => updateOrderStatus(selectedOrder.id, 'processing')}
                    >
                      Approve Order
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                    >
                      Cancel Order
                    </button>
                  </>
                )}
                {selectedOrder.status === 'processing' && (
                  <button 
                    className="btn btn-sm"
                    style={{ background: '#17a2b8', color: 'white' }}
                    onClick={() => updateOrderStatus(selectedOrder.id, 'shipped')}
                  >
                    Mark as Shipped
                  </button>
                )}
                {selectedOrder.status === 'shipped' && (
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                  >
                    Mark as Delivered
                  </button>
                )}
                {selectedOrder.status === 'awaiting_return' && (
                  <>
                    <button 
                      className="btn btn-sm"
                      style={{ background: '#28a745', color: 'white' }}
                      onClick={() => updateOrderStatus(selectedOrder.id, 'returned')}
                    >
                      Approve Return
                    </button>
                    <button 
                      className="btn btn-sm"
                      style={{ background: '#e74c3c', color: 'white', marginLeft: '0.5rem' }}
                      onClick={() => updateOrderStatus(selectedOrder.id, 'return_declined')}
                    >
                      Decline Return
                    </button>
                  </>
                )}
                {!selectedOrder.payment_status && (
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={() => updateOrderStatus(selectedOrder.id, selectedOrder.status, true)}
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setShowOrderModal(false);
                  setSelectedOrder(null);
                  setOrderDetails(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Order Notes</h3>
              <button 
                className="modal-close"
                onClick={() => setShowNotesModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Admin Notes</label>
                <textarea
                  value={notesForm}
                  onChange={(e) => setNotesForm(e.target.value)}
                  rows="4"
                  placeholder="Add notes about this order..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => setShowNotesModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-sm btn-primary"
                onClick={updateOrderNotes}
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;

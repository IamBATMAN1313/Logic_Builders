import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import './AdminPages.css';

const Inventory = () => {
  const { hasPermission } = useAdminAuth();
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    total_products: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    total_inventory_value: 0
  });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    low_stock_only: false,
    sort_by: 'stock',
    sort_order: 'ASC',
    category: '',
    search: ''
  });
  const [editingStock, setEditingStock] = useState(null);
  const [stockForm, setStockForm] = useState({
    stock: '',
    operation: 'set'
  });

  useEffect(() => {
    fetchInventory();
    fetchCategories();
  }, [filters]);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const queryParams = new URLSearchParams(filters);
      
      const response = await fetch(`/api/admin/inventory?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInventory(data.inventory || []);
        setStats(data.stats || {});
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/inventory/${editingStock.id}/stock`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stockForm)
      });

      if (response.ok) {
        setEditingStock(null);
        setStockForm({ stock: '', operation: 'set' });
        fetchInventory();
        alert('Stock updated successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Error updating stock');
    }
  };

  const startEditStock = (product) => {
    setEditingStock(product);
    setStockForm({ stock: product.stock, operation: 'set' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const handlePageChange = (newPage) => {
    setFilters({...filters, page: newPage});
  };

  const renderPagination = () => {
    const { page, pages } = pagination;
    const pageNumbers = [];
    
    // Calculate page range to show
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
          Page {page} of {pages} ({pagination.total || inventory.length} items)
        </div>
      </div>
    );
  };

  if (!hasPermission('INVENTORY_MANAGER')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access inventory management.</p>
        <p>Required clearance: INVENTORY_MANAGER</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Inventory Management</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setFilters({...filters, low_stock_only: !filters.low_stock_only})}
          >
            {filters.low_stock_only ? 'Show All' : 'Low Stock Only'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-row">
          <div>
            <label className="filter-label">Search Products</label>
            <input
              type="text"
              placeholder="Search by name or product ID..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
            />
          </div>
          
          <div>
            <label className="filter-label">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value, page: 1})}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="filter-label">Items per page</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({...filters, limit: parseInt(e.target.value), page: 1})}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          
          <div>
            <label className="filter-label">Filter</label>
            <select
              value={filters.low_stock_only ? 'low_stock' : 'all'}
              onChange={(e) => setFilters({...filters, low_stock_only: e.target.value === 'low_stock', page: 1})}
            >
              <option value="all">All Items</option>
              <option value="low_stock">Low Stock Only</option>
            </select>
          </div>
        </div>
        
        <div className="sorting-controls">
          <div className="sort-group">
            <label>Sort by</label>
            <select
              value={filters.sort_by}
              onChange={(e) => setFilters({...filters, sort_by: e.target.value, page: 1})}
            >
              <option value="stock">Stock Level</option>
              <option value="name">Product Name</option>
              <option value="cost">Cost per Unit</option>
              <option value="selling_price">Selling Price</option>
              <option value="units_sold">Units Sold</option>
              <option value="value">Stock Value</option>
              <option value="category">Category</option>
            </select>
          </div>
          
          <div className="sort-group">
            <label>Order</label>
            <select
              value={filters.sort_order}
              onChange={(e) => setFilters({...filters, sort_order: e.target.value, page: 1})}
            >
              <option value="ASC">Ascending</option>
              <option value="DESC">Descending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Stats */}
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>Total Products</h3>
          <p>{stats.total_products || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
          <h3>Low Stock</h3>
          <p>{stats.low_stock_count || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#e74c3c' }}>
          <h3>Out of Stock</h3>
          <p>{stats.out_of_stock_count || 0}</p>
        </div>
        <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
          <h3>Total Value</h3>
          <p>{formatCurrency(stats.total_inventory_value)}</p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading">Loading inventory...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Selling Price</th>
                <th>Cost per Unit</th>
                <th>Units Sold</th>
                <th>Stock Value</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => (
                <tr key={item.id}>
                  <td>#{item.id}</td>
                  <td>
                    <div className="product-name">{item.name}</div>
                  </td>
                  <td>{item.category_name}</td>
                  <td>
                    <span className={`stock ${item.stock <= 10 ? 'low-stock' : ''}`}>
                      {item.stock || 0}
                    </span>
                  </td>
                  <td>{formatCurrency(item.selling_price)}</td>
                  <td>{formatCurrency(item.inventory_cost)}</td>
                  <td>{item.units_sold || 0}</td>
                  <td>{formatCurrency((item.stock || 0) * (item.inventory_cost || 0))}</td>
                  <td>
                    <span className={`status ${item.availability ? 'available' : 'unavailable'}`}>
                      {item.availability ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => startEditStock(item)}
                    >
                      Update Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && renderPagination()}

      {/* Stock Update Modal */}
      {editingStock && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Update Stock - {editingStock.name}</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setEditingStock(null);
                  setStockForm({ stock: '', operation: 'set' });
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleUpdateStock}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Current Stock: {editingStock.stock}</label>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Operation</label>
                    <select
                      value={stockForm.operation}
                      onChange={(e) => setStockForm({...stockForm, operation: e.target.value})}
                    >
                      <option value="set">Set to specific amount</option>
                      <option value="add">Add to current stock</option>
                      <option value="subtract">Subtract from current stock</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>
                      {stockForm.operation === 'set' ? 'New Stock Amount' : 
                       stockForm.operation === 'add' ? 'Amount to Add' : 'Amount to Subtract'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stockForm.stock}
                      onChange={(e) => setStockForm({...stockForm, stock: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Preview:</label>
                  <p style={{ 
                    background: '#f8f9fa', 
                    padding: '1rem', 
                    borderRadius: '5px',
                    color: '#2c3e50',
                    fontWeight: 'bold'
                  }}>
                    {stockForm.operation === 'set' 
                      ? `New stock will be: ${stockForm.stock || 0}`
                      : stockForm.operation === 'add'
                      ? `New stock will be: ${(editingStock.stock || 0) + parseInt(stockForm.stock || 0)}`
                      : `New stock will be: ${Math.max(0, (editingStock.stock || 0) - parseInt(stockForm.stock || 0))}`
                    }
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setEditingStock(null);
                  setStockForm({ stock: '', operation: 'set' });
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;

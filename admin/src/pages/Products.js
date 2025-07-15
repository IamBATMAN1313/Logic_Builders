import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import './AdminPages.css';

const Products = () => {
  const { hasPermission } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
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
    category: '',
    search: '',
    availability: '',
    sort_by: 'created_at',
    sort_order: 'DESC'
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    excerpt: '',
    price: '',
    discount_percent: '',
    discount_status: false,
    category_id: '',
    availability: true,
    cost: '',
    stock: '',
    specs: {}
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [filters]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const queryParams = new URLSearchParams(filters);
      
      const response = await fetch(`/api/admin/products?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productForm)
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchProducts();
        alert('Product created successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Error creating product');
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productForm)
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
        alert('Product updated successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error updating product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchProducts();
        alert('Product deleted successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product');
    }
  };

  const startEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      excerpt: product.excerpt || '',
      price: product.price || '',
      discount_percent: product.discount_percent || '',
      discount_status: product.discount_status || false,
      category_id: product.category_id || '',
      availability: product.availability !== false,
      cost: product.cost || '',
      stock: product.stock || '',
      specs: product.specs || {}
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setProductForm({
      name: '',
      excerpt: '',
      price: '',
      discount_percent: '',
      discount_status: false,
      category_id: '',
      availability: true,
      cost: '',
      stock: '',
      specs: {}
    });
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

  const handleSortChange = (sortBy) => {
    const newOrder = filters.sort_by === sortBy && filters.sort_order === 'ASC' ? 'DESC' : 'ASC';
    setFilters({...filters, sort_by: sortBy, sort_order: newOrder, page: 1});
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
          Page {page} of {pages} ({pagination.total} total products)
        </div>
      </div>
    );
  };

  const getSpecsTemplate = (categoryId) => {
    const specsTemplates = {
      2: { // Laptops
        processor: '',
        ram: '',
        storage: '',
        screen_size: '',
        operating_system: '',
        graphics: '',
        weight: ''
      },
      3: { // Case Accessory
        type: '',
        form_factor: '',
        color: ''
      },
      4: { // Case Fan
        size: '',
        rpm: '',
        airflow: '',
        noise_level: '',
        color: '',
        'pwm_(4-pin)': ''
      },
      5: { // Case
        type: '',
        color: '',
        'side_panel': '',
        'power_supply_shroud': '',
        'front_panel_usb': '',
        'motherboard_support': ''
      },
      6: { // CPU Cooler
        'fan_rpm': '',
        'noise_level': '',
        color: '',
        height: '',
        'cpu_socket': ''
      },
      7: { // CPU
        'core_count': '',
        'core_clock': '',
        'boost_clock': '',
        'tdp': '',
        'graphics': '',
        'smt': ''
      },
      8: { // External Hard Drive
        capacity: '',
        type: '',
        cache: '',
        form_factor: '',
        interface: ''
      },
      9: { // Fan Controller
        'channel_count': '',
        form_factor: '',
        'pwm_channels': ''
      },
      10: { // Headphones
        frequency_response: '',
        microphone: '',
        wireless: '',
        color: '',
        enclosure_type: ''
      },
      11: { // Internal Hard Drive
        capacity: '',
        type: '',
        cache: '',
        form_factor: '',
        interface: ''
      },
      12: { // Keyboard
        style: '',
        switches: '',
        backlit: '',
        tenkeyless: '',
        connection_type: '',
        color: ''
      },
      13: { // Laptop
        processor: '',
        ram: '',
        storage: '',
        screen_size: '',
        operating_system: '',
        graphics: '',
        weight: ''
      },
      14: { // Memory
        speed: '',
        modules: '',
        price_per_gb: '',
        color: '',
        'first_word_latency': '',
        'cas_latency': ''
      },
      15: { // Monitor
        screen_size: '',
        resolution: '',
        refresh_rate: '',
        response_time: '',
        panel_type: '',
        'aspect_ratio': ''
      },
      16: { // Motherboard
        socket: '',
        form_factor: '',
        'max_memory': '',
        'memory_slots': '',
        color: '',
        'sli/crossfire': ''
      },
      17: { // Mouse
        tracking_method: '',
        connection_type: '',
        'max_dpi': '',
        'hand_orientation': '',
        color: ''
      },
      18: { // Optical Drive
        type: '',
        'bd_write_speed': '',
        'dvd_write_speed': '',
        'cd_write_speed': '',
        color: ''
      },
      19: { // OS
        mode: '',
        version: '',
        'max_supported_memory': '',
        requirements: ''
      },
      20: { // Power Supply
        type: '',
        efficiency: '',
        wattage: '',
        modular: '',
        color: '',
        fanless: ''
      },
      21: { // Software
        version: '',
        license_type: '',
        platform: '',
        requirements: ''
      },
      22: { // Sound Card
        channels: '',
        'digital_audio': '',
        'snr': '',
        'sample_rate': '',
        chipset: ''
      },
      23: { // Speakers
        frequency_response: '',
        wattage: '',
        color: '',
        'power_source': ''
      },
      24: { // Thermal Paste
        amount: '',
        type: ''
      },
      25: { // UPS
        capacity: '',
        type: '',
        outlets: '',
        'battery_backup_time': ''
      },
      26: { // Video Card
        gpu: '',
        memory: '',
        'core_clock': '',
        'boost_clock': '',
        color: '',
        length: ''
      },
      27: { // Wired Network Card
        interface: '',
        color: ''
      },
      28: { // Wireless Network Card
        protocols: '',
        interface: '',
        color: '',
        antenna: ''
      }
    };

    return specsTemplates[categoryId] || {};
  };

  const handleCategoryChange = (categoryId) => {
    const specsTemplate = getSpecsTemplate(parseInt(categoryId));
    setProductForm({
      ...productForm, 
      category_id: categoryId,
      specs: specsTemplate
    });
  };

  const handleSpecChange = (specKey, value) => {
    setProductForm({
      ...productForm,
      specs: {
        ...productForm.specs,
        [specKey]: value
      }
    });
  };

  const handleDiscountChange = (value) => {
    const discountPercent = parseFloat(value) || 0;
    setProductForm({
      ...productForm,
      discount_percent: value,
      discount_status: discountPercent > 0
    });
  };

  if (!hasPermission('PRODUCT_MANAGER')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access product management.</p>
        <p>Required clearance: PRODUCT_MANAGER</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Product Management</h1>
        <button 
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          Add New Product
        </button>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-row">
          <div>
            <label className="filter-label">Search Products</label>
            <input
              type="text"
              placeholder="Search by name, description, or product ID..."
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
            <label className="filter-label">Availability</label>
            <select
              value={filters.availability}
              onChange={(e) => setFilters({...filters, availability: e.target.value, page: 1})}
            >
              <option value="">All Products</option>
              <option value="true">Available Only</option>
              <option value="false">Unavailable Only</option>
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
        </div>
        
        <div className="sorting-controls">
          <div className="sort-group">
            <label>Sort by</label>
            <select
              value={filters.sort_by}
              onChange={(e) => setFilters({...filters, sort_by: e.target.value, page: 1})}
            >
              <option value="created_at">Date Created</option>
              <option value="name">Product Name</option>
              <option value="price">Selling Price</option>
              <option value="cost">Cost Price</option>
              <option value="stock">Stock Level</option>
              <option value="units_sold">Units Sold</option>
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

      {/* Products Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Selling Price</th>
                <th>Cost Price</th>
                <th>Discount</th>
                <th>Final Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>#{product.id}</td>
                  <td>
                    <div className="product-name">{product.name}</div>
                    <div className="product-description">{product.excerpt}</div>
                  </td>
                  <td>{product.category_name}</td>
                  <td>{formatCurrency(product.price)}</td>
                  <td>{formatCurrency(product.cost)}</td>
                  <td>{product.discount_percent || 0}%</td>
                  <td>{formatCurrency(product.price * (1 - (product.discount_percent || 0) / 100))}</td>
                  <td>
                    <span className={`stock ${product.stock <= 10 ? 'low-stock' : ''}`}>
                      {product.stock || 0}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${product.availability ? 'available' : 'unavailable'}`}>
                      {product.availability ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => startEditProduct(product)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      Delete
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

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Product</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateProduct}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={productForm.category_id}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={productForm.excerpt}
                    onChange={(e) => setProductForm({...productForm, excerpt: e.target.value})}
                    rows="3"
                  />
                </div>

                {/* Specs Section */}
                {productForm.category_id && Object.keys(productForm.specs).length > 0 && (
                  <div className="specs-section">
                    <h4>Product Specifications</h4>
                    <div className="specs-grid">
                      {Object.keys(productForm.specs).map((specKey) => (
                        <div key={specKey} className="form-group">
                          <label>{specKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                          <input
                            type="text"
                            value={productForm.specs[specKey]}
                            onChange={(e) => handleSpecChange(specKey, e.target.value)}
                            placeholder={`Enter ${specKey.replace(/_/g, ' ')}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Selling Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.price}
                      onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Cost Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.cost}
                      onChange={(e) => setProductForm({...productForm, cost: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={productForm.discount_percent}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Initial Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.stock}
                      onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={productForm.availability}
                      onChange={(e) => setProductForm({...productForm, availability: e.target.checked})}
                    />
                    Available for sale
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Product - {editingProduct.name}</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleUpdateProduct}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={productForm.category_id}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={productForm.excerpt}
                    onChange={(e) => setProductForm({...productForm, excerpt: e.target.value})}
                    rows="3"
                  />
                </div>

                {/* Specs Section */}
                {productForm.category_id && Object.keys(productForm.specs).length > 0 && (
                  <div className="specs-section">
                    <h4>Product Specifications</h4>
                    <div className="specs-grid">
                      {Object.keys(productForm.specs).map((specKey) => (
                        <div key={specKey} className="form-group">
                          <label>{specKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                          <input
                            type="text"
                            value={productForm.specs[specKey]}
                            onChange={(e) => handleSpecChange(specKey, e.target.value)}
                            placeholder={`Enter ${specKey.replace(/_/g, ' ')}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Selling Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.price}
                      onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Cost Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.cost}
                      onChange={(e) => setProductForm({...productForm, cost: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={productForm.discount_percent}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.stock}
                      onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={productForm.availability}
                      onChange={(e) => setProductForm({...productForm, availability: e.target.checked})}
                    />
                    Available for sale
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  resetForm();
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;

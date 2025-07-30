import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import ProductImage from '../ReUse/ProductImage';
import '../css/Builds.css';
import '../css/BuildValidation.css';

export default function Builds() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showError, showWarning, showConfirm } = useNotification();
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBuildDetails, setShowBuildDetails] = useState(null);
  const [buildDetails, setBuildDetails] = useState(null);
  const [newBuildName, setNewBuildName] = useState('');
  const [editingName, setEditingName] = useState(null);
  const [showComponentSelector, setShowComponentSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productLoading, setProductLoading] = useState(false);

  useEffect(() => {
    fetchBuilds();
    
    // Check if there's a build ID in the URL parameters
    const buildId = searchParams.get('build');
    if (buildId) {
      setShowBuildDetails(parseInt(buildId));
      fetchBuildDetails(parseInt(buildId));
    }
  }, [searchParams]);

  const fetchBuilds = async () => {
    try {
      setLoading(true);
      const response = await api.get('/builds');
      setBuilds(response.data);
    } catch (err) {
      setError('Failed to fetch builds');
      console.error('Builds fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createBuild = async () => {
    if (!newBuildName.trim()) {
      showWarning('Please enter a build name');
      return;
    }

    try {
      const response = await api.post('/builds', { name: newBuildName.trim() });
      setBuilds([response.data, ...builds]);
      setNewBuildName('');
      setShowCreateModal(false);
      // Open the new build for editing
      setShowBuildDetails(response.data.id);
      fetchBuildDetails(response.data.id);
    } catch (err) {
      console.error('Create build error:', err);
      showError('Failed to create build');
    }
  };

  const updateBuildName = async (buildId, newName) => {
    if (!newName.trim()) {
      showWarning('Please enter a valid build name');
      return;
    }

    try {
      const response = await api.put(`/builds/${buildId}/name`, { name: newName.trim() });
      setBuilds(builds.map(build => 
        build.id === buildId ? { ...build, name: response.data.name } : build
      ));
      if (buildDetails && buildDetails.id === buildId) {
        setBuildDetails({ ...buildDetails, name: response.data.name });
      }
      setEditingName(null);
      showSuccess('Build name updated successfully');
    } catch (err) {
      console.error('Update build name error:', err);
      showError('Failed to update build name');
    }
  };

  const deleteBuild = async (buildId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this build?',
      () => {},
      () => {}
    );
    if (!confirmed) return;
    
    try {
      await api.delete(`/builds/${buildId}`);
      setBuilds(builds => builds.filter(build => build.id !== buildId));
      if (showBuildDetails === buildId) {
        setShowBuildDetails(null);
        setBuildDetails(null);
      }
      showSuccess('Build deleted successfully');
    } catch (err) {
      console.error('Delete build error:', err);
      showError('Failed to delete build');
    }
  };

  const fetchBuildDetails = async (buildId) => {
    try {
      setLoading(true);
      console.log('Fetching build details for ID:', buildId);
      
      const response = await api.get(`/builds/${buildId}`);
      console.log('Build details response:', response.data);
      
      setBuildDetails(response.data);
    } catch (err) {
      console.error('Fetch build details error:', err);
      console.log('Error response:', err.response?.data);
      console.log('Error status:', err.response?.status);
      setError(`Failed to fetch build details: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryProducts = async (categoryName) => {
    try {
      setProductLoading(true);
      
      if (categoryName === 'Storage') {
        // Fetch both Internal and External Hard Drives for Storage
        const [internalResponse, externalResponse] = await Promise.all([
          api.get('/products?category=Internal Hard Drive'),
          api.get('/products?category=External Hard Drive')
        ]);
        setAvailableProducts([...internalResponse.data, ...externalResponse.data]);
      } else if (categoryName === 'CPU') {
        // Handle CPU category mapping
        const response = await api.get('/products?category=Cpu');
        setAvailableProducts(response.data);
      } else {
        const response = await api.get(`/products?category=${categoryName}`);
        setAvailableProducts(response.data);
      }
    } catch (err) {
      console.error('Fetch category products error:', err);
      setAvailableProducts([]);
    } finally {
      setProductLoading(false);
    }
  };

  const addComponentToBuild = async (productId) => {
    if (!showBuildDetails) return;
    
    try {
      await api.post(`/builds/${showBuildDetails}/add-product`, {
        product_id: productId,
        quantity: 1
      });
      
      // Refresh build details
      fetchBuildDetails(showBuildDetails);
      setShowComponentSelector(false);
      setSelectedCategory(null);
      showSuccess('Component added to build successfully');
    } catch (err) {
      console.error('Add component error:', err);
      showError('Failed to add component to build');
    }
  };

  const removeComponentFromBuild = async (productId) => {
    if (!showBuildDetails) return;
    
    try {
      await api.delete(`/builds/${showBuildDetails}/product/${productId}`);
      
      // Refresh build details
      fetchBuildDetails(showBuildDetails);
      showSuccess('Component removed from build successfully');
    } catch (err) {
      console.error('Remove component error:', err);
      showError('Failed to remove component from build');
    }
  };

  const addBuildToCart = async (buildId) => {
    try {
      // Check if build has all required components
      if (!hasRequiredComponents()) {
        showError('Build cannot be added to cart. Missing required components: ' + getMissingComponents().join(', '));
        return;
      }

      await api.post('/cart/add', {
        build_id: buildId,
        quantity: 1
      });
      showSuccess('Build added to cart successfully!');
    } catch (err) {
      console.error('Add build to cart error:', err);
      showError('Failed to add build to cart. Please try again.');
    }
  };

  const hasRequiredComponents = () => {
    const requiredCategories = ['CPU', 'Motherboard', 'Memory', 'Power Supply', 'Storage'];
    
    for (const category of requiredCategories) {
      let categoryProducts = [];
      
      if (category === 'Storage') {
        categoryProducts = buildDetails?.products?.filter(p => 
          p.category_name === 'Internal Hard Drive' || p.category_name === 'External Hard Drive'
        ) || [];
      } else if (category === 'CPU') {
        categoryProducts = buildDetails?.products?.filter(p => 
          p.category_name === 'Cpu' || p.category_name === 'CPU'
        ) || [];
      } else {
        categoryProducts = buildDetails?.products?.filter(p => 
          p.category_name === category
        ) || [];
      }
      
      if (categoryProducts.length === 0) {
        return false;
      }
    }
    return true;
  };

  const getMissingComponents = () => {
    const requiredCategories = [
      { name: 'CPU', displayName: 'CPU' },
      { name: 'Motherboard', displayName: 'Motherboard' },
      { name: 'Memory', displayName: 'RAM' },
      { name: 'Power Supply', displayName: 'Power Supply' },
      { name: 'Storage', displayName: 'Storage' }
    ];
    
    const missing = [];
    
    for (const category of requiredCategories) {
      let categoryProducts = [];
      
      if (category.name === 'Storage') {
        categoryProducts = buildDetails?.products?.filter(p => 
          p.category_name === 'Internal Hard Drive' || p.category_name === 'External Hard Drive'
        ) || [];
      } else if (category.name === 'CPU') {
        categoryProducts = buildDetails?.products?.filter(p => 
          p.category_name === 'Cpu' || p.category_name === 'CPU'
        ) || [];
      } else {
        categoryProducts = buildDetails?.products?.filter(p => 
          p.category_name === category.name
        ) || [];
      }
      
      if (categoryProducts.length === 0) {
        missing.push(category.displayName);
      }
    }
    return missing;
  };

  const renderComponentCategories = () => {
    const categories = [
      // Required components
      { name: 'CPU', icon: '🧠', required: true, displayName: 'CPU' },
      { name: 'Motherboard', icon: '🔌', required: true, displayName: 'Motherboard' },
      { name: 'Memory', icon: '💾', required: true, displayName: 'RAM', allowMultiple: true },
      { name: 'Power Supply', icon: '⚡', required: true, displayName: 'PSU' },
      { name: 'Storage', icon: '💽', required: true, displayName: 'Storage', allowMultiple: true },
      
      // Optional components
      { name: 'Video Card', icon: '🎮', required: false, displayName: 'Graphics Card' },
      { name: 'Case', icon: '📦', required: false, displayName: 'Case' },
      { name: 'Cpu Cooler', icon: '❄️', required: false, displayName: 'CPU Cooler' },
      { name: 'Monitor', icon: '🖥️', required: false, displayName: 'Monitor', allowMultiple: true },
      { name: 'Keyboard', icon: '⌨️', required: false, displayName: 'Keyboard' },
      { name: 'Mouse', icon: '🖱️', required: false, displayName: 'Mouse' },
      { name: 'Headphones', icon: '🎧', required: false, displayName: 'Headphones' },
      { name: 'Speakers', icon: '🔊', required: false, displayName: 'Speakers', allowMultiple: true },
      { name: 'Case Fan', icon: '🌀', required: false, displayName: 'Case Fan', allowMultiple: true },
      { name: 'Optical Drive', icon: '💿', required: false, displayName: 'Optical Drive' }
    ];

    const requiredCategories = categories.filter(cat => cat.required);
    const optionalCategories = categories.filter(cat => !cat.required);

    return (
      <>
        <div className="category-section">
          <h4 className="section-title">Required Components</h4>
          <div className="components-grid">
            {requiredCategories.map(category => renderCategoryCard(category))}
          </div>
        </div>
        
        <div className="category-section">
          <h4 className="section-title">Optional Components</h4>
          <div className="components-grid">
            {optionalCategories.map(category => renderCategoryCard(category))}
          </div>
        </div>
      </>
    );
  };

  const renderCategoryCard = (category) => {
    let categoryProducts = [];
    
    if (category.name === 'Storage') {
      // For storage, include both Internal and External Hard Drives
      categoryProducts = buildDetails?.products?.filter(p => 
        p.category_name === 'Internal Hard Drive' || p.category_name === 'External Hard Drive'
      ) || [];
    } else if (category.name === 'CPU') {
      // Map 'Cpu' to 'CPU' 
      categoryProducts = buildDetails?.products?.filter(p => 
        p.category_name === 'Cpu' || p.category_name === 'CPU'
      ) || [];
    } else {
      categoryProducts = buildDetails?.products?.filter(p => 
        p.category_name === category.name
      ) || [];
    }

    return (
      <div key={category.name} className="component-category">
        <div className="category-header">
          <span className="category-icon">{category.icon}</span>
          <h4>{category.displayName}</h4>
          {category.required && <span className="required">*</span>}
          <button 
            className="add-component-btn"
            onClick={() => openComponentSelector(category.name)}
          >
            {categoryProducts.length > 0 ? (category.allowMultiple ? 'Add More' : 'Change') : 'Add'}
          </button>
        </div>
        
        {categoryProducts.length > 0 ? (
          <div className="selected-components">
            {categoryProducts.map(product => (
              <div key={product.product_id} className="component-item">
                <ProductImage
                  src={product.image_url} 
                  alt={product.name}
                  size="small"
                />
                <div className="component-info">
                  <h5>{product.name}</h5>
                  <p className="component-price">${product.price}</p>
                  {product.quantity > 1 && <span className="quantity">x{product.quantity}</span>}
                </div>
                <button 
                  className="remove-component"
                  onClick={() => removeComponentFromBuild(product.product_id)}
                  title="Remove component"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-component">
            <p>No {category.displayName.toLowerCase()} selected</p>
          </div>
        )}
      </div>
    );
  };

  const openComponentSelector = (categoryName) => {
    setSelectedCategory(categoryName);
    setShowComponentSelector(true);
    fetchCategoryProducts(categoryName);
  };

  if (loading && !buildDetails) return <div className="loading">Loading builds...</div>;
  if (error) return <div className="error">{error}</div>;

  // Build details view
  if (showBuildDetails && buildDetails) {
    return (
      <div className="build-details-page">
        <div className="build-details-header">
          <button 
            className="back-btn"
            onClick={() => {
              setShowBuildDetails(null);
              setBuildDetails(null);
            }}
          >
            ← Back to Builds
          </button>
          
          <div className="build-title">
            {editingName === buildDetails.id ? (
              <div className="edit-name-form">
                <input
                  type="text"
                  value={newBuildName}
                  onChange={(e) => setNewBuildName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      updateBuildName(buildDetails.id, newBuildName);
                    }
                  }}
                  placeholder="Enter build name"
                  autoFocus
                />
                <button onClick={() => updateBuildName(buildDetails.id, newBuildName)}>Save</button>
                <button onClick={() => setEditingName(null)}>Cancel</button>
              </div>
            ) : (
              <div className="build-name-display">
                <h2>{buildDetails.name}</h2>
                <button 
                  className="edit-name-btn"
                  onClick={() => {
                    setEditingName(buildDetails.id);
                    setNewBuildName(buildDetails.name);
                  }}
                >
                  ✏️
                </button>
              </div>
            )}
          </div>

          <div className="build-summary">
            <div className="build-total">
              <strong>Total: ${buildDetails.total_price || '0.00'}</strong>
            </div>
            <div className="build-validation">
              {!hasRequiredComponents() && (
                <div className="missing-components">
                  <p className="warning">⚠️ Missing required components:</p>
                  <ul>
                    {getMissingComponents().map(component => (
                      <li key={component}>{component}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button 
              className={`add-to-cart-btn ${!hasRequiredComponents() ? 'disabled' : ''}`}
              onClick={() => addBuildToCart(buildDetails.id)}
              disabled={!hasRequiredComponents()}
            >
              {hasRequiredComponents() ? 'Add to Cart' : 'Missing Required Components'}
            </button>
          </div>
        </div>

        <div className="build-components">
          <h3>Components</h3>
          <div className="components-list">
            {renderComponentCategories()}
          </div>
        </div>

        {/* Component Selector Modal */}
        {showComponentSelector && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Select {selectedCategory}</h3>
                <button 
                  className="close-modal"
                  onClick={() => {
                    setShowComponentSelector(false);
                    setSelectedCategory(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-content">
                {productLoading ? (
                  <div className="loading">Loading products...</div>
                ) : availableProducts.length === 0 ? (
                  <div className="no-products">
                    <p>No products available in this category.</p>
                  </div>
                ) : (
                  <div className="products-grid">
                    {availableProducts.map(product => (
                      <div key={product.id} className="product-item">
                        <ProductImage
                          src={product.image_url} 
                          alt={product.name}
                          size="medium"
                        />
                        <div className="product-info">
                          <h5>{product.name}</h5>
                          <p className="product-price">${product.price}</p>
                          <div className="product-specs">
                            {product.specs && Object.entries(product.specs).slice(0, 3).map(([key, value]) => (
                              <span key={key} className="spec">
                                {key}: {value}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button 
                          className="add-product-btn"
                          onClick={() => addComponentToBuild(product.id)}
                        >
                          Add to Build
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main builds list view
  return (
    <div className="builds-page">
      <div className="page-header">
        <div>
          <h2>PC Builds</h2>
          <p>Create and manage your custom PC builds</p>
        </div>
        <button 
          className="create-build-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + Create New Build
        </button>
      </div>

      {/* Create Build Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Build</h3>
              <button 
                className="close-modal"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBuildName('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Build Name</label>
                <input
                  type="text"
                  value={newBuildName}
                  onChange={(e) => setNewBuildName(e.target.value)}
                  placeholder="e.g., Gaming Beast, Budget Build, Workstation"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      createBuild();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBuildName('');
                }}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={createBuild}
                disabled={!newBuildName.trim()}
              >
                Create Build
              </button>
            </div>
          </div>
        </div>
      )}

      {builds.length === 0 ? (
        <div className="no-builds">
          <div className="no-builds-content">
            <span className="no-builds-icon">🖥️</span>
            <h3>No builds yet</h3>
            <p>Create your first custom PC build to get started.</p>
            <button 
              className="create-first-build-btn"
              onClick={() => setShowCreateModal(true)}
            >
              Create Your First Build
            </button>
          </div>
        </div>
      ) : (
        <div className="builds-grid">
          {builds.map((build) => (
            <div key={build.id} className="build-card">
              <div className="build-header">
                <h3>{build.name}</h3>
                <div className="build-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => {
                      setShowBuildDetails(build.id);
                      fetchBuildDetails(build.id);
                    }}
                  >
                    Edit
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => deleteBuild(build.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="build-image">
                <img 
                  src={build.image_url || "/placeholder-build.jpg"}
                  alt={build.name}
                  onError={(e) => {
                    e.target.src = "/placeholder-build.jpg";
                  }}
                />
              </div>

              <div className="build-specs">
                <div className="build-stats">
                  <div className="stat">
                    <span className="stat-label">Components:</span>
                    <span className="stat-value">{build.product_count || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Total:</span>
                    <span className="stat-value">${build.total_price || '0.00'}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Status:</span>
                    <span className="stat-value">{build.status || 'In Progress'}</span>
                  </div>
                </div>
              </div>

              <div className="build-footer">
                <button 
                  className="view-build-btn"
                  onClick={() => {
                    setShowBuildDetails(build.id);
                    fetchBuildDetails(build.id);
                  }}
                >
                  View Build
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

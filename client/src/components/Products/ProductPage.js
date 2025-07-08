import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api';
import '../css/ProductPage.css';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [builds, setBuilds] = useState([]);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [addingToBuild, setAddingToBuild] = useState(false);

  // Helper function to safely format prices
  const formatPrice = (price) => {
    const numPrice = parseFloat(price) || 0;
    return numPrice.toFixed(2);
  };

  useEffect(() => {
    fetchProduct();
    if (user) {
      fetchUserBuilds();
    }
  }, [id, user]);

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      const productData = response.data;
      
      // Ensure price is a number
      if (productData.price) {
        productData.price = parseFloat(productData.price);
      }
      
      setProduct(productData);
    } catch (err) {
      setError('Product not found');
      console.error('Product fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBuilds = async () => {
    try {
      const response = await api.get('/builds');
      setBuilds(response.data);
    } catch (err) {
      console.error('Builds fetch error:', err);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setAddingToCart(true);
    try {
      await api.post('/cart/add', {
        product_id: product.id,
        quantity: quantity
      });
      
      // Show success message (you can add a toast notification here)
      alert('Product added to cart successfully!');
    } catch (err) {
      console.error('Add to cart error:', err);
      alert('Failed to add product to cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleAddToBuild = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (builds.length === 0) {
      // Create a new build first
      try {
        const response = await api.post('/builds', {
          name: 'My Build',
          description: 'Custom PC Build'
        });
        const newBuildId = response.data.id;
        await addProductToBuild(newBuildId);
      } catch (err) {
        console.error('Create build error:', err);
        alert('Failed to create build. Please try again.');
      }
    } else {
      setShowBuildModal(true);
    }
  };

  const addProductToBuild = async (buildId) => {
    setAddingToBuild(true);
    try {
      await api.post(`/builds/${buildId}/add-product`, {
        product_id: product.id,
        quantity: quantity
      });
      
      alert('Product added to build successfully!');
      setShowBuildModal(false);
      setSelectedBuild('');
      fetchUserBuilds(); // Refresh builds
    } catch (err) {
      console.error('Add to build error:', err);
      alert('Failed to add product to build. Please try again.');
    } finally {
      setAddingToBuild(false);
    }
  };

  const handleBuildSelection = () => {
    if (selectedBuild === 'new') {
      // Create new build
      api.post('/builds', {
        name: 'My Build',
        description: 'Custom PC Build'
      }).then(response => {
        addProductToBuild(response.data.id);
      }).catch(err => {
        console.error('Create build error:', err);
        alert('Failed to create build. Please try again.');
      });
    } else if (selectedBuild) {
      addProductToBuild(parseInt(selectedBuild));
    }
  };

  const renderSpecs = () => {
    const specs = product.specs || {};
    const specEntries = Object.entries(specs);
    
    if (specEntries.length === 0) {
      return <p className="no-specs">No specifications available</p>;
    }

    return (
      <div className="specs-grid">
        {specEntries.map(([key, value]) => (
          <div key={key} className="spec-item">
            <span className="spec-label">
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <span className="spec-value">{value}</span>
          </div>
        ))}
      </div>
    );
  };

  const calculateDiscountedPrice = () => {
    if (!product || typeof product.price !== 'number') {
      return 0;
    }
    if (product.discount_status && product.discount_percent > 0) {
      return product.price * (1 - product.discount_percent / 100);
    }
    return product.price;
  };

  if (loading) return <div className="loading">Loading product...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!product) return <div className="error">Product not found</div>;

  const finalPrice = calculateDiscountedPrice();

  return (
    <div className="product-page">
      <div className="product-container">
        <div className="product-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/categories">Categories</Link>
          <span>/</span>
          <Link to={`/category/${product.category_id}`}>
            {product.category_name || 'Category'}
          </Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <div className="product-content">
          <div className="product-image-section">
            <div className="product-image">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <div className="no-image">
                  <span>📷</span>
                  <p>No image available</p>
                </div>
              )}
            </div>
          </div>

          <div className="product-details-section">
            <div className="product-header">
              <h1 className="product-title">{product.name}</h1>
              <div className="product-availability">
                <span className={`availability-badge ${product.availability ? 'in-stock' : 'out-of-stock'}`}>
                  {product.availability ? '✓ In Stock' : '✗ Out of Stock'}
                </span>
                {product.stock !== undefined && (
                  <span className="stock-info">
                    {product.stock > 0 ? `${product.stock} available` : 'No stock'}
                  </span>
                )}
              </div>
            </div>

            <div className="product-pricing">
              {product.discount_status && product.discount_percent > 0 ? (
                <div className="price-with-discount">
                  <span className="original-price">${formatPrice(product.price)}</span>
                  <span className="discounted-price">${formatPrice(finalPrice)}</span>
                  <span className="discount-badge">-{product.discount_percent || 0}%</span>
                </div>
              ) : (
                <span className="regular-price">${formatPrice(product.price)}</span>
              )}
            </div>

            <div className="product-description">
              <h3>Description</h3>
              <p>{product.excerpt || 'No description available'}</p>
            </div>

            <div className="product-actions">
              <div className="quantity-selector">
                <label htmlFor="quantity">Quantity:</label>
                <div className="quantity-controls">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    max={product.stock || 10}
                    value={quantity}
                    onChange={(e) => {
                      const newQuantity = Math.max(1, parseInt(e.target.value) || 1);
                      const maxQuantity = product.stock || 10;
                      setQuantity(Math.min(newQuantity, maxQuantity));
                    }}
                  />
                  <button 
                    onClick={() => setQuantity(Math.min((product.stock || 10), quantity + 1))}
                    disabled={quantity >= (product.stock || 10)}
                  >
                    +
                  </button>
                </div>
                {product.stock && product.stock < 10 && (
                  <small className="stock-warning">Only {product.stock} left in stock</small>
                )}
              </div>

              <div className="action-buttons">
                <button
                  className="add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={!product.availability || addingToCart}
                >
                  {addingToCart ? 'Adding...' : '🛒 Add to Cart'}
                </button>
                
                <button
                  className="add-to-build-btn"
                  onClick={handleAddToBuild}
                  disabled={!product.availability || addingToBuild}
                >
                  {addingToBuild ? 'Adding...' : '🖥️ Add to Build'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="product-specs-section">
          <h2>Specifications</h2>
          {renderSpecs()}
        </div>
      </div>

      {/* Build Selection Modal */}
      {showBuildModal && (
        <div className="modal-overlay" onClick={() => setShowBuildModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Build</h3>
              <button 
                className="modal-close"
                onClick={() => setShowBuildModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <p>Choose which build to add this product to:</p>
              
              <div className="build-options">
                <label className="build-option">
                  <input
                    type="radio"
                    name="build"
                    value="new"
                    checked={selectedBuild === 'new'}
                    onChange={(e) => setSelectedBuild(e.target.value)}
                  />
                  <span>Create New Build</span>
                </label>
                
                {builds.map((build) => (
                  <label key={build.id} className="build-option">
                    <input
                      type="radio"
                      name="build"
                      value={build.id.toString()}
                      checked={selectedBuild === build.id.toString()}
                      onChange={(e) => setSelectedBuild(e.target.value)}
                    />
                    <span>{build.name || `Build #${build.id}`}</span>
                    <small>${formatPrice(build.total_price)}</small>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowBuildModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleBuildSelection}
                disabled={!selectedBuild || addingToBuild}
              >
                {addingToBuild ? 'Adding...' : 'Add to Build'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImage from '../ReUse/ProductImage';
import api from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import '../css/Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useNotification();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressFormData, setAddressFormData] = useState({
    address: '',
    city: '',
    zipCode: '',
    country: ''
  });

  useEffect(() => {
    fetchCartItems();
    fetchAddresses();
  }, []);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cart');
      setCartItems(response.data.items || []);
    } catch (err) {
      setError('Failed to fetch cart items');
      console.error('Cart fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      const response = await api.get('/user/addresses');
      setAddresses(response.data);
    } catch (err) {
      console.error('Fetch addresses error:', err);
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    try {
      await api.put(`/cart/item/${itemId}`, { quantity: newQuantity });
      setCartItems(items => 
        items.map(item => 
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (err) {
      console.error('Update quantity error:', err);
      showError('Failed to update quantity. Please try again.');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/cart/item/${itemId}`);
      setCartItems(items => items.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Remove item error:', err);
      showError('Failed to remove item. Please try again.');
    }
  };

  const clearCart = async () => {
    try {
      await api.delete('/cart/clear');
      setCartItems([]);
    } catch (err) {
      console.error('Clear cart error:', err);
      showError('Failed to clear cart. Please try again.');
    }
  };

  const handleCheckout = async () => {
    // Check if address is selected
    if (!selectedAddressId) {
      showWarning('Please select a shipping address before proceeding to checkout.');
      return;
    }

    try {
      // Create order from cart items with selected address
      const response = await api.post('/orders/from-cart', {
        shipping_address_id: selectedAddressId
      });
      showSuccess('Order placed successfully!');
      setCartItems([]); // Clear cart after successful order
      setSelectedAddressId(''); // Clear selected address
    } catch (err) {
      console.error('Checkout error:', err);
      showError('Failed to place order. Please try again.');
    }
  };

  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    
    if (!addressFormData.address || !addressFormData.city || !addressFormData.zipCode || !addressFormData.country) {
      showWarning('Please fill in all address fields');
      return;
    }

    try {
      const response = await api.post('/user/addresses', addressFormData);
      setAddresses([response.data, ...addresses]);
      setAddressFormData({ address: '', city: '', zipCode: '', country: '' });
      setShowAddressModal(false);
      showSuccess('Address added successfully!');
    } catch (err) {
      console.error('Add address error:', err);
      showError('Failed to add address. Please try again.');
    }
  };

  const handleItemClick = (item) => {
    if (item.product_id) {
      // Navigate to product page (note: route is /product/:id not /products/:id)
      navigate(`/product/${item.product_id}`);
    } else if (item.build_id) {
      // Navigate to build details
      navigate(`/account/builds?build=${item.build_id}`);
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const itemPrice = parseFloat(item.unit_price) || 0;
      return total + (itemPrice * item.quantity);
    }, 0).toFixed(2);
  };

  if (loading) return <div className="loading">Loading cart...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="cart-page">
      <div className="page-header">
        <h2>Shopping Cart</h2>
        <p>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in your cart</p>
      </div>

      {cartItems.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-content">
            <span className="empty-cart-icon">🛒</span>
            <h3>Your cart is empty</h3>
            <p>Add some products to get started!</p>
            <button 
              className="browse-products-btn"
              onClick={() => navigate('/categories')}
            >
              Browse Products
            </button>
          </div>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items">
            {cartItems.map((item) => {
              const itemName = item.product_name || item.build_name || 'Unknown Item';
              const itemPrice = parseFloat(item.unit_price) || 0;
              const itemImage = item.product_image || item.image_url || '/placeholder-product.jpg';
              
              return (
                <div key={item.id} className="cart-item">
                  <div 
                    className="item-image clickable" 
                    onClick={() => handleItemClick(item)}
                  >
                    <ProductImage 
                      src={itemImage}
                      alt={itemName}
                      size="small"
                      className="cart-item-image"
                    />
                  </div>
                  
                  <div 
                    className="item-details clickable" 
                    onClick={() => handleItemClick(item)}
                  >
                    <h3>{itemName}</h3>
                    {item.product_id && (
                      <p className="item-type">Product</p>
                    )}
                    {item.build_id && (
                      <p className="item-type">PC Build</p>
                    )}
                    <p className="item-price">${itemPrice.toFixed(2)}</p>
                    {!item.product_availability && item.product_id && (
                      <p className="unavailable-notice">⚠️ Currently unavailable</p>
                    )}
                  </div>

                  <div className="item-actions">
                    <div className="quantity-controls">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="quantity-btn"
                      >
                        -
                      </button>
                      <span className="quantity">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="quantity-btn"
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="item-total">
                      ${(itemPrice * item.quantity).toFixed(2)}
                    </div>
                    
                    <button 
                      className="remove-btn"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="item-link" onClick={() => handleItemClick(item)}>
                    <span>View Details</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-summary">
            <div className="summary-card">
              <h3>Order Summary</h3>
              
              {/* Address Selection Section */}
              <div className="address-selection">
                <h4>Shipping Address</h4>
                {addresses.length === 0 ? (
                  <div className="no-addresses">
                    <p>No addresses found. Please add an address to continue.</p>
                    <button 
                      className="add-address-btn"
                      onClick={() => setShowAddressModal(true)}
                    >
                      Add New Address
                    </button>
                  </div>
                ) : (
                  <div className="address-options">
                    {addresses.map((address) => (
                      <div key={address.id} className="address-option">
                        <label>
                          <input
                            type="radio"
                            name="selectedAddress"
                            value={address.id}
                            checked={selectedAddressId === address.id.toString()}
                            onChange={(e) => setSelectedAddressId(e.target.value)}
                          />
                          <div className="address-details">
                            <div className="address-line">{address.address}</div>
                            <div className="address-line">
                              {address.city}, {address.zip_code}
                            </div>
                            <div className="address-line">{address.country}</div>
                          </div>
                        </label>
                      </div>
                    ))}
                    <button 
                      className="add-address-btn secondary"
                      onClick={() => setShowAddressModal(true)}
                    >
                      Add New Address
                    </button>
                  </div>
                )}
              </div>

              <div className="summary-row">
                <span>Subtotal ({cartItems.length} items):</span>
                <span>${getTotalPrice()}</span>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <span>Free</span>
              </div>
              <div className="summary-row">
                <span>Tax:</span>
                <span>Calculated at checkout</span>
              </div>
              <hr />
              <div className="summary-row total">
                <span><strong>Total:</strong></span>
                <span><strong>${getTotalPrice()}</strong></span>
              </div>
              
              <button 
                className="checkout-btn"
                onClick={handleCheckout}
                disabled={cartItems.length === 0 || !selectedAddressId}
              >
                Proceed to Checkout
              </button>
              
              <button 
                className="clear-cart-btn"
                onClick={clearCart}
                disabled={cartItems.length === 0}
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Add New Address</h3>
            <form onSubmit={handleAddressSubmit}>
              <div className="form-group">
                <label htmlFor="address">Street Address:</label>
                <input
                  type="text"
                  id="address"
                  value={addressFormData.address}
                  onChange={(e) => setAddressFormData({...addressFormData, address: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="city">City:</label>
                <input
                  type="text"
                  id="city"
                  value={addressFormData.city}
                  onChange={(e) => setAddressFormData({...addressFormData, city: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="zipCode">ZIP Code:</label>
                <input
                  type="text"
                  id="zipCode"
                  value={addressFormData.zipCode}
                  onChange={(e) => setAddressFormData({...addressFormData, zipCode: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="country">Country:</label>
                <input
                  type="text"
                  id="country"
                  value={addressFormData.country}
                  onChange={(e) => setAddressFormData({...addressFormData, country: e.target.value})}
                  required
                />
              </div>
              
              <div className="modal-actions">
                <button type="submit" className="submit-btn">Add Address</button>
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setShowAddressModal(false);
                    setAddressFormData({ address: '', city: '', zipCode: '', country: '' });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

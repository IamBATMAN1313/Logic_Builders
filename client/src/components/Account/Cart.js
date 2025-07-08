import React, { useState, useEffect } from 'react';
import api from '../../api';
import '../css/Cart.css';

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCartItems();
  }, []);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cart');
      setCartItems(response.data);
    } catch (err) {
      setError('Failed to fetch cart items');
      console.error('Cart fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    try {
      await api.put(`/cart/${itemId}`, { quantity: newQuantity });
      setCartItems(items => 
        items.map(item => 
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (err) {
      console.error('Update quantity error:', err);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/cart/${itemId}`);
      setCartItems(items => items.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Remove item error:', err);
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
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
            <button className="browse-products-btn">Browse Products</button>
          </div>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items">
            {cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="item-image">
                  <img 
                    src={item.image_url || '/placeholder-product.jpg'} 
                    alt={item.name}
                  />
                </div>
                
                <div className="item-details">
                  <h3>{item.name}</h3>
                  <p className="item-specs">
                    {item.specs && Object.entries(item.specs).slice(0, 2).map(([key, value]) => (
                      <span key={key}>{key}: {value}</span>
                    )).join(' • ')}
                  </p>
                  <p className="item-price">${item.price}</p>
                </div>

                <div className="item-actions">
                  <div className="quantity-controls">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="quantity">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                  
                  <div className="item-total">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                  
                  <button 
                    className="remove-btn"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <div className="summary-card">
              <h3>Order Summary</h3>
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
              
              <button className="checkout-btn">
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

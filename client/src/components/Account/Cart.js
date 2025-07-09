import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import '../css/Cart.css';

export default function Cart() {
  const navigate = useNavigate();
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
      setCartItems(response.data.items || []);
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
      await api.put(`/cart/item/${itemId}`, { quantity: newQuantity });
      setCartItems(items => 
        items.map(item => 
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (err) {
      console.error('Update quantity error:', err);
      alert('Failed to update quantity. Please try again.');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/cart/item/${itemId}`);
      setCartItems(items => items.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Remove item error:', err);
      alert('Failed to remove item. Please try again.');
    }
  };

  const clearCart = async () => {
    try {
      await api.delete('/cart/clear');
      setCartItems([]);
    } catch (err) {
      console.error('Clear cart error:', err);
      alert('Failed to clear cart. Please try again.');
    }
  };

  const handleCheckout = async () => {
    try {
      // Create order from cart items
      const response = await api.post('/orders/from-cart');
      alert('Order placed successfully!');
      setCartItems([]); // Clear cart after successful order
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to place order. Please try again.');
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
                    <img 
                      src={itemImage} 
                      alt={itemName}
                      onError={(e) => {
                        e.target.src = '/placeholder-product.jpg';
                      }}
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
                disabled={cartItems.length === 0}
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
    </div>
  );
}

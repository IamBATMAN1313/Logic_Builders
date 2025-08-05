import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import ProductImage from '../ReUse/ProductImage';
import '../css/CartDropdown.css';

export default function CartDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [cartTotal, setCartTotal] = useState('0.00');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch cart items when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchCartItems();
    }
  }, [isOpen]);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cart');
      setCartItems(response.data.items || []);
      setCartTotal(response.data.total || '0.00');
    } catch (err) {
      console.error('Cart fetch error:', err);
      setCartItems([]);
      setCartTotal('0.00');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    try {
      await api.put(`/cart/item/${itemId}`, { quantity: newQuantity });
      // Update local state
      setCartItems(items => 
        items.map(item => 
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
      // Recalculate total
      const updatedItems = cartItems.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );
      const newTotal = updatedItems.reduce((total, item) => {
        const itemPrice = parseFloat(item.unit_price) || 0;
        return total + (itemPrice * item.quantity);
      }, 0).toFixed(2);
      setCartTotal(newTotal);
    } catch (err) {
      console.error('Update quantity error:', err);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/cart/item/${itemId}`);
      setCartItems(items => items.filter(item => item.id !== itemId));
      // Recalculate total
      const updatedItems = cartItems.filter(item => item.id !== itemId);
      const newTotal = updatedItems.reduce((total, item) => {
        const itemPrice = parseFloat(item.unit_price) || 0;
        return total + (itemPrice * item.quantity);
      }, 0).toFixed(2);
      setCartTotal(newTotal);
    } catch (err) {
      console.error('Remove item error:', err);
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const getCartItemCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <div className="cart-dropdown" ref={dropdownRef}>
      <button 
        className="cart-button" 
        onClick={toggleDropdown}
        aria-expanded={isOpen}
      >
        <span className="cart-icon">🛒</span>
        {cartItems.length > 0 && (
          <span className="cart-count">{getCartItemCount()}</span>
        )}
      </button>

      {isOpen && (
        <div className="cart-dropdown-menu">
          <div className="cart-dropdown-header">
            <h3>Shopping Cart</h3>
            <span className="cart-item-count">
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="cart-dropdown-content">
            {loading ? (
              <div className="cart-loading">Loading...</div>
            ) : cartItems.length === 0 ? (
              <div className="cart-empty">
                <span className="empty-icon">🛒</span>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="cart-items-list">
                  {cartItems.slice(0, 3).map((item) => { // Show only first 3 items
                    const itemName = item.product_name || item.build_name || 'Unknown Item';
                    const itemPrice = parseFloat(item.unit_price) || 0;
                    const itemImage = item.product_image || item.image_url || '/placeholder-product.jpg';
                    
                    return (
                      <div key={item.id} className="cart-dropdown-item">
                        <div className="item-image">
                          <ProductImage
                            src={itemImage} 
                            alt={itemName}
                            size="thumbnail"
                          />
                        </div>
                        
                        <div className="item-info">
                          <h4>{itemName}</h4>
                          <div className="item-controls">
                            <div className="quantity-controls">
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="qty-btn"
                              >
                                -
                              </button>
                              <span className="quantity">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="qty-btn"
                              >
                                +
                              </button>
                            </div>
                            <button 
                              className="remove-btn"
                              onClick={() => removeItem(item.id)}
                              title="Remove item"
                            >
                              ×
                            </button>
                          </div>
                          <div className="item-price">
                            ${(itemPrice * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {cartItems.length > 3 && (
                    <div className="more-items">
                      And {cartItems.length - 3} more item{cartItems.length - 3 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                <div className="cart-dropdown-footer">
                  <div className="cart-total">
                    <strong>Total: ${cartTotal}</strong>
                  </div>
                  
                  <div className="cart-actions">
                    <Link 
                      to="/account/cart" 
                      className="view-cart-btn"
                      onClick={closeDropdown}
                    >
                      View Cart
                    </Link>
                    <Link 
                      to="/account/cart" 
                      className="checkout-btn"
                      onClick={closeDropdown}
                    >
                      Checkout
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

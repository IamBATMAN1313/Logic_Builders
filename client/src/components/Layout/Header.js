import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import SearchBar from '../ReUse/SearchBar';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import NotificationBadge from '../ReUse/NotificationBadge';
import '../css/Header.css';

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>LogicBuilders</h1>
        </Link>
        
        {/* Only show search bar if not on auth pages */}
        {!isAuthPage && (
          <div className="search-section">
            <SearchBar />
          </div>
        )}
        
        <nav className="nav-links">
          <ThemeToggle />
          {user ? (
            <div className="user-section">
              {/* Notifications beside username */}
              <Link to="/account/notifications" className="notifications-link">
                <span className="notification-icon">🔔</span>
                <NotificationBadge />
              </Link>
              
              <div className="user-menu" ref={dropdownRef}>
                <button 
                  className="user-button" 
                  onClick={toggleDropdown}
                  aria-expanded={isDropdownOpen}
                >
                  {user.username}
                  <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
                </button>
              
                {isDropdownOpen && (
                  <div className="user-dropdown">
                    <div className="dropdown-header">
                      <span className="user-name">{user.username}</span>
                      <span className="user-email">{user.email}</span>
                    </div>
                    
                    <div className="dropdown-links">
                      <Link to="/account/orders" onClick={closeDropdown}>
                        <span className="icon">📦</span>
                        Your Orders
                      </Link>
                      <Link to="/account/cart" onClick={closeDropdown}>
                        <span className="icon">🛒</span>
                        Cart
                      </Link>
                      <Link to="/account/builds" onClick={closeDropdown}>
                        <span className="icon">🖥️</span>
                        PC Builds
                      </Link>
                      <Link to="/account/reviews" onClick={closeDropdown}>
                        <span className="icon">⭐</span>
                        Your Reviews
                      </Link>
                      <Link to="/account/messaging" onClick={closeDropdown}>
                        <span className="icon">💬</span>
                        Messages & Support
                      </Link>
                      <Link to="/account/vouchers" onClick={closeDropdown}>
                        <span className="icon">🎫</span>
                        Vouchers & Points
                      </Link>
                      <Link to="/account/settings" onClick={closeDropdown}>
                        <span className="icon">⚙️</span>
                        Settings
                      </Link>
                    </div>
                    
                    <div className="dropdown-footer">
                      <button onClick={() => { logout(); closeDropdown(); }} className="logout-btn">
                        <span className="icon">🚪</span>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Only show login/signup buttons if not on auth pages */
            !isAuthPage && (
              <div className="auth-links">
                <Link to="/login" className="login-btn">Login</Link>
                <Link to="/signup" className="signup-btn">Sign Up</Link>
              </div>
            )
          )}
        </nav>
      </div>
    </header>
  );
}


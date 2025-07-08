import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import SearchBar from '../ReUse/SearchBar';

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  
  // Check if current page is login or signup
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

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
          {user ? (
            <div className="user-menu">
              <span>Welcome, {user.username}</span>
              <button onClick={logout} className="logout-btn">
                Logout
              </button>
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
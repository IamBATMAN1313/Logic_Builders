import React, { useContext } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import '../css/Account.css';

export default function AccountLayout() {
  const { user } = useContext(AuthContext);

  if (!user) {
    return (
      <div className="account-page">
        <div className="account-error">
          <h2>Access Denied</h2>
          <p>Please log in to access your account.</p>
        </div>
      </div>
    );
  }

  const accountLinks = [
    { path: '/account/orders', label: 'Your Orders', icon: '📦' },
    { path: '/account/cart', label: 'Cart', icon: '🛒' },
    { path: '/account/builds', label: 'PC Builds', icon: '🖥️' },
    { path: '/account/reviews', label: 'Your Reviews', icon: '⭐' },
    { path: '/account/messaging', label: 'Messages & Support', icon: '💬' },
    { path: '/account/notifications', label: 'Notifications', icon: '🔔' },
    { path: '/account/vouchers', label: 'Vouchers & Points', icon: '🎫' },
    { path: '/account/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="account-page">
      <div className="account-container">
        <div className="account-header">
          <div className="user-info">
            <div className="user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <h1>Welcome back, {user.username}</h1>
              <p>{user.email}</p>
            </div>
          </div>
        </div>

        <div className="account-content">
          <nav className="account-sidebar">
            <ul className="account-nav">
              {accountLinks.map((link) => (
                <li key={link.path}>
                  <NavLink 
                    to={link.path} 
                    className={({ isActive }) => `account-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon">{link.icon}</span>
                    <span className="nav-label">{link.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <main className="account-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

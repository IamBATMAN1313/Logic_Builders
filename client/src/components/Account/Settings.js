import React, { useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api';
import '../css/Settings.css';

export default function Settings() {
  const { user, updateUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Profile form state
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Address form state
  const [addressData, setAddressData] = useState({
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    zipCode: user?.address?.zipCode || '',
    country: user?.address?.country || 'United States'
  });

  // Preferences state
  const [preferences, setPreferences] = useState({
    emailNotifications: user?.preferences?.emailNotifications ?? true,
    smsNotifications: user?.preferences?.smsNotifications ?? false,
    marketingEmails: user?.preferences?.marketingEmails ?? true,
    orderUpdates: user?.preferences?.orderUpdates ?? true
  });

  const updateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await api.put('/user/profile', profileData);
      updateUser(response.data);
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessage('Failed to update profile');
      console.error('Profile update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await api.put('/user/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setMessage('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setMessage('Failed to update password');
      console.error('Password update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateAddress = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await api.put('/user/address', addressData);
      setMessage('Address updated successfully!');
    } catch (err) {
      setMessage('Failed to update address');
      console.error('Address update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await api.put('/user/preferences', preferences);
      setMessage('Preferences updated successfully!');
    } catch (err) {
      setMessage('Failed to update preferences');
      console.error('Preferences update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'password', label: 'Password', icon: '🔒' },
    { id: 'address', label: 'Address', icon: '📍' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' }
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Account Settings</h2>
        <p>Manage your account information and preferences</p>
      </div>

      <div className="settings-content">
        <div className="settings-sidebar">
          <ul className="settings-tabs">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="settings-main">
          {message && (
            <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="tab-content">
              <h3>Profile Information</h3>
              <form onSubmit={updateProfile} className="settings-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                  />
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="tab-content">
              <h3>Change Password</h3>
              <form onSubmit={updatePassword} className="settings-form">
                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    required
                    minLength="6"
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    required
                  />
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'address' && (
            <div className="tab-content">
              <h3>Shipping Address</h3>
              <form onSubmit={updateAddress} className="settings-form">
                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={addressData.street}
                    onChange={(e) => setAddressData({...addressData, street: e.target.value})}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={addressData.city}
                      onChange={(e) => setAddressData({...addressData, city: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      value={addressData.state}
                      onChange={(e) => setAddressData({...addressData, state: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>ZIP Code</label>
                    <input
                      type="text"
                      value={addressData.zipCode}
                      onChange={(e) => setAddressData({...addressData, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <select
                      value={addressData.country}
                      onChange={(e) => setAddressData({...addressData, country: e.target.value})}
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Address'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="tab-content">
              <h3>Notification Preferences</h3>
              <form onSubmit={updatePreferences} className="settings-form">
                <div className="preferences-group">
                  <h4>Email Notifications</h4>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.emailNotifications}
                        onChange={(e) => setPreferences({...preferences, emailNotifications: e.target.checked})}
                      />
                      <span className="checkbox-custom"></span>
                      General email notifications
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.orderUpdates}
                        onChange={(e) => setPreferences({...preferences, orderUpdates: e.target.checked})}
                      />
                      <span className="checkbox-custom"></span>
                      Order status updates
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.marketingEmails}
                        onChange={(e) => setPreferences({...preferences, marketingEmails: e.target.checked})}
                      />
                      <span className="checkbox-custom"></span>
                      Marketing emails and promotions
                    </label>
                  </div>
                </div>

                <div className="preferences-group">
                  <h4>SMS Notifications</h4>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.smsNotifications}
                        onChange={(e) => setPreferences({...preferences, smsNotifications: e.target.checked})}
                      />
                      <span className="checkbox-custom"></span>
                      SMS order updates
                    </label>
                  </div>
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../api';
import '../css/Settings.css';
import '../css/SpecsFilter.css'; // Import for spec-select class

export default function Settings() {
  const { user, updateUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Profile form state
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    gender: ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressFormData, setAddressFormData] = useState({
    address: '',
    city: '',
    zipCode: '',
    country: 'Bangladesh'
  });

  // Countries list
  const countries = [
    'Bangladesh', 'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 
    'France', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland',
    'Japan', 'South Korea', 'Singapore', 'Switzerland', 'Austria', 'Belgium', 'Ireland',
    'New Zealand', 'China', 'India', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'Thailand',
    'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'Russia', 'Poland', 'Czech Republic'
  ];

  // Load profile data on component mount
  useEffect(() => {
    fetchProfile();
    if (activeTab === 'address') {
      fetchAddresses();
    }
  }, [activeTab]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/user/profile');
      const profile = response.data;
      setProfileData({
        username: profile.username || '',
        email: profile.email || '',
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        gender: profile.gender || ''
      });
    } catch (err) {
      console.error('Fetch profile error:', err);
      setMessage('Failed to load profile data');
    }
  };

  const fetchAddresses = async () => {
    try {
      const response = await api.get('/user/addresses');
      setAddresses(response.data);
    } catch (err) {
      console.error('Fetch addresses error:', err);
      setMessage('Failed to load addresses');
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await api.put('/user/profile', {
        email: profileData.email,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        gender: profileData.gender
      });
      
      // Update the local profile data with response
      setProfileData(prev => ({
        ...prev,
        ...response.data
      }));
      
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update profile');
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
      setMessage(err.response?.data?.error || 'Failed to update password');
      console.error('Password update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    
    if (!addressFormData.address || !addressFormData.city || !addressFormData.zipCode || !addressFormData.country) {
      setMessage('All address fields are required');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (editingAddress) {
        // Update existing address
        const response = await api.put(`/user/addresses/${editingAddress.id}`, addressFormData);
        setAddresses(addresses.map(addr => 
          addr.id === editingAddress.id ? response.data : addr
        ));
        setMessage('Address updated successfully!');
      } else {
        // Add new address
        const response = await api.post('/user/addresses', addressFormData);
        setAddresses([...addresses, response.data]);
        setMessage('Address added successfully!');
      }
      
      // Reset form
      setAddressFormData({ address: '', city: '', zipCode: '', country: 'Bangladesh' });
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save address');
      console.error('Address save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await api.delete(`/user/addresses/${addressId}`);
      setAddresses(addresses.filter(addr => addr.id !== addressId));
      setMessage('Address deleted successfully!');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete address');
      console.error('Delete address error:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditAddress = (address) => {
    setEditingAddress(address);
    setAddressFormData({
      address: address.address,
      city: address.city,
      zipCode: address.zip_code,
      country: address.country
    });
    setShowAddressForm(true);
  };

  const cancelAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    setAddressFormData({ address: '', city: '', zipCode: '', country: 'Bangladesh' });
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'password', label: 'Password', icon: '🔒' },
    { id: 'address', label: 'Addresses', icon: '📍' }
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
                      disabled
                      className="disabled-input"
                      title="Username cannot be changed"
                    />
                    <small className="form-hint">Username cannot be changed</small>
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

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      className="spec-select"
                      value={profileData.gender}
                      onChange={(e) => setProfileData({...profileData, gender: e.target.value})}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
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
              <div className="address-header">
                <h3>Shipping Addresses</h3>
                <button 
                  className="add-address-btn"
                  onClick={() => setShowAddressForm(true)}
                  disabled={loading}
                >
                  + Add New Address
                </button>
              </div>

              {showAddressForm && (
                <div className="address-form-container">
                  <h4>{editingAddress ? 'Edit Address' : 'Add New Address'}</h4>
                  <form onSubmit={handleAddressSubmit} className="settings-form">
                    <div className="form-group">
                      <label>Street Address</label>
                      <input
                        type="text"
                        value={addressFormData.address}
                        onChange={(e) => setAddressFormData({...addressFormData, address: e.target.value})}
                        required
                        placeholder="Enter your street address"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>City</label>
                        <input
                          type="text"
                          value={addressFormData.city}
                          onChange={(e) => setAddressFormData({...addressFormData, city: e.target.value})}
                          required
                          placeholder="Enter city"
                        />
                      </div>
                      <div className="form-group">
                        <label>ZIP Code</label>
                        <input
                          type="text"
                          value={addressFormData.zipCode}
                          onChange={(e) => setAddressFormData({...addressFormData, zipCode: e.target.value})}
                          required
                          placeholder="Enter ZIP code"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Country</label>
                      <select
                        className="spec-select"
                        value={addressFormData.country}
                        onChange={(e) => setAddressFormData({...addressFormData, country: e.target.value})}
                        required
                      >
                        {countries.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="save-btn" disabled={loading}>
                        {loading ? 'Saving...' : (editingAddress ? 'Update Address' : 'Add Address')}
                      </button>
                      <button 
                        type="button" 
                        className="cancel-btn" 
                        onClick={cancelAddressForm}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="addresses-list">
                {addresses.length === 0 ? (
                  <div className="no-addresses">
                    <p>No addresses saved yet.</p>
                    <p>Add your first shipping address to make checkout faster.</p>
                  </div>
                ) : (
                  addresses.map((address) => (
                    <div key={address.id} className="address-card">
                      <div className="address-content">
                        <div className="address-text">
                          <strong>{address.address}</strong><br />
                          {address.city}, {address.zip_code}<br />
                          {address.country}
                        </div>
                        <div className="address-actions">
                          <button 
                            className="edit-btn"
                            onClick={() => startEditAddress(address)}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => deleteAddress(address.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

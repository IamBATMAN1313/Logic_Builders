import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNotification } from '../contexts/NotificationContext';

const Settings = () => {
  const { admin, hasPermission, updateAdminProfile } = useAdminAuth();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    department: '',
    position: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    setProfileData({
      name: admin.name || '',
      phone: admin.phone || '',
      department: admin.department || '',
      position: admin.position || ''
    });

    if (hasPermission('GENERAL_MANAGER')) {
      fetchAdmins();
    }
  }, [admin]);

  const fetchAdmins = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/admins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.filter(a => a.admin_id !== admin.admin_id));
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const updatedAdmin = await response.json();
        if (updateAdminProfile) {
          updateAdminProfile(updatedAdmin);
        }
        showSuccess('Profile updated successfully!');
      } else {
        showError('Failed to update profile');
      }
    } catch (error) {
      showError('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        showSuccess('Password changed successfully!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const error = await response.json();
        showError(error.message || 'Failed to change password');
      }
    } catch (error) {
      showError('Error changing password');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminId, adminName) => {
    const confirmed = await showConfirm(`Are you sure you want to remove access for ${adminName}?`);
    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/admins/${adminId}/remove`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        showSuccess(`Successfully removed access for ${adminName}`);
        fetchAdmins(); // Refresh the list
      } else {
        showError('Failed to remove admin access');
      }
    } catch (error) {
      showError('Error removing admin access');
    }
  };

  if (!hasPermission('SETTINGS')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access settings.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Settings</h2>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Profile Settings */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>Profile Information</h3>
          <p style={{ color: '#7f8c8d', marginBottom: '1rem' }}>
            Update your personal information. Note: Employee ID cannot be changed.
          </p>
          
          <form onSubmit={handleProfileUpdate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Employee ID
                </label>
                <input 
                  type="text" 
                  value={admin.employee_id} 
                  disabled
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    border: '1px solid #ddd', 
                    borderRadius: '5px',
                    backgroundColor: '#f8f9fa',
                    color: '#6c757d'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Full Name
                </label>
                <input 
                  type="text" 
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '5px' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Department
                </label>
                <input 
                  type="text" 
                  value={profileData.department}
                  onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '5px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Position
                </label>
                <input 
                  type="text" 
                  value={profileData.position}
                  onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '5px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Phone Number
              </label>
              <input 
                type="tel" 
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '5px' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </div>

        {/* Password Change */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>Change Password</h3>
          <p style={{ color: '#7f8c8d', marginBottom: '1rem' }}>
            Update your password to keep your account secure.
          </p>

          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Current Password
              </label>
              <input 
                type="password" 
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '5px' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  New Password
                </label>
                <input 
                  type="password" 
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '5px' }}
                  minLength="6"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Confirm New Password
                </label>
                <input 
                  type="password" 
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '5px' }}
                  minLength="6"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Admin Management (Only for General Manager) */}
        {hasPermission('GENERAL_MANAGER') && (
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3>Admin Management</h3>
            <p style={{ color: '#7f8c8d', marginBottom: '1rem' }}>
              Remove access for other administrators. Use with caution.
            </p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {admins.map(adminUser => (
                <div key={adminUser.admin_id} style={{ 
                  padding: '1rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{adminUser.name}</div>
                    <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                      {adminUser.employee_id} • {adminUser.clearance_name || 'Admin'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveAdmin(adminUser.admin_id, adminUser.name)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Remove Access
                  </button>
                </div>
              ))}
              {admins.length === 0 && (
                <p style={{ color: '#7f8c8d', textAlign: 'center', padding: '2rem' }}>
                  No other administrators found.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;

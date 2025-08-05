import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNotification } from '../contexts/NotificationContext';

const AdminManagement = () => {
  const { hasPermission } = useAdminAuth();
  const { showSuccess, showError, showWarning } = useNotification();
  const [activeTab, setActiveTab] = useState('requests');
  const [signupRequests, setSignupRequests] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalAdmins: 0,
    totalUsers: 0,
    pendingRequests: 0,
    recentActivity: 0,
    clearanceDistribution: [],
    userGrowth: []
  });
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showAdminLogsModal, setShowAdminLogsModal] = useState(false);
  const [adminSpecificLogs, setAdminSpecificLogs] = useState([]);
  const [showEditClearanceModal, setShowEditClearanceModal] = useState(false);
  const [newClearanceLevel, setNewClearanceLevel] = useState('');
  const [availableAccessLevels, setAvailableAccessLevels] = useState([]);

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchSignupRequests();
    } else if (activeTab === 'admins') {
      fetchAdmins();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'logs') {
      fetchLogs();
    }
    fetchAnalytics();
    fetchAccessLevels();
  }, [activeTab]);

  const fetchSignupRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/signup-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSignupRequests(data);
      }
    } catch (error) {
      console.error('Error fetching signup requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/admins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/analytics/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics({
          totalAdmins: admins.length,
          totalUsers: users.length,
          pendingRequests: signupRequests.filter(r => r.status === 'PENDING').length,
          recentActivity: logs.length,
          clearanceDistribution: data.clearanceDistribution || [],
          userGrowth: data.userGrowth || []
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchAdminLogs = async (adminId) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/logs?admin_id=${adminId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAdminSpecificLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching admin logs:', error);
    }
  };

  // Helper function to get access name by level
  const getAccessNameByLevel = (level) => {
    const accessLevel = availableAccessLevels.find(al => al.access_level === level);
    return accessLevel ? accessLevel.access_name : `Level ${level}`;
  };

  // Helper function to check if level is General Manager (level 0)
  const isGeneralManager = (level) => {
    return level === 0;
  };

  const fetchAccessLevels = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/access-levels', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableAccessLevels(data);
      }
    } catch (error) {
      console.error('Error fetching access levels:', error);
    }
  };

  const updateAdminClearance = async (adminId, newClearance) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          name: selectedAdmin.name, // Keep the current name
          clearance_level: newClearance 
        })
      });

      if (response.ok) {
        showSuccess('Clearance level updated successfully!');
        fetchAdmins();
        setShowEditClearanceModal(false);
        setSelectedAdmin(null);
      } else {
        const data = await response.json();
        showError('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error updating clearance:', error);
      showError('Network error occurred');
    }
  };

  const handleApproveRequest = async (requestId, assignedClearance) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/signup-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'approve',
          assigned_clearance: assignedClearance
        })
      });

      if (response.ok) {
        showSuccess('Admin request approved successfully!');
        fetchSignupRequests();
        setSelectedRequest(null);
      } else {
        const data = await response.json();
        showError('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      showError('Network error occurred');
    }
  };

  const handleRejectRequest = async (requestId, rejectionReason) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/signup-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: rejectionReason
        })
      });

      if (response.ok) {
        showSuccess('Admin request rejected successfully!');
        fetchSignupRequests();
        setSelectedRequest(null);
      } else {
        const data = await response.json();
        showError('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      showError('Network error occurred');
    }
  };

  // Request Review Form Component
  const RequestReviewForm = ({ request, onApprove, onReject, onCancel, availableAccessLevels }) => {
    const [action, setAction] = useState('');
    const [assignedClearance, setAssignedClearance] = useState(request.requested_clearance);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (action === 'approve') {
        onApprove(request.request_id, assignedClearance);
      } else if (action === 'reject') {
        if (!rejectionReason.trim()) {
          showWarning('Please provide a reason for rejection');
          return;
        }
        onReject(request.request_id, rejectionReason);
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Decision:
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                name="action"
                value="approve"
                checked={action === 'approve'}
                onChange={(e) => setAction(e.target.value)}
              />
              <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>✓ Approve</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                name="action"
                value="reject"
                checked={action === 'reject'}
                onChange={(e) => setAction(e.target.value)}
              />
              <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>✗ Reject</span>
            </label>
          </div>
        </div>

        {action === 'approve' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Assign Clearance Level:
            </label>
            <select
              value={assignedClearance}
              onChange={(e) => setAssignedClearance(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '1rem'
              }}
            >
              {availableAccessLevels.map(accessLevel => (
                <option key={accessLevel.access_level} value={accessLevel.access_level}>
                  {accessLevel.access_name}
                </option>
              ))}
            </select>
            <small style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>
              You can assign a different clearance level than requested
            </small>
          </div>
        )}

        {action === 'reject' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Reason for Rejection:
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this request is being rejected..."
              required
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '1rem',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.75rem 1.5rem',
              border: '1px solid #ddd',
              background: 'white',
              color: '#7f8c8d',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!action}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: action === 'approve' ? '#2ecc71' : action === 'reject' ? '#e74c3c' : '#95a5a6',
              color: 'white',
              borderRadius: '5px',
              cursor: action ? 'pointer' : 'not-allowed',
              opacity: action ? 1 : 0.6
            }}
          >
            {action === 'approve' ? 'Approve Request' : action === 'reject' ? 'Reject Request' : 'Select Action'}
          </button>
        </div>
      </form>
    );
  };

  if (!hasPermission('GENERAL_MANAGER')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access admin management.</p>
        <p>Required clearance: GENERAL_MANAGER</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Admin Management</h2>
      <p>Manage admin users, assign clearance levels, and control system access.</p>
      
      {/* Analytics Dashboard */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>System Overview</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #3498db'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#7f8c8d' }}>Total Admins</h4>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
              {admins.length}
            </p>
          </div>
          
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #2ecc71'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#7f8c8d' }}>Total Users</h4>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#2ecc71' }}>
              {users.length}
            </p>
          </div>
          
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #f39c12'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#7f8c8d' }}>Pending Requests</h4>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>
              {signupRequests.filter(r => r.status === 'PENDING').length}
            </p>
          </div>
          
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #9b59b6'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#7f8c8d' }}>Recent Activities</h4>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#9b59b6' }}>
              {logs.length}
            </p>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', borderBottom: '2px solid #ecf0f1' }}>
          {[
            { key: 'requests', label: 'Signup Requests', icon: '📋' },
            { key: 'admins', label: 'Active Admins', icon: '👥' },
            { key: 'users', label: 'All Users', icon: '👤' },
            { key: 'logs', label: 'Admin Logs', icon: '📊' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '1rem 2rem',
                border: 'none',
                background: activeTab === tab.key ? '#3498db' : 'transparent',
                color: activeTab === tab.key ? 'white' : '#7f8c8d',
                cursor: 'pointer',
                borderRadius: '5px 5px 0 0',
                marginRight: '0.5rem',
                fontWeight: activeTab === tab.key ? 'bold' : 'normal'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#7f8c8d' }}>Loading...</div>
        </div>
      )}

      {/* Signup Requests Tab */}
      {activeTab === 'requests' && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3>Admin Signup Requests</h3>
            <div style={{ color: '#7f8c8d' }}>
              {signupRequests.filter(r => r.status === 'PENDING').length} pending requests
            </div>
          </div>

          {signupRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#7f8c8d' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <h3>No signup requests</h3>
              <p>All admin requests have been processed.</p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Requested Role</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signupRequests.map(request => (
                    <tr key={request.request_id}>
                      <td><strong>{request.employee_id}</strong></td>
                      <td>{request.name}</td>
                      <td>{request.department}</td>
                      <td>
                        <span className="clearance-badge" style={{ 
                          background: isGeneralManager(request.requested_clearance) ? '#e74c3c' : '#3498db',
                          fontSize: '0.75rem'
                        }}>
                          {getAccessNameByLevel(request.requested_clearance)}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          color: request.status === 'PENDING' ? '#f39c12' : 
                                request.status === 'APPROVED' ? '#2ecc71' : '#e74c3c',
                          fontWeight: 'bold'
                        }}>
                          {request.status}
                        </span>
                      </td>
                      <td>{new Date(request.created_at).toLocaleDateString()}</td>
                      <td>
                        {request.status === 'PENDING' ? (
                          <button
                            onClick={() => setSelectedRequest(request)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              border: 'none',
                              background: '#3498db',
                              color: 'white',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                          >
                            Review
                          </button>
                        ) : (
                          <span style={{ color: '#95a5a6' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Active Admins Tab */}
      {activeTab === 'admins' && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3>Active Admin Users</h3>
            <div style={{ color: '#7f8c8d' }}>
              {admins.length} total admins
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Clearance Level</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(admin => (
                  <tr key={admin.admin_id}>
                    <td><strong>{admin.employee_id}</strong></td>
                    <td>{admin.name}</td>
                    <td>
                      <span className="clearance-badge" style={{ 
                        background: isGeneralManager(admin.clearance_level) ? '#e74c3c' : '#3498db'
                      }}>
                        {getAccessNameByLevel(admin.clearance_level)}
                      </span>
                    </td>
                    <td>{new Date(admin.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => {
                            setSelectedAdmin(admin);
                            fetchAdminLogs(admin.admin_id);
                            setShowAdminLogsModal(true);
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            border: 'none',
                            background: '#3498db',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          View Logs
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setNewClearanceLevel(admin.clearance_level);
                            setShowEditClearanceModal(true);
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            border: 'none',
                            background: '#f39c12',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          Edit Clearance
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Users Tab */}
      {activeTab === 'users' && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3>All System Users</h3>
            <div style={{ color: '#7f8c8d' }}>
              {users.length} total users
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.user_id}>
                    <td><strong>{user.username}</strong></td>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: user.user_type === 'Customer' ? '#2ecc71' : '#95a5a6',
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '0.8rem'
                      }}>
                        {user.user_type}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Logs Tab */}
      {activeTab === 'logs' && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3>Admin Activity Logs</h3>
            <div style={{ color: '#7f8c8d' }}>
              {logs.length} recent activities
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>IP Address</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.log_id}>
                    <td>
                      <div>
                        <strong>{log.admin_name}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
                          {log.employee_id}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: log.action.includes('APPROVE') ? '#2ecc71' : 
                                   log.action.includes('REJECT') ? '#e74c3c' : '#3498db',
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '0.8rem'
                      }}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {log.target_type && (
                        <div>
                          <div style={{ fontSize: '0.9rem' }}>{log.target_type}</div>
                          {log.target_id && (
                            <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
                              ID: {log.target_id}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                      {log.ip_address}
                    </td>
                    <td style={{ fontSize: '0.9rem' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Review Modal */}
      {selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '10px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Review Admin Request</h3>
            
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <strong>Employee ID:</strong> {selectedRequest.employee_id}
                </div>
                <div>
                  <strong>Name:</strong> {selectedRequest.name}
                </div>
                <div>
                  <strong>Email:</strong> {selectedRequest.email}
                </div>
                <div>
                  <strong>Phone:</strong> {selectedRequest.phone}
                </div>
                <div>
                  <strong>Department:</strong> {selectedRequest.department}
                </div>
                <div>
                  <strong>Position:</strong> {selectedRequest.position}
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <strong>Requested Clearance:</strong>
                <span className="clearance-badge" style={{ marginLeft: '0.5rem' }}>
                  {getAccessNameByLevel(selectedRequest.requested_clearance)}
                </span>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <strong>Reason for Access:</strong>
                <div style={{ 
                  marginTop: '0.5rem', 
                  padding: '1rem', 
                  background: '#f8f9fa', 
                  borderRadius: '5px',
                  border: '1px solid #e9ecef'
                }}>
                  {selectedRequest.reason_for_access}
                </div>
              </div>
            </div>

            <RequestReviewForm
              request={selectedRequest}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
              onCancel={() => setSelectedRequest(null)}
              availableAccessLevels={availableAccessLevels}
            />
          </div>
        </div>
      )}

      {/* Admin Logs Modal */}
      {showAdminLogsModal && selectedAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '10px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Activity Logs - {selectedAdmin.name}</h3>
              <button 
                onClick={() => {
                  setShowAdminLogsModal(false);
                  setSelectedAdmin(null);
                  setAdminSpecificLogs([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <strong>Employee ID:</strong> {selectedAdmin.employee_id} | 
              <strong style={{ marginLeft: '1rem' }}>Clearance:</strong> {getAccessNameByLevel(selectedAdmin.clearance_level)}
            </div>

            {adminSpecificLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
                No activity logs found for this admin.
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '5px', border: '1px solid #ddd' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Target</th>
                      <th>IP Address</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminSpecificLogs.map(log => (
                      <tr key={log.log_id}>
                        <td>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            background: log.action.includes('APPROVE') ? '#2ecc71' : 
                                       log.action.includes('REJECT') ? '#e74c3c' : '#3498db',
                            color: 'white',
                            borderRadius: '3px',
                            fontSize: '0.8rem'
                          }}>
                            {log.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {log.target_type && (
                            <div>
                              <div>{log.target_type}</div>
                              {log.target_id && (
                                <div style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
                                  ID: {log.target_id}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                          {log.ip_address}
                        </td>
                        <td style={{ fontSize: '0.9rem' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Clearance Modal */}
      {showEditClearanceModal && selectedAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '10px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Edit Clearance Level</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div><strong>Admin:</strong> {selectedAdmin.name}</div>
              <div><strong>Employee ID:</strong> {selectedAdmin.employee_id}</div>
              <div><strong>Current Clearance:</strong> {getAccessNameByLevel(selectedAdmin.clearance_level)}</div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                New Clearance Level:
              </label>
              <select
                value={newClearanceLevel}
                onChange={(e) => setNewClearanceLevel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem'
                }}
              >
                {availableAccessLevels.map(accessLevel => (
                  <option key={accessLevel.access_level} value={accessLevel.access_level}>
                    {accessLevel.access_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditClearanceModal(false);
                  setSelectedAdmin(null);
                  setNewClearanceLevel('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #ddd',
                  background: 'white',
                  color: '#7f8c8d',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => updateAdminClearance(selectedAdmin.admin_id, newClearanceLevel)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: '#2ecc71',
                  color: 'white',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Update Clearance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const AdminManagement = () => {
  const { hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('requests');
  const [signupRequests, setSignupRequests] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const clearanceLevels = [
    'INVENTORY_MANAGER',
    'PRODUCT_EXPERT',
    'ORDER_MANAGER',
    'PROMO_MANAGER',
    'ANALYTICS',
    'GENERAL_MANAGER'
  ];

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
        alert('Admin request approved successfully!');
        fetchSignupRequests();
        setSelectedRequest(null);
      } else {
        const data = await response.json();
        alert('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Network error occurred');
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
        alert('Admin request rejected successfully!');
        fetchSignupRequests();
        setSelectedRequest(null);
      } else {
        const data = await response.json();
        alert('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Network error occurred');
    }
  };

  // Request Review Form Component
  const RequestReviewForm = ({ request, onApprove, onReject, onCancel, clearanceLevels }) => {
    const [action, setAction] = useState('');
    const [assignedClearance, setAssignedClearance] = useState(request.requested_clearance);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (action === 'approve') {
        onApprove(request.request_id, assignedClearance);
      } else if (action === 'reject') {
        if (!rejectionReason.trim()) {
          alert('Please provide a reason for rejection');
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
              {clearanceLevels.map(level => (
                <option key={level} value={level}>
                  {level.replace('_', ' ')}
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
                          background: request.requested_clearance === 'GENERAL_MANAGER' ? '#e74c3c' : '#3498db',
                          fontSize: '0.75rem'
                        }}>
                          {request.requested_clearance.replace('_', ' ')}
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
                              padding: '0.25rem 0.75rem',
                              border: 'none',
                              background: '#3498db',
                              color: 'white',
                              borderRadius: '3px',
                              cursor: 'pointer'
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
                        background: admin.clearance_level === 'GENERAL_MANAGER' ? '#e74c3c' : '#3498db'
                      }}>
                        {admin.clearance_level.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{new Date(admin.created_at).toLocaleDateString()}</td>
                    <td>
                      <button style={{
                        marginRight: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        border: 'none',
                        background: '#95a5a6',
                        color: 'white',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}>
                        View Logs
                      </button>
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
                  {selectedRequest.requested_clearance.replace('_', ' ')}
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
              clearanceLevels={clearanceLevels}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;

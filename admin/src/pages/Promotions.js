import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNotification } from '../contexts/NotificationContext';
import PromotionModal from '../components/PromotionModal';
import CouponGeneratorModal from '../components/CouponGeneratorModal';

const Promotions = () => {
  const { hasPermission } = useAdminAuth();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [promotions, setPromotions] = useState([]);
  const [analytics, setAnalytics] = useState({
    active_promotions: 0,
    total_coupons_used: 0,
    total_discount_given: 0,
    roi_percentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (hasPermission('PROMO_MANAGER')) {
      fetchPromotions();
      fetchAnalytics();
    }
  }, [hasPermission]);

  const fetchPromotions = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      
      const response = await fetch('http://localhost:54321/api/admin/promotions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPromotions(data);
        setError(''); // Clear any previous errors
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          setError('Access denied. You don\'t have permission to view promotions.');
        } else {
          setError(`Failed to fetch promotions. Status: ${response.status}`);
        }
      }
    } catch (err) {
      setError('Network error while fetching promotions');
      console.error('Error fetching promotions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:54321/api/admin/promotions/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const handleCreatePromotion = () => {
    setSelectedPromotion(null);
    setIsPromotionModalOpen(true);
  };

  const handleEditPromotion = (promotion) => {
    setSelectedPromotion(promotion);
    setIsPromotionModalOpen(true);
  };

  const handleSavePromotion = async (formData) => {
    try {
      const token = localStorage.getItem('adminToken');
      const url = selectedPromotion 
        ? `http://localhost:54321/api/admin/promotions/${selectedPromotion.id}`
        : 'http://localhost:54321/api/admin/promotions';
      
      const method = selectedPromotion ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchPromotions();
        await fetchAnalytics();
        setError('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save promotion');
      }
    } catch (err) {
      console.error('Error saving promotion:', err);
      throw err;
    }
  };

  const handleDeletePromotion = async (id) => {
    const confirmed = await showConfirm('Are you sure you want to delete this promotion?');
    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:54321/api/admin/promotions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchPromotions();
        await fetchAnalytics();
        setError('');
      } else {
        setError('Failed to delete promotion');
      }
    } catch (err) {
      setError('Network error while deleting promotion');
      console.error('Error deleting promotion:', err);
    }
  };

  const handleGenerateCoupons = async (formData) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:54321/api/admin/promotions/generate-coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        showSuccess(`Successfully generated ${result.coupons.length} coupon codes!`);
        await fetchPromotions();
        await fetchAnalytics();
        setError('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate coupons');
      }
    } catch (err) {
      console.error('Error generating coupons:', err);
      throw err;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return '#2ecc71';
      case 'Expired': return '#e74c3c';
      case 'Inactive': return '#95a5a6';
      default: return '#333';
    }
  };

  const getDiscountDisplay = (promotion) => {
    if (promotion.type === 'percentage') {
      return `${promotion.discount_value}%`;
    } else if (promotion.type === 'fixed_amount') {
      return `$${promotion.discount_value}`;
    } else {
      return 'Free Shipping';
    }
  };

  const getUsageDisplay = (promotion) => {
    if (promotion.max_uses) {
      return `${promotion.total_used || 0}/${promotion.max_uses}`;
    } else {
      return `${promotion.total_used || 0}/∞`;
    }
  };

  const filteredPromotions = promotions.filter(promotion => {
    const matchesSearch = promotion.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         promotion.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || promotion.status.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesFilter;
  });

  if (!hasPermission('PROMO_MANAGER')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access promotion management.</p>
        <p>Required clearance: PROMO_MANAGER</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="loading">Loading promotions...</div>;
  }

  return (
    <div>
      <h2>Promotion Management</h2>
      <p>Create and manage discounts, deals, coupons, and marketing campaigns.</p>
      
      {error && <div className="error-message">{error}</div>}

      {/* Analytics Dashboard */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Promotion Overview</h3>
        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Active Promotions</h3>
            <p>{analytics.active_promotions}</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
            <h3>Total Coupons Used</h3>
            <p>{analytics.total_coupons_used}</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
            <h3>Discount Given</h3>
            <p>${parseFloat(analytics.total_discount_given || 0).toFixed(2)}</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#9b59b6' }}>
            <h3>Campaign ROI</h3>
            <p>{analytics.roi_percentage}%</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Promotion Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            className="btn btn-sm btn-primary"
            onClick={handleCreatePromotion}
          >
            Create New Promotion
          </button>
          <button 
            className="btn btn-sm" 
            style={{ background: '#2ecc71', color: 'white' }}
            onClick={() => setIsCouponModalOpen(true)}
          >
            Generate Coupon Codes
          </button>
          <button 
            className="btn btn-sm" 
            style={{ background: '#e67e22', color: 'white' }}
            onClick={() => window.open('/admin/analytics', '_blank')}
          >
            Analytics Report
          </button>
          <button 
            className="btn btn-sm" 
            style={{ background: '#9b59b6', color: 'white' }}
            onClick={() => {
              const csvData = promotions.map(p => ({
                Name: p.name,
                Code: p.code,
                Type: p.type,
                Discount: getDiscountDisplay(p),
                Usage: getUsageDisplay(p),
                Status: p.status,
                'Total Used': p.total_used || 0,
                'Total Discount Given': p.total_discount_given || 0
              }));
              // Simple CSV export
              const csv = [
                Object.keys(csvData[0]).join(','),
                ...csvData.map(row => Object.values(row).join(','))
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'promotions-report.csv';
              a.click();
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        background: 'white', 
        padding: '1rem', 
        borderRadius: '10px', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '1rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Search promotions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Promotions Table */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h3>Promotions ({filteredPromotions.length})</h3>
        
        {filteredPromotions.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
            {searchTerm || filterStatus !== 'all' ? 'No promotions match your filters.' : 'No promotions found. Create your first promotion!'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Promotion Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Discount</th>
                  <th>Usage</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Total Discount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromotions.map((promotion) => (
                  <tr key={promotion.id}>
                    <td style={{ fontWeight: 'bold' }}>{promotion.name}</td>
                    <td style={{ fontFamily: 'monospace', background: '#f8f9fa', padding: '0.25rem', borderRadius: '3px' }}>
                      {promotion.code}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{promotion.type.replace('_', ' ')}</td>
                    <td>{getDiscountDisplay(promotion)}</td>
                    <td>{getUsageDisplay(promotion)}</td>
                    <td>
                      {promotion.end_date 
                        ? new Date(promotion.end_date).toLocaleDateString()
                        : 'No expiry'
                      }
                    </td>
                    <td>
                      <span style={{ 
                        color: getStatusColor(promotion.status), 
                        fontWeight: 'bold',
                        padding: '0.25rem 0.5rem',
                        background: `${getStatusColor(promotion.status)}20`,
                        borderRadius: '12px',
                        fontSize: '0.875rem'
                      }}>
                        {promotion.status}
                      </span>
                    </td>
                    <td>${parseFloat(promotion.total_discount_given || 0).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEditPromotion(promotion)}
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
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePromotion(promotion.id)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            border: 'none',
                            background: '#e74c3c',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <PromotionModal
        isOpen={isPromotionModalOpen}
        onClose={() => setIsPromotionModalOpen(false)}
        promotion={selectedPromotion}
        onSave={handleSavePromotion}
      />

      <CouponGeneratorModal
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        onGenerate={handleGenerateCoupons}
      />
    </div>
  );
};

export default Promotions;

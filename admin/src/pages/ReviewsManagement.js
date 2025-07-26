import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNotification } from '../contexts/NotificationContext';

const ReviewsManagement = () => {
  const { hasPermission } = useAdminAuth();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedReview, setSelectedReview] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  useEffect(() => {
    if (hasPermission('PRODUCT_EXPERT') || hasPermission('PRODUCT_DIRECTOR') || hasPermission('GENERAL_MANAGER')) {
      fetchReviews();
    }
  }, [hasPermission]);

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:54321/api/admin/reviews', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      } else {
        setError('Failed to fetch reviews');
      }
    } catch (err) {
      setError('Network error while fetching reviews');
      console.error('Error fetching reviews:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this review?');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:54321/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchReviews();
        showSuccess('Review deleted successfully');
      } else {
        showError('Failed to delete review');
      }
    } catch (err) {
      showError('Network error while deleting review');
      console.error('Error deleting review:', err);
    }
  };

  const getStarRating = (rating) => {
    const stars = Math.round(rating / 2); // Convert 0-10 to 0-5 stars
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  const getRatingColor = (rating) => {
    if (rating >= 8) return '#2ecc71';
    if (rating >= 6) return '#f39c12';
    if (rating >= 4) return '#e67e22';
    return '#e74c3c';
  };

  const filteredAndSortedReviews = reviews
    .filter(review => {
      const matchesSearch = 
        review.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.review_text?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRating = filterRating === 'all' || 
        (filterRating === 'high' && review.rating >= 8) ||
        (filterRating === 'medium' && review.rating >= 4 && review.rating < 8) ||
        (filterRating === 'low' && review.rating < 4);
      
      return matchesSearch && matchesRating;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'highest_rating':
          return b.rating - a.rating;
        case 'lowest_rating':
          return a.rating - b.rating;
        case 'product_name':
          return a.product_name.localeCompare(b.product_name);
        default:
          return 0;
      }
    });

  if (!hasPermission('PRODUCT_EXPERT') && !hasPermission('PRODUCT_DIRECTOR') && !hasPermission('GENERAL_MANAGER')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access reviews management.</p>
        <p>Required clearance: PRODUCT_EXPERT, PRODUCT_DIRECTOR, or GENERAL_MANAGER</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="loading">Loading reviews...</div>;
  }

  return (
    <div>
      <h2>Reviews Management</h2>
      <p>View and manage all customer reviews and ratings for products.</p>
      
      {error && <div className="error-message">{error}</div>}

      {/* Statistics */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Reviews Overview</h3>
        <div className="dashboard-cards">
          <div className="dashboard-card">
            <h3>Total Reviews</h3>
            <p>{reviews.length}</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#2ecc71' }}>
            <h3>Average Rating</h3>
            <p>{reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0'}/10</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#f39c12' }}>
            <h3>High Ratings (8+)</h3>
            <p>{reviews.filter(r => r.rating >= 8).length}</p>
          </div>
          <div className="dashboard-card" style={{ borderLeftColor: '#e74c3c' }}>
            <h3>Low Ratings (&lt;4)</h3>
            <p>{reviews.filter(r => r.rating < 4).length}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ 
        background: 'white', 
        padding: '1rem', 
        borderRadius: '10px', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '1rem',
        marginTop: '2rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div>
            <input
              type="text"
              placeholder="Search by product, user, or review content..."
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
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="all">All Ratings</option>
              <option value="high">High (8-10)</option>
              <option value="medium">Medium (4-7)</option>
              <option value="low">Low (0-3)</option>
            </select>
          </div>
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest_rating">Highest Rating</option>
              <option value="lowest_rating">Lowest Rating</option>
              <option value="product_name">Product Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h3>Reviews ({filteredAndSortedReviews.length})</h3>
        
        {filteredAndSortedReviews.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
            {searchTerm || filterRating !== 'all' ? 'No reviews match your filters.' : 'No reviews found.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredAndSortedReviews.map((review) => (
              <div key={review.id} style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1rem',
                background: '#f9f9f9'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, color: '#2c3e50' }}>{review.product_name}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                      <span style={{ 
                        color: getRatingColor(review.rating),
                        fontWeight: 'bold',
                        fontSize: '1.1rem'
                      }}>
                        {getStarRating(review.rating)} {review.rating}/10
                      </span>
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>
                        by {showUserDetails ? review.full_name || review.username : review.username}
                      </span>
                      <span style={{ color: '#999', fontSize: '0.85rem' }}>
                        {new Date(review.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setSelectedReview(selectedReview === review.id ? null : review.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        border: 'none',
                        background: '#3498db',
                        color: 'white',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {selectedReview === review.id ? 'Hide Details' : 'View Details'}
                    </button>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        border: 'none',
                        background: '#e74c3c',
                        color: 'white',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {review.review_text && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p style={{ 
                      margin: 0, 
                      fontStyle: 'italic', 
                      color: '#555',
                      background: 'white',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      borderLeft: '3px solid #3498db'
                    }}>
                      "{review.review_text}"
                    </p>
                  </div>
                )}

                {selectedReview === review.id && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '1rem', 
                    background: 'white', 
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>Review Details</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                      <div>
                        <strong>Review ID:</strong> {review.id}
                      </div>
                      <div>
                        <strong>Product ID:</strong> {review.product_id}
                      </div>
                      <div>
                        <strong>Username:</strong> {review.username}
                      </div>
                      <div>
                        <strong>Full Name:</strong> {review.full_name || 'Not provided'}
                      </div>
                      <div>
                        <strong>User ID:</strong> {review.user_id}
                      </div>
                      <div>
                        <strong>Order ID:</strong> {review.order_id}
                      </div>
                      <div>
                        <strong>Created:</strong> {new Date(review.created_at).toLocaleString()}
                      </div>
                      <div>
                        <strong>Updated:</strong> {review.updated_at ? new Date(review.updated_at).toLocaleString() : 'Never'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Details Toggle */}
      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showUserDetails}
            onChange={(e) => setShowUserDetails(e.target.checked)}
          />
          Show full user names instead of usernames
        </label>
      </div>
    </div>
  );
};

export default ReviewsManagement;

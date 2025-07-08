import React, { useState, useEffect } from 'react';
import api from '../../api';
import '../css/Reviews.css';

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reviews/user');
      setReviews(response.data);
    } catch (err) {
      setError('Failed to fetch reviews');
      console.error('Reviews fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    
    try {
      await api.delete(`/reviews/${reviewId}`);
      setReviews(reviews => reviews.filter(review => review.id !== reviewId));
    } catch (err) {
      console.error('Delete review error:', err);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>★</span>
    ));
  };

  if (loading) return <div className="loading">Loading reviews...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="reviews-page">
      <div className="page-header">
        <h2>Your Reviews</h2>
        <p>Manage your product reviews and ratings</p>
      </div>

      {reviews.length === 0 ? (
        <div className="no-reviews">
          <div className="no-reviews-content">
            <span className="no-reviews-icon">⭐</span>
            <h3>No reviews yet</h3>
            <p>When you purchase and review products, they'll appear here.</p>
            <button className="browse-products-btn">Browse Products</button>
          </div>
        </div>
      ) : (
        <div className="reviews-list">
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="product-info">
                  <div className="product-image">
                    <img 
                      src={review.product_image || '/placeholder-product.jpg'} 
                      alt={review.product_name}
                    />
                  </div>
                  <div className="product-details">
                    <h3>{review.product_name}</h3>
                    <p className="review-date">
                      Reviewed on {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="review-actions">
                  <button className="edit-review-btn">Edit</button>
                  <button 
                    className="delete-review-btn"
                    onClick={() => deleteReview(review.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="review-content">
                <div className="review-rating">
                  <div className="stars">
                    {renderStars(review.rating)}
                  </div>
                  <span className="rating-text">
                    {review.rating} out of 5 stars
                  </span>
                </div>

                <div className="review-text">
                  <h4>{review.title}</h4>
                  <p>{review.comment}</p>
                </div>

                {review.helpful_votes > 0 && (
                  <div className="review-stats">
                    <span className="helpful-votes">
                      👍 {review.helpful_votes} people found this helpful
                    </span>
                  </div>
                )}
              </div>

              {review.reply && (
                <div className="seller-reply">
                  <h5>Seller Response:</h5>
                  <p>{review.reply}</p>
                  <span className="reply-date">
                    {new Date(review.reply_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="reviews-summary">
        <div className="summary-card">
          <h3>Review Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-number">{reviews.length}</span>
              <span className="stat-label">Total Reviews</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">
                {reviews.length > 0 
                  ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                  : '0'
                }
              </span>
              <span className="stat-label">Average Rating</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">
                {reviews.reduce((sum, r) => sum + (r.helpful_votes || 0), 0)}
              </span>
              <span className="stat-label">Helpful Votes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

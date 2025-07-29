import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import ProductImage from '../ReUse/ProductImage';
import '../css/Reviews.css';

export default function Reviews() {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState('my-ratings');
  const [myRatings, setMyRatings] = useState([]);
  const [ratableProducts, setRatableProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingRating, setSubmittingRating] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ratingsResponse, ratableResponse] = await Promise.all([
        api.get('/ratings/my-ratings'),
        api.get('/ratings/ratable-products')
      ]);
      setMyRatings(ratingsResponse.data);
      setRatableProducts(ratableResponse.data);
    } catch (err) {
      setError('Failed to fetch ratings data');
      console.error('Ratings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitRating = async (productData, rating, reviewText) => {
    try {
      setSubmittingRating(productData.product_id);
      await api.post('/ratings/submit', {
        product_id: productData.product_id,
        order_item_id: productData.order_item_id,
        order_id: productData.order_id,
        rating: rating,
        review_text: reviewText
      });
      
      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Submit rating error:', err);
      showError(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmittingRating(null);
    }
  };

  const deleteRating = async (ratingId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this rating?',
      () => {},
      () => {}
    );
    if (!confirmed) return;
    
    try {
      await api.delete(`/ratings/${ratingId}`);
      setMyRatings(ratings => ratings.filter(rating => rating.id !== ratingId));
      showSuccess('Rating deleted successfully');
    } catch (err) {
      console.error('Delete rating error:', err);
      showError('Failed to delete rating');
    }
  };

  const renderStars = (rating, interactive = false, onStarClick = null) => {
    return Array.from({ length: 10 }, (_, i) => (
      <span 
        key={i} 
        className={`star ${i < rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
        onClick={interactive ? () => onStarClick(i + 1) : undefined}
      >
        ★
      </span>
    ));
  };

  if (loading) return <div className="loading">Loading reviews...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="reviews-page">
      <div className="page-header">
        <h2>Product Reviews & Ratings</h2>
        <p>Rate products you've purchased and manage your reviews</p>
      </div>

      <div className="reviews-tabs">
        <button 
          className={`tab ${activeTab === 'my-ratings' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-ratings')}
        >
          My Ratings ({myRatings.length})
        </button>
        <button 
          className={`tab ${activeTab === 'rate-products' ? 'active' : ''}`}
          onClick={() => setActiveTab('rate-products')}
        >
          Rate Products ({ratableProducts.length})
        </button>
      </div>

      {activeTab === 'my-ratings' && (
        <div className="my-ratings-section">
          {myRatings.length === 0 ? (
            <div className="no-ratings">
              <div className="no-ratings-content">
                <span className="no-ratings-icon">⭐</span>
                <h3>No ratings yet</h3>
                <p>Rate products you've purchased to help other customers.</p>
              </div>
            </div>
          ) : (
            <div className="ratings-list">
              {myRatings.map((rating) => (
                <MyRatingCard 
                  key={rating.id} 
                  rating={rating} 
                  onDelete={deleteRating}
                  renderStars={renderStars}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rate-products' && (
        <div className="rate-products-section">
          {ratableProducts.length === 0 ? (
            <div className="no-products">
              <div className="no-products-content">
                <span className="no-products-icon">📦</span>
                <h3>No products to rate</h3>
                <p>Products from your delivered orders that you haven't rated yet will appear here.</p>
                <button 
                  className="browse-products-btn"
                  onClick={() => navigate('/categories')}
                >
                  Browse Products
                </button>
              </div>
            </div>
          ) : (
            <div className="ratable-products-list">
              {ratableProducts.map((product) => (
                <RatableProductCard 
                  key={`${product.product_id}-${product.order_item_id}`}
                  product={product} 
                  onSubmitRating={submitRating}
                  isSubmitting={submittingRating === product.product_id}
                  renderStars={renderStars}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Component for displaying existing ratings
function MyRatingCard({ rating, onDelete, renderStars }) {
  return (
    <div className="rating-card">
      <div className="rating-header">
        <div className="product-info">
          <div className="product-image">
            <ProductImage 
              src={rating.image_url} 
              alt={rating.product_name}
              size="medium"
            />
          </div>
          <div className="product-details">
            <h3>{rating.product_name}</h3>
            <p className="rating-date">
              Rated on {new Date(rating.created_at).toLocaleDateString()}
            </p>
            <p className="order-date">
              Purchased on {new Date(rating.order_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="rating-actions">
          <button 
            className="delete-rating-btn"
            onClick={() => onDelete(rating.id)}
            title="Delete rating"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="rating-content">
        <div className="rating-display">
          <div className="stars">
            {renderStars(rating.rating)}
          </div>
          <span className="rating-text">{rating.rating}/10</span>
        </div>
        {rating.review_text && (
          <div className="review-text">
            <p>"{rating.review_text}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Component for rating products
function RatableProductCard({ product, onSubmitRating, isSubmitting, renderStars }) {
  const { showWarning } = useNotification();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      showWarning('Please select a rating');
      return;
    }
    
    await onSubmitRating(product, rating, reviewText);
    setRating(0);
    setReviewText('');
    setShowReviewForm(false);
  };

  return (
    <div className="ratable-product-card">
      <div className="product-header">
        <div className="product-info">
          <div className="product-image">
            <ProductImage 
              src={product.image_url} 
              alt={product.product_name}
              size="medium"
            />
          </div>
          <div className="product-details">
            <h3>{product.product_name}</h3>
            <p className="order-info">
              Delivered on {new Date(product.order_date).toLocaleDateString()}
            </p>
            <p className="quantity">Quantity: {product.quantity}</p>
            <p className="price">Price: ${product.unit_price}</p>
          </div>
        </div>
      </div>

      <div className="rating-section">
        {!showReviewForm ? (
          <button 
            className="rate-product-btn"
            onClick={() => setShowReviewForm(true)}
          >
            Rate This Product
          </button>
        ) : (
          <div className="rating-form">
            <div className="rating-input">
              <label>Rating (0-10):</label>
              <div className="stars-input">
                {renderStars(rating, true, setRating)}
                <span className="rating-value">{rating}/10</span>
              </div>
            </div>
            
            <div className="review-input">
              <label>Review (optional):</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={3}
              />
            </div>
            
            <div className="form-actions">
              <button 
                className="submit-rating-btn"
                onClick={handleSubmit}
                disabled={isSubmitting || rating === 0}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Rating'}
              </button>
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowReviewForm(false);
                  setRating(0);
                  setReviewText('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

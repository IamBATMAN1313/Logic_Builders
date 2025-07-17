import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import '../css/CategoriesCarousel.css';

export default function CategoriesCarousel() {
  const [categories, setCategories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const itemsPerSlide = 6; 

  useEffect(() => {
    fetchCategoriesWithRatings();
  }, []);

  const fetchCategoriesWithRatings = async () => {
    try {
      const response = await api.get('/categories-with-ratings');
      // Categories are already sorted by average rating in the backend
      setCategories(response.data);
    } catch (err) {
      setError('Failed to fetch categories');
      console.error('Categories fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star filled">★</span>);
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="star half">★</span>);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }
    
    return stars;
  };

  const nextSlide = () => {
    const maxIndex = Math.max(0, categories.length - itemsPerSlide);
    setCurrentIndex(prev => (prev + itemsPerSlide >= maxIndex ? 0 : prev + itemsPerSlide));
  };

  const prevSlide = () => {
    const maxIndex = Math.max(0, categories.length - itemsPerSlide);
    setCurrentIndex(prev => (prev - itemsPerSlide < 0 ? maxIndex : prev - itemsPerSlide));
  };

  const visibleCategories = categories.slice(currentIndex, currentIndex + itemsPerSlide);

  if (loading) return <div className="categories-loading">Loading categories...</div>;
  if (error) return <div className="categories-error">{error}</div>;

  return (
    <section className="categories-section">
      <div className="categories-header">
        <h2>Top Rated Categories</h2>
        <Link to="/categories" className="show-all-btn">
          Show All Categories
        </Link>
      </div>

      <div className="categories-carousel">
        <button 
          className="carousel-btn carousel-btn-prev" 
          onClick={prevSlide}
          disabled={categories.length <= itemsPerSlide}
        >
          &#8249;
        </button>

        <div className="categories-grid">
          {visibleCategories.map((category) => (
            <Link 
              key={category.id} 
              to={`/category/${category.id}`} 
              className="category-card"
            >
              <div className="category-image">
                {category.image_url ? (
                  <img src={category.image_url} alt={category.name} />
                ) : (
                  <div className="category-placeholder">
                    {category.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="category-info">
                <h3>{category.name}</h3>
                {category.description && (
                  <p className="category-description">{category.description}</p>
                )}
                <div className="category-stats">
                  <span className="product-count">{category.product_count} products</span>
                </div>
                <div className="category-rating">
                  <div className="stars">
                    {renderStars(category.average_rating)}
                  </div>
                  <span className="rating-text">
                    {category.average_rating.toFixed(1)} ({category.total_ratings} reviews)
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <button 
          className="carousel-btn carousel-btn-next" 
          onClick={nextSlide}
          disabled={categories.length <= itemsPerSlide}
        >
          &#8250;
        </button>
      </div>

      <div className="carousel-indicators">
        {Array.from({ length: Math.ceil(categories.length / itemsPerSlide) }).map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === Math.floor(currentIndex / itemsPerSlide) ? 'active' : ''}`}
            onClick={() => setCurrentIndex(index * itemsPerSlide)}
          />
        ))}
      </div>
    </section>
  );
}
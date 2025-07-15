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
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (err) {
      setError('Failed to fetch categories');
      console.error('Categories fetch error:', err);
    } finally {
      setLoading(false);
    }
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
        <h2>Shop by Category</h2>
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

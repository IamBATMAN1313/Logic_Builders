import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import '../css/CategoriesCarousel.css';

export default function CategoriesCarousel() {
  const [carousels, setCarousels] = useState([]);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categoriesPerCarousel = 5;
  const firstCarouselOrder = [13, 10, 17, 12, 5]; // Laptop, Headphones, Mouse, Keyboard, Case

  useEffect(() => {
    fetchCategoriesWithImages();
  }, []); 

  useEffect(() => {
    // Auto-rotate carousels every 3 seconds
    if (carousels.length > 1) {
      const interval = setInterval(() => {
        setCurrentCarouselIndex(prev => (prev + 1) % carousels.length);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [carousels.length]);

  const fetchCategoriesWithImages = async () => {
    try {
      // Get all categories
      const response = await api.get('/categories');
      const allCats = response.data;
      
      // Create first carousel with specific order
      const firstCarouselCategories = firstCarouselOrder.map(id => 
        allCats.find(cat => cat.id === id)
      ).filter(Boolean);
      
      // Get remaining categories for other carousels
      const remainingCategories = allCats.filter(cat => 
        !firstCarouselOrder.includes(cat.id)
      );
      
      // Create additional carousels
      const additionalCarousels = [];
      for (let i = 0; i < remainingCategories.length; i += categoriesPerCarousel) {
        additionalCarousels.push(
          remainingCategories.slice(i, i + categoriesPerCarousel)
        );
      }
      
      // Combine all carousels
      const allCarousels = [firstCarouselCategories, ...additionalCarousels];
      
      // Get random product images for each category in all carousels
      const carouselsWithImages = await Promise.all(
        allCarousels.map(async (carousel) => {
          return await Promise.all(
            carousel.map(async (category) => {
              try {
                const productResponse = await api.get(`/products/random-by-category/${category.id}?limit=1`);
                if (productResponse.data.length > 0) {
                  category.image_url = productResponse.data[0].image_url;
                }
              } catch (err) {
                console.log(`No random product found for category ${category.id}`);
              }
              return category;
            })
          );
        })
      );
      
      setCarousels(carouselsWithImages);
    } catch (err) {
      setError('Failed to fetch categories');
      console.error('Categories fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextCarousel = () => {
    setCurrentCarouselIndex(prev => (prev + 1) % carousels.length);
  };

  const prevCarousel = () => {
    setCurrentCarouselIndex(prev => (prev - 1 + carousels.length) % carousels.length);
  };

  if (loading) return <div className="categories-loading">Loading categories...</div>;
  if (error) return <div className="categories-error">{error}</div>;
  if (carousels.length === 0) return null;

  const currentCarousel = carousels[currentCarouselIndex];

  return (
    <section className="categories-section">
      <div className="categories-header">
        <h2>Featured Categories</h2>
        <div className="carousel-info">
          <span>Page {currentCarouselIndex + 1} of {carousels.length}</span>
        </div>
        <Link to="/categories" className="show-all-btn">
          Show All Categories
        </Link>
      </div>

      <div className="categories-carousel">
        <button 
          className="carousel-btn carousel-btn-prev" 
          onClick={prevCarousel}
          disabled={carousels.length <= 1}
        >
          &#8249;
        </button>

        <div className="categories-grid">
          {currentCarousel.map((category) => (
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
          onClick={nextCarousel}
          disabled={carousels.length <= 1}
        >
          &#8250;
        </button>
      </div>

      <div className="carousel-indicators">
        {carousels.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentCarouselIndex ? 'active' : ''}`}
            onClick={() => setCurrentCarouselIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}
import React from 'react';
import './ProductImage.css';

const ProductImage = ({ 
  src, 
  alt, 
  className = '', 
  size = 'medium', 
  fallback = '/placeholder-product.jpg',
  loading = 'lazy',
  showPlaceholder = true
}) => {
  const handleImageError = (e) => {
    if (showPlaceholder) {
      e.target.src = fallback;
    } else {
      e.target.style.display = 'none';
      e.target.nextElementSibling.style.display = 'flex';
    }
  };

  return (
    <div className={`product-image-container ${size} ${className}`}>
      <img
        src={src || fallback}
        alt={alt}
        onError={handleImageError}
        loading={loading}
        className="product-image-responsive"
      />
      {!showPlaceholder && (
        <div className="image-placeholder" style={{ display: 'none' }}>
          <span className="placeholder-icon">📷</span>
          <span className="placeholder-text">No Image</span>
        </div>
      )}
    </div>
  );
};

export default ProductImage;

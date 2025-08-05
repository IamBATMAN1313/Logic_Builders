import React from 'react';
import './ProductImage.css';

const ProductImage = ({ 
  src, 
  alt = "Product Image", 
  size = "medium",
  fallback = "/placeholder-product.jpg"
}) => {
  const handleError = (e) => {
    e.target.src = fallback;
  };

  return (
    <div className={`admin-product-image-container admin-product-image-${size}`}>
      <img
        src={src || fallback}
        alt={alt}
        className="admin-product-image"
        onError={handleError}
      />
    </div>
  );
};

export default ProductImage;

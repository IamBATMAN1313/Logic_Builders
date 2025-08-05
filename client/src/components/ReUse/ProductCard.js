import React from 'react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage';
import './ProductCard.css';

const ProductCard = ({ 
  product, 
  size = 'medium', 
  showPrice = true, 
  showExcerpt = true,
  className = '',
  linkTo = null 
}) => {
  // Calculate discount price
  const formatPrice = (price, discountStatus, discountPercent) => {
    const originalPrice = parseFloat(price);
    if (discountStatus && discountPercent > 0) {
      const discountedPrice = originalPrice * (1 - discountPercent / 100);
      return {
        current: discountedPrice.toFixed(2),
        original: originalPrice.toFixed(2),
        hasDiscount: true
      };
    }
    return {
      current: originalPrice.toFixed(2),
      original: null,
      hasDiscount: false
    };
  };

  const price = formatPrice(product.price, product.discount_status, product.discount_percent);
  const productLink = linkTo || `/product/${product.id}`;

  return (
    <Link 
      to={productLink}
      className={`product-card ${size} ${className} ${!product.availability ? 'out-of-stock' : ''}`}
    >
      <div className="product-image-wrapper">
        <ProductImage 
          src={product.image_url}
          alt={product.name}
          size={size === 'large' ? 'card' : size}
          className="product-card-image"
        />
        
        {/* Product Overlays */}
        <div className="product-overlays">
          {/* Discount Badge */}
          {price.hasDiscount && (
            <div className="discount-overlay">
              <span>-{product.discount_percent}%</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="product-card-content">
        <h3 className="product-title">{product.name}</h3>
        
        {showExcerpt && product.excerpt && (
          <p className="product-excerpt">{product.excerpt}</p>
        )}
        
        {showPrice && product.price && (
          <div className="product-pricing">
            <span className="current-price">${price.current}</span>
            {price.hasDiscount && (
              <span className="original-price">${price.original}</span>
            )}
          </div>
        )}
        
        {/* Rating if available */}
        {product.average_rating > 0 && (
          <div className="product-rating">
            <span className="stars">
              {'★'.repeat(Math.round(product.average_rating / 2))}
              {'☆'.repeat(5 - Math.round(product.average_rating / 2))}
            </span>
            <span className="rating-text">
              {product.average_rating}/10 ({product.rating_count || 0})
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;

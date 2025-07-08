import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import '../css/CategoriesPage.css';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      // Fetch product count for each category
      const categoriesWithCount = await Promise.all(
        response.data.map(async (category) => {
          try {
            const countResponse = await api.get(`/categories/${category.id}`);
            return { ...category, product_count: countResponse.data.product_count };
          } catch (err) {
            return { ...category, product_count: 0 };
          }
        })
      );
      setCategories(categoriesWithCount);
    } catch (err) {
      setError('Failed to fetch categories');
      console.error('Categories fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-loading">Loading categories...</div>;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1>All Categories</h1>
        <p>Browse products by category</p>
      </div>

      <div className="categories-grid-page">
        {categories.map((category) => (
          <Link 
            key={category.id} 
            to={`/category/${category.id}`} 
            className="category-card-page"
          >
            <div className="category-image-page">
              {category.image_url ? (
                <img src={category.image_url} alt={category.name} />
              ) : (
                <div className="category-placeholder-page">
                  {category.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="category-info-page">
              <h3>{category.name}</h3>
              {category.description && (
                <p className="category-description-page">{category.description}</p>
              )}
              <div className="category-stats">
                <span className="product-count">
                  {category.product_count} {category.product_count === 1 ? 'product' : 'products'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

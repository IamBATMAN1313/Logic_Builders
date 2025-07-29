import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import ProductImage from '../ReUse/ProductImage';
import ProductCard from '../ReUse/ProductCard';
import api from '../../api';
import FilterPanel from '../Filter/FilterPanel';
import '../css/CategoryProducts.css';

export default function CategoryProducts() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(true);

  // Initialize filters from URL params
  const [filters, setFilters] = useState(() => {
    const urlFilters = {};
    for (const [key, value] of searchParams.entries()) {
      urlFilters[key] = value;
    }
    return {
      availability: 'true',
      sortBy: 'date_added',
      sortOrder: 'DESC',
      ...urlFilters
    };
  });

  useEffect(() => {
    if (id) {
      fetchCategoryAndProducts();
    }
  }, [id, filters]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  }, [filters, setSearchParams]);

  const fetchCategoryAndProducts = async () => {
    try {
      setLoading(true);
      
      // Fetch category details
      const categoryResponse = await api.get(`/categories/${id}`);
      setCategory(categoryResponse.data);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.set(key, value);
        }
      });
      
      // Fetch products for this category with filters
      const productsResponse = await api.get(`/categories/${id}/products?${queryParams.toString()}`);
      setProducts(productsResponse.data.products);
      setPagination(productsResponse.data.pagination);
      
    } catch (err) {
      setError('Failed to fetch category data');
      console.error('Category fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters) => {
    setFilters({ ...newFilters, page: 1 }); // Reset to page 1 when filters change
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

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

  if (loading) return <div className="page-loading">Loading...</div>;
  if (error) return <div className="page-error">{error}</div>;
  if (!category) return <div className="page-error">Category not found</div>;

  return (
    <div className="category-products-page">
      <div className="category-header">
        <div className="breadcrumbs">
          <Link to="/">Home</Link> 
          <span> / </span>
          <Link to="/categories">Categories</Link>
          <span> / </span>
          <span>{category.name}</span>
        </div>
        
        <div className="category-title-section">
          <h1>{category.name}</h1>
          <button 
            className="mobile-filter-toggle"
            onClick={() => setFiltersVisible(!filtersVisible)}
          >
            Filters {filtersVisible ? '✕' : '☰'}
          </button>
        </div>
        
        {category.description && (
          <p className="category-description">{category.description}</p>
        )}
        
        <div className="category-stats">
          <span>{pagination.totalItems || 0} products found</span>
        </div>
      </div>

      <div className="products-layout">
        <aside className="filters-sidebar">
          <FilterPanel
            categoryId={id}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isVisible={filtersVisible}
            onToggle={() => setFiltersVisible(!filtersVisible)}
          />
        </aside>

        <main className="products-main">
          <div className="products-content">
            {products.length === 0 ? (
              <div className="no-products">
                <p>No products found matching your criteria.</p>
              <button onClick={() => handleFiltersChange({ availability: 'true', sortBy: 'date_added', sortOrder: 'DESC' })}>
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    size="medium"
                    showPrice={true}
                    showExcerpt={true}
                  />
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="pagination">
                  {pagination.hasPrev && (
                    <button 
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      className="pagination-btn"
                    >
                      ← Previous
                    </button>
                  )}
                  
                  <span className="pagination-info">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  
                  {pagination.hasNext && (
                    <button 
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      className="pagination-btn"
                    >
                      Next →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

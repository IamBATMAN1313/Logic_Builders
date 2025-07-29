import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ProductImage from '../ReUse/ProductImage';
import '../../components/css/SearchResults.css'; // Assuming you'll add custom styles here

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({});

  const query = searchParams.get('q');
  const page = searchParams.get('page') || 1;

  useEffect(() => {
    if (query) {
      fetchSearchResults();
    }
  }, [query, page]);

  const fetchSearchResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&page=${page}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await await response.json();
      setResults(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="search-results-container" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '20px' }}>
        <div className="loading-message" style={{ textAlign: 'center', fontSize: '1.2em', color: '#555' }}>
          Searching...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-results-container" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '20px' }}>
        <div className="error-message" style={{ textAlign: 'center', fontSize: '1.2em', color: '#d9534f' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-container" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '20px' }}>
      <div className="header" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h4 style={{ margin: 0, color: '#555' }}>Search Results for "{query}"</h4>
      </div>

      {results.length === 0 ? (
        <div className="no-results" style={{ textAlign: 'center', padding: '50px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '1em', color: '#555' }}>No products found matching your search.</p>
        </div>
      ) : (
        <>
          <div className="results-list">
            {results.map(product => (
              <div key={product.id} className="product-card" style={{
                display: 'flex',
                backgroundColor: '#fff',
                marginBottom: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                padding: '20px',
                alignItems: 'center',
              }}>
                {/* Left Section: Product Image */}
                <ProductImage 
                  src={product.image_url}
                  alt={product.name}
                  size="medium"
                  className="search-result-image"
                />

                {/* Middle Section: Product Details */}
                <div className="product-details" style={{ flexGrow: 1 }}>
                  <h3 className="product-name" style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1.4em' }}> {/* Changed color to dark for consistency */}
                    <Link to={`/product/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {product.name}
                    </Link>
                  </h3>
                  {/* Using product.category as description */}
                  <p className="product-category-description" style={{ margin: '0 0 10px 0', color: '#555', fontSize: '0.95em', fontWeight: 'bold' }}>
                    Category: {product.category || 'N/A'}
                  </p>
                  {/* Retaining price info, can add more if desired */}
                  <div className="product-info-metrics" style={{ display: 'flex', gap: '20px', fontSize: '0.9em', color: '#777' }}>
                    {product.price && (
                      <div className="info-item">
                        <strong>Price:</strong> ${parseFloat(product.price).toFixed(2)}
                      </div>
                    )}
                    {/* You can add more specific info here if needed, e.g., product.brand */}
                    {product.brand && (
                      <div className="info-item">
                        <strong>Brand:</strong> {product.brand}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Section: View Product Action Only */}
                <div className="product-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                  <Link to={`/product/${product.id}`} className="view-product-button" style={{
                    padding: '12px 25px', /* Increased padding for a larger button */
                    backgroundColor: '#007bff', /* Original blue */
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px', /* More rounded corners */
                    textDecoration: 'none',
                    fontSize: '1.05em', /* Slightly larger font */
                    fontWeight: 'bold', /* Bolder text */
                    boxShadow: '0 4px 8px rgba(0, 123, 255, 0.3)', /* Soft shadow for depth */
                    transition: 'background-color 0.3s ease, transform 0.2s ease', /* Smooth hover effects */
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0056b3'; // Darker blue on hover
                    e.currentTarget.style.transform = 'translateY(-1px)'; // Slight lift
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#007bff'; // Back to original
                    e.currentTarget.style.transform = 'translateY(0)'; // Back to original
                  }}
                  >
                    View Product
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '30px',
              padding: '15px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              {pagination.hasPrev && (
                <Link
                  to={`/search?q=${encodeURIComponent(query)}&page=${pagination.currentPage - 1}`}
                  className="pagination-button"
                  style={{
                    padding: '8px 15px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    textDecoration: 'none',
                    marginRight: '10px',
                  }}
                >
                  Previous
                </Link>
              )}
              <span className="pagination-info" style={{ margin: '0 10px', color: '#555', fontSize: '1em' }}>
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              {pagination.hasNext && (
                <Link
                  to={`/search?q=${encodeURIComponent(query)}&page=${pagination.currentPage + 1}`}
                  className="pagination-button"
                  style={{
                    padding: '8px 15px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    textDecoration: 'none',
                    marginLeft: '10px',
                  }}
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
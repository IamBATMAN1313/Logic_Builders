import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ProductImage from '../ReUse/ProductImage';
import ProductCard from '../ReUse/ProductCard';
import api from '../../api';
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
      const response = await api.get(`/products/search?q=${encodeURIComponent(query)}&page=${page}`);
      setResults(response.data.products);
      setPagination(response.data.pagination);
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
          <div className="results-list" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            {results.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                size="medium"
                showPrice={true}
                showExcerpt={true}
              />
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
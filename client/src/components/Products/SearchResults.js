import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import '../../components/css/SearchResults.css';

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
      const data = await response.json();
      setResults(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format specs object
  const formatSpecs = (specs) => {
    if (!specs || typeof specs !== 'object') return 'No specs available';
    
    return Object.entries(specs)
      .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
      .join(', ');
  };

  if (loading) return <div className="loading">Searching...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="search-results">
      <h2>Search Results for "{query}"</h2>
      
      {results.length === 0 ? (
        <div className="no-results">No products found matching your search.</div>
      ) : (
        <>
          <div className="results-grid">
            {results.map(product => (
              <div key={product.id} className="product-card">
                <Link to={`/product/${product.id}`}>
                  <h3>{product.name}</h3>
                  <p className="excerpt">{product.excerpt}</p>
                  <p className="specs">{formatSpecs(product.specs)}</p>
                </Link>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              {pagination.hasPrev && (
                <Link 
                  to={`/search?q=${encodeURIComponent(query)}&page=${pagination.currentPage - 1}`}
                  className="pagination-btn"
                >
                  Previous
                </Link>
              )}
              
              <span className="page-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              
              {pagination.hasNext && (
                <Link 
                  to={`/search?q=${encodeURIComponent(query)}&page=${pagination.currentPage + 1}`}
                  className="pagination-btn"
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
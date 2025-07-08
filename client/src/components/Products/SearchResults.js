// import React, { useState, useEffect } from 'react';
// import { useSearchParams, Link } from 'react-router-dom';
// import api from '../../api';
// import '../css/SearchResults.css';

// export default function SearchResults() {
//   const [searchParams] = useSearchParams();
//   const [results, setResults] = useState({ products: [], pagination: {} });
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
  
//   const query = searchParams.get('q');
//   const page = searchParams.get('page') || 1;

//   useEffect(() => {
//     if (query) {
//       searchProducts();
//     }
//   }, [query, page]);

//   const searchProducts = async () => {
//     try {
//       setLoading(true);
//       setError('');
//       const response = await api.get(`/products/search?q=${encodeURIComponent(query)}&page=${page}&limit=10`);
//       setResults(response.data);
//     } catch (err) {
//       setError(err.response?.data?.error || 'Search failed');
//       setResults({ products: [], pagination: {} });
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading) return <div className="search-loading">Searching...</div>;
//   if (error) return <div className="search-error">Error: {error}</div>;

//   const { products, pagination } = results;

//   return (
//     <div className="search-results">
//       <div className="search-header">
//         <h2>Search Results for "{query}"</h2>
//         <p>{pagination.totalItems || 0} products found</p>
//       </div>

//       {products.length === 0 ? (
//         <div className="no-results">
//           <p>No products found matching your search.</p>
//           <Link to="/">← Back to Homepage</Link>
//         </div>
//       ) : (
//         <>
//           <div className="products-grid">
//             {products.map((product) => (
//               <div key={product.id} className="product-card">
//                 <Link to={`/product/${product.id}`} className="product-link">
//                   <h3>{product.name}</h3>
//                   <p className="product-excerpt">{product.excerpt}</p>
//                   <div className="product-specs">
//                     <small>{product.specs}</small>
//                   </div>
//                 </Link>
//               </div>
//             ))}
//           </div>

//           {/* Pagination */}
//           {pagination.totalPages > 1 && (
//             <div className="pagination">
//               {pagination.hasPrev && (
//                 <Link 
//                   to={`/search?q=${encodeURIComponent(query)}&page=${pagination.currentPage - 1}`}
//                   className="pagination-btn"
//                 >
//                   ← Previous
//                 </Link>
//               )}
              
//               <span className="pagination-info">
//                 Page {pagination.currentPage} of {pagination.totalPages}
//               </span>
              
//               {pagination.hasNext && (
//                 <Link 
//                   to={`/search?q=${encodeURIComponent(query)}&page=${pagination.currentPage + 1}`}
//                   className="pagination-btn"
//                 >
//                   Next →
//                 </Link>
//               )}
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }


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
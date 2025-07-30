import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import CategoriesCarousel from '../Products/CategoriesCarousel';

export default function Homepage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/products/featured?limit=12')
       .then(res => {
         console.log('Featured products response:', res.data);
         setItems(res.data);
       })
       .catch(err => {
         console.error('Featured products error:', err);
         // Fallback to random products if featured fails
         api.get('/products/random?limit=12')
           .then(res => setItems(res.data))
           .catch(console.error);
       });
  }, []); //[] empty dependency array, runs once when component mounts. if not given, it runs on every render

  return (
  <main style={{ padding: '1rem', backgroundColor: '#FFFFFF' }}> {/* Keep background white */}
    {/* Categories Section */}
    <CategoriesCarousel />

    {/* Featured Products Section */}
    <section style={{ marginTop: '60px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#555555' }}>Top Rated Products</h2> {/* Updated title */}
      <ul style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '20px',
        listStyle: 'none',
        padding: 0,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {items.map(p => (
          <li key={p.id} style={{
            border: '1px solid #EEEEEE', // Very light grey border
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)', // Even softer shadow
            transition: 'transform 0.2s ease-in-out',
            backgroundColor: '#FAFAFA' // Slightly off-white for card background
          }}>
            <Link
              to={`/product/${p.id}`}
              style={{
                textDecoration: 'none',
                color: '#6A5ACD', // A soft, pleasing purple (Slate Blue)
                display: 'block',
                textAlign: 'center'
              }}
              onMouseOver={(e) => e.currentTarget.parentNode.style.transform = 'translateY(-5px)'}
              onMouseOut={(e) => e.currentTarget.parentNode.style.transform = 'translateY(0)'}
            >
              <strong style={{ fontSize: '1.1rem', color: '#444444', display: 'block', marginBottom: '8px' }}>{p.name}</strong>
              
              {/* Rating Display */}
              <div style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                {p.average_rating > 0 ? (
                  <span style={{ color: '#FFA500' }}>
                    {'★'.repeat(Math.round(p.average_rating / 2))}{'☆'.repeat(5 - Math.round(p.average_rating / 2))} 
                    <span style={{ color: '#666', marginLeft: '5px' }}>
                      {p.average_rating}/10 ({p.rating_count} reviews)
                    </span>
                  </span>
                ) : (
                  <span style={{ color: '#999', fontSize: '0.85rem' }}>No ratings yet</span>
                )}
              </div>
              
              {/* Price Display */}
              {p.price && (
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2E7D32' }}>
                  ${parseFloat(p.price).toFixed(2)}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  </main>
);
}

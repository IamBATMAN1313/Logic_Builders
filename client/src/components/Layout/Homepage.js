import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import CategoriesCarousel from '../Products/CategoriesCarousel';
import ProductCard from '../ReUse/ProductCard';

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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 20px'
      }}>
        {items.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            size="medium"
            showPrice={true}
            showExcerpt={false}
          />
        ))}
      </div>
    </section>
  </main>
);
}

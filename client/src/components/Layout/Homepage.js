import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

export default function Homepage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/products/random?limit=12')
       .then(res => setItems(res.data))
       .catch(console.error);
  }, []); //[] empty dependency array, runs once when component mounts. if not given, it runs on every render

  return (
    <main style={{ padding:'1rem' }}>
      <h2>Featured Products</h2>
      <ul style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem', listStyle:'none', padding:0 }}>
        {items.map(p => (
          <li key={p.id} style={{ border:'1px solid #ccc', padding:'1rem', borderRadius:'8px' }}>
            <Link to={`/product/${p.id}`} style={{ textDecoration:'none' }}>
              <strong>{p.name}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

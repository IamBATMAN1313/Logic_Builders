import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    api.get(`/products/${id}`)
       .then(res => setProduct(res.data))
       .catch(console.error);
  }, [id]);

  if (!product) return <p>Loading…</p>;

  // Beautify specs: key → “Key Name”
  const specEntries = Object.entries(product.specs || {});

  return (
    <main style={{ padding:'1rem' }}>
      <Link to="/"><button>← Back to Home</button></Link>
      <h2>{product.name}</h2>
      <p>{product.excerpt}</p>
      <section>
        <h3>Specifications</h3>
        <table style={{ borderCollapse:'collapse', width:'100%' }}>
          <tbody>
            {specEntries.map(([key, val]) => (
              <tr key={key}>
                <th style={{ textAlign:'left', padding:'0.5rem', borderBottom:'1px solid #ddd' }}>
                  {key.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}
                </th>
                <td style={{ padding:'0.5rem', borderBottom:'1px solid #eee' }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../../api';
import '../css/Builds.css';

export default function Builds() {
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchBuilds();
  }, []);

  const fetchBuilds = async () => {
    try {
      setLoading(true);
      const response = await api.get('/builds');
      setBuilds(response.data);
    } catch (err) {
      setError('Failed to fetch builds');
      console.error('Builds fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteBuild = async (buildId) => {
    if (!window.confirm('Are you sure you want to delete this build?')) return;
    
    try {
      await api.delete(`/builds/${buildId}`);
      setBuilds(builds => builds.filter(build => build.id !== buildId));
    } catch (err) {
      console.error('Delete build error:', err);
    }
  };

  const getBuildTotal = (components) => {
    return components.reduce((total, component) => total + parseFloat(component.price), 0).toFixed(2);
  };

  if (loading) return <div className="loading">Loading builds...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="builds-page">
      <div className="page-header">
        <div>
          <h2>PC Builds</h2>
          <p>Create and manage your custom PC builds</p>
        </div>
        <button 
          className="create-build-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + Create New Build
        </button>
      </div>

      {builds.length === 0 ? (
        <div className="no-builds">
          <div className="no-builds-content">
            <span className="no-builds-icon">🖥️</span>
            <h3>No builds yet</h3>
            <p>Create your first custom PC build to get started.</p>
            <button 
              className="create-first-build-btn"
              onClick={() => setShowCreateModal(true)}
            >
              Create Your First Build
            </button>
          </div>
        </div>
      ) : (
        <div className="builds-grid">
          {builds.map((build) => (
            <div key={build.id} className="build-card">
              <div className="build-header">
                <h3>{build.name}</h3>
                <div className="build-actions">
                  <button className="edit-btn">Edit</button>
                  <button 
                    className="delete-btn"
                    onClick={() => deleteBuild(build.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="build-image">
                <img 
                  src={build.image_url || '/placeholder-build.jpg'} 
                  alt={build.name}
                />
              </div>

              <div className="build-specs">
                <div className="build-description">
                  {build.description && (
                    <p>{build.description}</p>
                  )}
                </div>

                <div className="build-components">
                  <h4>Components ({build.components?.length || 0})</h4>
                  <div className="components-list">
                    {build.components?.slice(0, 4).map((component, index) => (
                      <div key={index} className="component-item">
                        <span className="component-name">{component.name}</span>
                        <span className="component-price">${component.price}</span>
                      </div>
                    ))}
                    {build.components?.length > 4 && (
                      <div className="more-components">
                        +{build.components.length - 4} more components
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="build-footer">
                <div className="build-total">
                  <strong>Total: ${getBuildTotal(build.components || [])}</strong>
                </div>
                <div className="build-actions-footer">
                  <button className="view-build-btn">View Details</button>
                  <button className="add-to-cart-btn">Add to Cart</button>
                </div>
              </div>

              <div className="build-meta">
                <span className="build-date">
                  Created {new Date(build.created_at).toLocaleDateString()}
                </span>
                <span className="build-status">
                  {build.is_public ? 'Public' : 'Private'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-build-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New PC Build</h3>
              <button 
                className="close-modal"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <p>PC Build Creator coming soon! This feature will allow you to:</p>
              <ul>
                <li>Select compatible components</li>
                <li>Check power requirements</li>
                <li>Verify component compatibility</li>
                <li>Save and share your builds</li>
                <li>Get price estimates</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

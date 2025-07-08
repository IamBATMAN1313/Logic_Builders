import React from 'react';
import '../css/SpecsFilter.css';

export default function SpecsFilter({ specOptions, selectedSpecs, onChange }) {
  const handleSpecChange = (specKey, value) => {
    const newSelectedSpecs = { ...selectedSpecs };
    
    if (value === '' || value === 'all') {
      delete newSelectedSpecs[specKey];
    } else {
      newSelectedSpecs[specKey] = value;
    }
    
    onChange(newSelectedSpecs);
  };

  const clearAllSpecs = () => {
    onChange({});
  };

  const formatSpecKey = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="specs-filter">
      <div className="filter-header">
        <h4>Specifications</h4>
        <button className="reset-btn" onClick={clearAllSpecs}>Clear All</button>
      </div>
      
      <div className="specs-list">
        {Object.keys(specOptions).map(specKey => (
          <div key={specKey} className="spec-filter-group">
            <label className="spec-label">{formatSpecKey(specKey)}</label>
            <select
              value={selectedSpecs[specKey] || ''}
              onChange={(e) => handleSpecChange(specKey, e.target.value)}
              className="spec-select"
            >
              <option value="">All {formatSpecKey(specKey)}</option>
              {specOptions[specKey].map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      
      {Object.keys(selectedSpecs).length > 0 && (
        <div className="active-filters">
          <h5>Active Filters:</h5>
          <div className="filter-tags">
            {Object.entries(selectedSpecs).map(([key, value]) => (
              <span key={key} className="filter-tag">
                {formatSpecKey(key)}: {value}
                <button 
                  className="remove-filter"
                  onClick={() => handleSpecChange(key, '')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

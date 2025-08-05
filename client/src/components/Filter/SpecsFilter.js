import React, { useState } from 'react';
import '../css/SpecsFilter.css';

export default function SpecsFilter({ specOptions, selectedSpecs, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  const specKeys = Object.keys(specOptions);
  const hasMultipleSpecs = specKeys.length > 6;
  const visibleSpecs = hasMultipleSpecs && !isExpanded ? specKeys.slice(0, 6) : specKeys;

  // Group related specs together for better organization
  const groupSpecs = (specs) => {
    const groups = {
      performance: ['processor', 'cpu', 'gpu', 'ram', 'memory', 'cores', 'threads', 'cache'],
      display: ['screen_size', 'resolution', 'display', 'refresh_rate', 'panel_type'],
      storage: ['storage', 'capacity', 'ssd', 'hdd', 'drive_type'],
      connectivity: ['wifi', 'bluetooth', 'ports', 'usb', 'hdmi', 'ethernet'],
      physical: ['weight', 'dimensions', 'color', 'material', 'form_factor', 'size'],
      other: []
    };

    const categorized = {
      performance: [],
      display: [],
      storage: [],
      connectivity: [],
      physical: [],
      other: []
    };

    specs.forEach(spec => {
      let placed = false;
      for (const [category, keywords] of Object.entries(groups)) {
        if (category !== 'other' && keywords.some(keyword => 
          spec.toLowerCase().includes(keyword.toLowerCase())
        )) {
          categorized[category].push(spec);
          placed = true;
          break;
        }
      }
      if (!placed) {
        categorized.other.push(spec);
      }
    });

    return categorized;
  };

  const renderSpecFilter = (specKey) => (
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
  );

  return (
    <div className="specs-filter">
      <div className="filter-header">
        <h4>Specifications {specKeys.length > 0 && `(${specKeys.length})`}</h4>
        {Object.keys(selectedSpecs).length > 0 && (
          <button className="reset-btn" onClick={clearAllSpecs}>
            Clear All
          </button>
        )}
      </div>
      
      {specKeys.length === 0 ? (
        <div className="no-specs-message">
          No specifications available for filtering in this category.
        </div>
      ) : (
        <>
          <div className={`specs-list ${hasMultipleSpecs && !isExpanded ? 'collapsed' : ''}`}>
            {hasMultipleSpecs && specKeys.length > 12 ? (
              // For categories with many specs, group them by category
              Object.entries(groupSpecs(visibleSpecs)).map(([category, specs]) => 
                specs.length > 0 && (
                  <div key={category} className="spec-category-group">
                    <h6 className="spec-category-title">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </h6>
                    <div className="spec-category-items">
                      {specs.map(renderSpecFilter)}
                    </div>
                  </div>
                )
              )
            ) : (
              // For categories with fewer specs, show them directly
              visibleSpecs.map(renderSpecFilter)
            )}
          </div>
          
          {hasMultipleSpecs && (
            <button 
              className="expand-toggle"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded 
                ? `Show Less Filters ↑` 
                : `Show All ${specKeys.length} Filters ↓`
              }
            </button>
          )}
        </>
      )}
      
      {Object.keys(selectedSpecs).length > 0 && (
        <div className="active-filters">
          <h5>Active Filters ({Object.keys(selectedSpecs).length}):</h5>
          <div className="filter-tags">
            {Object.entries(selectedSpecs).map(([key, value]) => (
              <span key={key} className="filter-tag">
                {formatSpecKey(key)}: {value}
                <button 
                  className="remove-filter"
                  onClick={() => handleSpecChange(key, '')}
                  title={`Remove ${formatSpecKey(key)} filter`}
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

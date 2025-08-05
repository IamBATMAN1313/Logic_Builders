import React, { useState, useEffect } from 'react';
import PriceRangeFilter from './PriceRangeFilter';
import SpecsFilter from './SpecsFilter';
import AvailabilityFilter from './AvailabilityFilter';
import SortFilter from './SortFilter';
import api from '../../api';
import '../css/FilterPanel.css';

export default function FilterPanel({ 
  categoryId, 
  filters, 
  onFiltersChange,
  isVisible,
  onToggle 
}) {
  const [filterOptions, setFilterOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Pending filters state - stores filter changes before applying
  const [pendingFilters, setPendingFilters] = useState(filters);

  useEffect(() => {
    if (categoryId) {
      fetchFilterOptions();
    }
  }, [categoryId]);

  // Update pending filters when props change
  useEffect(() => {
    setPendingFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (categoryId) {
      fetchFilterOptions();
    }
  }, [categoryId]);

  const fetchFilterOptions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/categories/${categoryId}/filters`);
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (minPrice, maxPrice) => {
    setPendingFilters({
      ...pendingFilters,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined
    });
  };

  const handleSpecsChange = (newSpecs) => {
    // Remove existing spec filters from pending
    const nonSpecFilters = Object.keys(pendingFilters).reduce((acc, key) => {
      if (!key.startsWith('spec_')) {
        acc[key] = pendingFilters[key];
      }
      return acc;
    }, {});

    // Add new spec filters with spec_ prefix
    const specFilters = {};
    Object.keys(newSpecs).forEach(key => {
      specFilters[`spec_${key}`] = newSpecs[key];
    });
    
    setPendingFilters({
      ...nonSpecFilters,
      ...specFilters
    });
  };

  const handleAvailabilityChange = (availability) => {
    setPendingFilters({
      ...pendingFilters,
      availability
    });
  };

  const handleSortChange = (sortBy, sortOrder) => {
    setPendingFilters({
      ...pendingFilters,
      sortBy,
      sortOrder
    });
  };

  const applyFilters = () => {
    onFiltersChange(pendingFilters);
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      availability: 'true',
      sortBy: 'date_added',
      sortOrder: 'DESC'
    };
    setPendingFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (pendingFilters.minPrice !== undefined || pendingFilters.maxPrice !== undefined) count++;
    if (pendingFilters.availability !== 'true') count++;
    if (pendingFilters.sortBy !== 'date_added' || pendingFilters.sortOrder !== 'DESC') count++;
    
    // Count spec filters
    Object.keys(pendingFilters).forEach(key => {
      if (key.startsWith('spec_')) count++;
    });
    
    return count;
  };

  // Convert API spec filters back to component format
  const getSelectedSpecs = () => {
    const specs = {};
    Object.keys(pendingFilters).forEach(key => {
      if (key.startsWith('spec_')) {
        const specKey = key.replace('spec_', '');
        specs[specKey] = pendingFilters[key];
      }
    });
    return specs;
  };

  // Check if there are pending changes
  const hasChanges = () => {
    return JSON.stringify(filters) !== JSON.stringify(pendingFilters);
  };

  if (loading) {
    return (
      <div className="filter-panel">
        <div className="filter-loading">Loading filters...</div>
      </div>
    );
  }

  if (!filterOptions) {
    return (
      <div className="filter-panel">
        <div className="filter-error">Failed to load filters</div>
      </div>
    );
  }

  return (
    <div className={`filter-panel ${isVisible ? 'visible' : ''}`}>
      <div className="filter-header-main">
        <h3>Filters</h3>
        <div className="filter-controls">
          {getActiveFilterCount() > 0 && (
            <span className="active-count">{getActiveFilterCount()} active</span>
          )}
          <button className="clear-all-btn" onClick={clearAllFilters}>
            Clear All
          </button>
          <button className="toggle-btn" onClick={onToggle}>
            {isVisible ? '✕' : '☰'}
          </button>
        </div>
      </div>

      <div className="filter-content">
        <SortFilter
          sortBy={pendingFilters.sortBy || 'date_added'}
          sortOrder={pendingFilters.sortOrder || 'DESC'}
          onChange={handleSortChange}
        />

        <AvailabilityFilter
          availability={pendingFilters.availability || 'true'}
          onChange={handleAvailabilityChange}
        />

        <PriceRangeFilter
          minPrice={filterOptions.priceRange.min}
          maxPrice={filterOptions.priceRange.max}
          currentMin={pendingFilters.minPrice}
          currentMax={pendingFilters.maxPrice}
          onChange={handlePriceChange}
        />

        {Object.keys(filterOptions.specs).length > 0 && (
          <SpecsFilter
            specOptions={filterOptions.specs}
            selectedSpecs={getSelectedSpecs()}
            onChange={handleSpecsChange}
          />
        )}

        <div className="filter-apply-section">
          <button 
            className={`apply-filters-btn ${hasChanges() ? 'has-changes' : ''}`}
            onClick={applyFilters}
            disabled={!hasChanges()}
          >
            {hasChanges() ? 'Apply Filters' : 'Filters Applied'}
          </button>
        </div>
      </div>
    </div>
  );
}

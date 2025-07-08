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
    onFiltersChange({
      ...filters,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined
    });
  };

  const handleSpecsChange = (newSpecs) => {
    // Remove existing spec filters
    const nonSpecFilters = Object.keys(filters).reduce((acc, key) => {
      if (!key.startsWith('spec_')) {
        acc[key] = filters[key];
      }
      return acc;
    }, {});

    // Add new spec filters with spec_ prefix
    const specFilters = {};
    Object.keys(newSpecs).forEach(key => {
      specFilters[`spec_${key}`] = newSpecs[key];
    });
    
    // Remove old spec filters and add new ones
    const newFilters = { ...filters };
    Object.keys(newFilters).forEach(key => {
      if (key.startsWith('spec_')) {
        delete newFilters[key];
      }
    });
    
    onFiltersChange({
      ...newFilters,
      ...specFilters
    });
  };

  const handleAvailabilityChange = (availability) => {
    onFiltersChange({
      ...filters,
      availability
    });
  };

  const handleSortChange = (sortBy, sortOrder) => {
    onFiltersChange({
      ...filters,
      sortBy,
      sortOrder
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      availability: 'true',
      sortBy: 'date_added',
      sortOrder: 'DESC'
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count++;
    if (filters.availability !== 'true') count++;
    if (filters.sortBy !== 'date_added' || filters.sortOrder !== 'DESC') count++;
    
    // Count spec filters
    Object.keys(filters).forEach(key => {
      if (key.startsWith('spec_')) count++;
    });
    
    return count;
  };

  // Convert API spec filters back to component format
  const getSelectedSpecs = () => {
    const specs = {};
    Object.keys(filters).forEach(key => {
      if (key.startsWith('spec_')) {
        const specKey = key.replace('spec_', '');
        specs[specKey] = filters[key];
      }
    });
    return specs;
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
          sortBy={filters.sortBy || 'date_added'}
          sortOrder={filters.sortOrder || 'DESC'}
          onChange={handleSortChange}
        />

        <AvailabilityFilter
          availability={filters.availability || 'true'}
          onChange={handleAvailabilityChange}
        />

        <PriceRangeFilter
          minPrice={filterOptions.priceRange.min}
          maxPrice={filterOptions.priceRange.max}
          currentMin={filters.minPrice}
          currentMax={filters.maxPrice}
          onChange={handlePriceChange}
        />

        {Object.keys(filterOptions.specs).length > 0 && (
          <SpecsFilter
            specOptions={filterOptions.specs}
            selectedSpecs={getSelectedSpecs()}
            onChange={handleSpecsChange}
          />
        )}
      </div>
    </div>
  );
}

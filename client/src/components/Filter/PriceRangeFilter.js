import React, { useState, useEffect } from 'react';
import '../css/PriceRangeFilter.css';

export default function PriceRangeFilter({ 
  minPrice, 
  maxPrice, 
  currentMin, 
  currentMax, 
  onChange 
}) {
  const [localMin, setLocalMin] = useState(currentMin || minPrice);
  const [localMax, setLocalMax] = useState(currentMax || maxPrice);

  useEffect(() => {
    setLocalMin(currentMin || minPrice);
    setLocalMax(currentMax || maxPrice);
  }, [currentMin, currentMax, minPrice, maxPrice]);

  const handleMinChange = (e) => {
    const value = parseFloat(e.target.value);
    // Ensure min doesn't exceed max
    const newMin = Math.min(value, localMax);
    setLocalMin(newMin);
    onChange(newMin, localMax);
  };

  const handleMaxChange = (e) => {
    const value = parseFloat(e.target.value);
    // Ensure max doesn't go below min
    const newMax = Math.max(value, localMin);
    setLocalMax(newMax);
    onChange(localMin, newMax);
  };

  const resetRange = () => {
    setLocalMin(minPrice);
    setLocalMax(maxPrice);
    onChange(minPrice, maxPrice);
  };

  return (
    <div className="price-range-filter">
      <div className="filter-header">
        <h4>Price Range</h4>
        <button className="reset-btn" onClick={resetRange}>Reset</button>
      </div>
      
      <div className="price-inputs">
        <div className="price-input-group">
          <label>Min</label>
          <input
            type="number"
            min={minPrice}
            max={localMax}
            value={localMin}
            onChange={handleMinChange}
            className="price-input"
          />
        </div>
        <span className="price-separator">-</span>
        <div className="price-input-group">
          <label>Max</label>
          <input
            type="number"
            min={localMin}
            max={maxPrice}
            value={localMax}
            onChange={handleMaxChange}
            className="price-input"
          />
        </div>
      </div>
      
      <div className="price-sliders">
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={localMin}
          onChange={handleMinChange}
          className="price-slider price-slider-min"
        />
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={localMax}
          onChange={handleMaxChange}
          className="price-slider price-slider-max"
        />
      </div>
      
      <div className="price-display">
        ${localMin} - ${localMax}
      </div>
    </div>
  );
}

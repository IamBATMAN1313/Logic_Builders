import React from 'react';
import '../css/AvailabilityFilter.css';

export default function AvailabilityFilter({ availability, onChange }) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="availability-filter">
      <h4>Availability</h4>
      <div className="availability-options">
        <label className="availability-option">
          <input
            type="radio"
            name="availability"
            value="all"
            checked={availability === 'all'}
            onChange={handleChange}
          />
          <span className="radio-custom"></span>
          All Products
        </label>
        
        <label className="availability-option">
          <input
            type="radio"
            name="availability"
            value="true"
            checked={availability === 'true'}
            onChange={handleChange}
          />
          <span className="radio-custom"></span>
          In Stock
        </label>
        
        <label className="availability-option">
          <input
            type="radio"
            name="availability"
            value="false"
            checked={availability === 'false'}
            onChange={handleChange}
          />
          <span className="radio-custom"></span>
          Out of Stock
        </label>
      </div>
    </div>
  );
}

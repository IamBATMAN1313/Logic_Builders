import React from 'react';
import '../css/SortFilter.css';

export default function SortFilter({ sortBy, sortOrder, onChange }) {
  const handleSortChange = (e) => {
    const [newSortBy, newSortOrder] = e.target.value.split('-');
    onChange(newSortBy, newSortOrder);
  };

  const currentValue = `${sortBy}-${sortOrder}`;

  return (
    <div className="sort-filter">
      <label htmlFor="sort-select">Sort by:</label>
      <select
        id="sort-select"
        value={currentValue}
        onChange={handleSortChange}
        className="sort-select"
      >
        <option value="date_added-DESC">Newest First</option>
        <option value="date_added-ASC">Oldest First</option>
        <option value="price-ASC">Price: Low to High</option>
        <option value="price-DESC">Price: High to Low</option>
        <option value="name-ASC">Name: A to Z</option>
        <option value="name-DESC">Name: Z to A</option>
      </select>
    </div>
  );
}

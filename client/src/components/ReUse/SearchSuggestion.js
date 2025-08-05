import React from 'react';

export default function SearchSuggestions({ 
  suggestions, 
  loading, 
  onSelect, 
  query,
  selectedIndex = -1 
}) {
  if (!query || query.trim().length < 2) {
    return null;
  }

  return (
    <div className="suggestions-dropdown">
      {loading && (
        <div className="suggestion-item loading">
          <span>Searching...</span>
        </div>
      )}
      
      {!loading && suggestions.length > 0 && suggestions.map((suggestion, index) => (
        <div 
          key={index}
          className={`suggestion-item ${selectedIndex === index ? 'selected' : ''}`}
          onClick={() => onSelect(suggestion)}
        >
          <span>{suggestion.title}</span>
          {suggestion.category && (
            <span className="suggestion-category">{suggestion.category}</span>
          )}
        </div>
      ))}
      
      {!loading && suggestions.length === 0 && query.trim() && (
        <div className="suggestion-item no-results">
          <span>No suggestions found</span>
        </div>
      )}
    </div>
  );
}
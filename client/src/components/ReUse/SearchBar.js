import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/SearchBar.css';
import { fetchMockSuggestions as fetchSuggestions } from './utils/searchAPI';
import { useDebounce } from './hooks/useDebounce';
import { useSearchAPI } from './hooks/useSearchAPI';
import SearchSuggestions from './SearchSuggestion';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };
  // Add these after your existing useState
const [showSuggestions, setShowSuggestions] = useState(false);
const [selectedIndex, setSelectedIndex] = useState(-1);

// Add this for debounced search
const debouncedQuery = useDebounce(query, 300);

// Add this for API calls
const { suggestions, loading, error } = useSearchAPI(debouncedQuery);

// Update your existing onChange handler
const handleInputChange = (e) => {
  const value = e.target.value;
  setQuery(value);
  setShowSuggestions(true);
  setSelectedIndex(-1);
};

// Add this new function
const handleSuggestionClick = (suggestion) => {
  setQuery(suggestion.title);
  setShowSuggestions(false);
  setSelectedIndex(-1);
  // Optionally trigger search immediately
  handleSubmit({ preventDefault: () => {} });
};
  return (
    <>
      {/* Embedded CSS for the SearchBar component */}
      <style>
        {`

.search-bar-card {
  width: 100%;
  max-width: 30.search-bar-card {
  width: 100%;
  max-width: 15 rem; /* Keeping width as you said it's okay */
  background-color: #ffffff;
  padding: 0.8rem; /* Changed: Further reduced padding (was 0.8rem) */
  border-radius: 1.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease-in-out;
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; /* Center align everything */
  box-sizing: border-box;
  margin: 0 auto; /* Center the card */
  animation: fadeInUp 0.8s ease-out;
}

.search-bar-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
}

/* Title styling */
.search-title {
  font-size: 1.5rem; /* Slightly smaller font to save vertical space (was 1.6rem) */
  font-weight: 800;
  color: #1a202c;
  margin-bottom: 1rem; /* Changed: Reduced margin-bottom (was 1.5rem) */
  text-align: center;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Form styling */
.search-form {
  width: 100%;
  max-width: 18rem; /* Keeping this as it's okay for width */
  position: relative;
}

/* Input container styling */
.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
  background-color: #f8fafc;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease-in-out;
  border: 2px solid transparent;
}

.search-input-container:hover {
  background-color: #f1f5f9;
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1);
}

.search-input-container:focus-within {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  background-color: #ffffff;
  transform: scale(1.02);
}

.search-input {
  flex-grow: 1;
  padding: 0.6rem 0.8rem; /* Changed: Reduced padding (was 0.8rem 0.8rem) */
  padding-right: 3.5rem;
  color: #1a202c;
  background-color: transparent;
  outline: none;
  border: none;
  border-top-left-radius: 1.5rem;
  border-bottom-left-radius: 1.5rem;
  font-size: 0.95rem; /* Slightly smaller font */
  font-weight: 500;
  transition: all 0.3s ease-in-out;
}

.search-input::placeholder {
  color: #64748b;
  transition: color 0.3s ease-in-out;
}

.search-input:focus::placeholder {
  color: #94a3b8;
}

/* Search button styling */
.search-button {
  position: absolute;
  right: 4px;
  top: 3px; /* Changed: Adjusted top to align better with reduced input padding */
  bottom: 3px; /* Changed: Adjusted bottom */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 1.25rem;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  cursor: pointer;
  transition: all 0.3s ease-in-out;
  transform: scale(1);
}

.search-button:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
}

.search-button:active {
  transform: scale(0.95);
}

/* Search icon styling */
.search-button svg {
  transition: all 0.3s ease-in-out;
}

.search-button:hover svg {
  transform: scale(1.1);
}

/* Informational text styling */
.info-text {
  margin-top: 1.5rem; /* Changed: Reduced margin-top (was 2rem) */
  text-align: center;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 500;
  opacity: 0.8;
  transition: opacity 0.3s ease-in-out;
}

.search-bar-card:hover .info-text {
  opacity: 1;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .search-bar-card {
    max-width: 90vw;
    padding: 1rem; /* Changed: Reduced padding for mobile */
  }

  .search-title {
    font-size: 1.3rem; /* Further reduced for mobile */
    margin-bottom: 0.8rem;
  }

  .search-form {
    max-width: 100%;
  }

  .search-input {
    padding: 0.6rem 0.8rem; /* Adjusted for mobile */
    font-size: 0.9rem;
  }

  .search-button {
    width: 2.8rem;
    top: 3px; /* Adjusted for mobile */
    bottom: 3px; /* Adjusted for mobile */
  }

  .info-text {
    margin-top: 1rem; /* Adjusted for mobile */
    font-size: 0.7rem; /* Slightly smaller for mobile */
  }
}

/* Animation for smooth loading */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 0.5rem;
}

.suggestion-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f8fafc;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-category {
  font-size: 0.875rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

.suggestion-item.loading {
  color: #64748b;
  cursor: default;
}

.suggestion-item.no-results {
  color: #64748b;
  cursor: default;
  font-style: italic;
}rem; /* Much wider */
  background-color: #ffffff;
  padding: 1rem; /* Increased padding */
  border-radius: 1.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease-in-out;
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; /* Center align everything */
  box-sizing: border-box;
  margin: 0 auto; /* Center the card */
}

.search-bar-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
}

/* Title styling */
.search-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #1a202c;
  margin-bottom: 2rem;
  text-align: center;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Form styling */
.search-form {
  width: 100%;
  max-width: 22rem;
  position: relative /* Wider form */
}

/* Input container styling */
.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
  background-color: #f8fafc;
  border-radius: 1rem; /* More rounded */
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease-in-out;
  border: 2px solid transparent;
}

.search-input-container:hover {
  background-color: #f1f5f9;
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1);
}

.search-input-container:focus-within {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  background-color: #ffffff;
  transform: scale(1.02);
}

.search-input {
  flex-grow: 1;
  padding: 1rem 1rem; /* Increased padding */
  padding-right: 4rem; /* More space for button */
  color: #1a202c;
  background-color: transparent;
  outline: none;
  border: none;
  border-top-left-radius: 1.5rem;
  border-bottom-left-radius: 1.5rem;
  font-size: 1.1rem; /* Larger font */
  font-weight: 500;
  transition: all 0.3s ease-in-out;
}

.search-input::placeholder {
  color: #64748b;
  transition: color 0.3s ease-in-out;
}

.search-input:focus::placeholder {
  color: #94a3b8;
}

/* Search button styling */
.search-button {
  position: absolute;
  right: 4px;
  top: 4px;
  bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem; /* Wider button */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 1.25rem;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  cursor: pointer;
  transition: all 0.3s ease-in-out;
  transform: scale(1);
}

.search-button:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
}

.search-button:active {
  transform: scale(0.95);
}

/* Search icon styling */
.search-button svg {
  transition: all 0.3s ease-in-out;
}

.search-button:hover svg {
  transform: scale(1.1);
}

/* Informational text styling */
.info-text {
  margin-top: 2.5rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 500;
  opacity: 0.8;
  transition: opacity 0.3s ease-in-out;
}

.search-bar-card:hover .info-text {
  opacity: 1;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .search-bar-card {
    max-width: 90vw;
    padding: 2rem;
  }
  
  .search-form {
    max-width: 100%;
  }
  
  .search-input {
    padding: 1rem 1.25rem;
    font-size: 1rem;
  }
  
  .search-button {
    width: 3rem;
  }
}

/* Animation for smooth loading */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 0.5rem;
}

.suggestion-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f8fafc;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-category {
  font-size: 0.875rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

.suggestion-item.loading {
  color: #64748b;
  cursor: default;
}

.suggestion-item.no-results {
  color: #64748b;
  cursor: default;
  font-style: italic;
}
.search-bar-card {
  animation: fadeInUp 0.8s ease-out;
}
        `}
      </style>

      {/* This div now directly represents the "search-bar-card" */}
      <div className="search-bar-card">
             <form onSubmit={handleSubmit} className="search-form">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Discover something exquisite..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="search-input"
              aria-label="Search exquisite products"
            />
            <button
              type="submit"
              className="search-button"
              aria-label="Submit search"
            >
              {/* Inline SVG for the search icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </form>
   {showSuggestions && (
  <SearchSuggestions
    suggestions={suggestions}
    loading={loading}
    onSelect={handleSuggestionClick}
    query={query}
    selectedIndex={selectedIndex}
  />
)}
        {/* Kept the info text for context */}
        
      </div>
    </>
  );
}
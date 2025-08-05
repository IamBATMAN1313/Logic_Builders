// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const fetchSuggestions = async (query) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/search/suggestions?q=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    throw error;
  }
};

// Mock data for testing (remove this when you have real API)
export const mockSuggestions = [
  { title: "iPhone 15 Pro", category: "Electronics" },
  { title: "iPhone 15 Cases", category: "Accessories" },
  { title: "iPhone 15 Screen Protector", category: "Accessories" },
  { title: "iPhone 15 Pro Max", category: "Electronics" },
  { title: "iPhone 15 Charger", category: "Accessories" }
];

// For testing without real API - replace fetchSuggestions with this
export const fetchMockSuggestions = async (query) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const filtered = mockSuggestions.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase())
  );
  
  return filtered;
};
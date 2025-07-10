import { useState, useEffect } from 'react';


import { fetchSuggestions } from '../utils/searchAPI';

export const useSearchAPI = (query) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    const searchSuggestions = async () => {
      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await fetchSuggestions(query);
        
        if (!isCancelled) {
          setSuggestions(results);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message);
          setSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    searchSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [query]);

  return { suggestions, loading, error };
};
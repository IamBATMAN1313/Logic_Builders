import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="theme-toggle-container">
      <span className="theme-icon light-icon">☀️</span>
      <label className="theme-toggle">
        <input
          type="checkbox"
          checked={isDarkMode}
          onChange={toggleTheme}
          className="theme-toggle-input"
        />
        <span className="theme-toggle-slider"></span>
      </label>
      <span className="theme-icon dark-icon">🌙</span>
    </div>
  );
};

export default ThemeToggle;

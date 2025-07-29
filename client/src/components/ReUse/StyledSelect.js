import React from 'react';
import '../css/SpecsFilter.css';

const StyledSelect = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Select an option", 
  className = "",
  name,
  id,
  required = false,
  disabled = false,
  ...rest 
}) => {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className={`spec-select ${className}`}
      required={required}
      disabled={disabled}
      {...rest}
    >
      {placeholder && (
        <option value="">{placeholder}</option>
      )}
      {options.map((option, index) => (
        <option 
          key={option.value || option || index} 
          value={option.value || option}
        >
          {option.label || option}
        </option>
      ))}
    </select>
  );
};

export default StyledSelect;

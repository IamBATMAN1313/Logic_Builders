import React, { useState, useEffect, useCallback } from 'react';
import './DualRangeSlider.css';

const DualRangeSlider = ({ min, max, value, onChange, step = 1 }) => {
  const [minVal, setMinVal] = useState(value ? value[0] : min);
  const [maxVal, setMaxVal] = useState(value ? value[1] : max);

  // Update values when prop changes
  useEffect(() => {
    if (value) {
      setMinVal(value[0]);
      setMaxVal(value[1]);
    }
  }, [value]);

  const handleMinChange = useCallback((e) => {
    const val = Math.min(Number(e.target.value), maxVal - step);
    setMinVal(val);
    onChange([val, maxVal]);
  }, [maxVal, step, onChange]);

  const handleMaxChange = useCallback((e) => {
    const val = Math.max(Number(e.target.value), minVal + step);
    setMaxVal(val);
    onChange([minVal, val]);
  }, [minVal, step, onChange]);

  const handleMinInputChange = useCallback((e) => {
    const val = Math.min(Number(e.target.value) || min, maxVal - step);
    setMinVal(val);
    onChange([val, maxVal]);
  }, [min, maxVal, step, onChange]);

  const handleMaxInputChange = useCallback((e) => {
    const val = Math.max(Number(e.target.value) || max, minVal + step);
    setMaxVal(val);
    onChange([minVal, val]);
  }, [max, minVal, step, onChange]);

  return (
    <div className="dual-range-container" style={{width: '100%', margin: '1rem 0'}}>
      <div className="price-inputs" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
        <input
          type="number"
          placeholder="Min"
          value={minVal}
          onChange={handleMinInputChange}
          min={min}
          max={max}
          className="price-input"
          style={{width: '80px', padding: '0.25rem 0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', textAlign: 'center'}}
        />
        <span className="input-separator" style={{color: '#666', fontWeight: '500'}}>to</span>
        <input
          type="number"
          placeholder="Max"
          value={maxVal}
          onChange={handleMaxInputChange}
          min={min}
          max={max}
          className="price-input"
          style={{width: '80px', padding: '0.25rem 0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', textAlign: 'center'}}
        />
      </div>
      
      <div className="slider-wrapper" style={{position: 'relative', height: '40px', margin: '1rem 0', background: '#f8f9fa', borderRadius: '6px', padding: '17px 0'}}>
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          step={step}
          onChange={handleMinChange}
          className="range-slider range-min"
          style={{
            position: 'absolute',
            top: '17px',
            left: '0',
            width: '100%',
            height: '6px',
            background: 'transparent',
            outline: 'none',
            border: 'none',
            margin: '0',
            padding: '0',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            cursor: 'pointer',
            zIndex: 15
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          step={step}
          onChange={handleMaxChange}
          className="range-slider range-max"
          style={{
            position: 'absolute',
            top: '17px',
            left: '0',
            width: '100%',
            height: '6px',
            background: 'transparent',
            outline: 'none',
            border: 'none',
            margin: '0',
            padding: '0',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            cursor: 'pointer',
            zIndex: 10
          }}
        />
      </div>

      <div className="range-values" style={{display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '14px', color: '#495057', fontWeight: '500'}}>
        <span>${minVal}</span>
        <span>${maxVal}</span>
      </div>
    </div>
  );
};

export default DualRangeSlider;

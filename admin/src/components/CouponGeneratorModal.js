import React, { useState } from 'react';
import './CouponGeneratorModal.css';

const CouponGeneratorModal = ({ isOpen, onClose, onGenerate }) => {
  const [formData, setFormData] = useState({
    base_name: '',
    count: 10,
    type: 'percentage',
    discount_value: '',
    max_uses_per_code: 1,
    min_order_value: '',
    start_date: '',
    end_date: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState([]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Generate preview codes
    if (name === 'base_name' || name === 'count') {
      generatePreview(name === 'base_name' ? value : formData.base_name, 
                     name === 'count' ? parseInt(value) || 0 : formData.count);
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const generatePreview = (baseName, count) => {
    if (!baseName || count <= 0) {
      setPreview([]);
      return;
    }
    
    const previewCodes = [];
    const previewCount = Math.min(count, 5); // Show max 5 in preview
    
    for (let i = 1; i <= previewCount; i++) {
      previewCodes.push(`${baseName}${i.toString().padStart(3, '0')}`);
    }
    
    if (count > 5) {
      previewCodes.push('...');
    }
    
    setPreview(previewCodes);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.base_name.trim()) newErrors.base_name = 'Base name is required';
    if (!formData.count || formData.count <= 0) newErrors.count = 'Count must be greater than 0';
    if (formData.count > 1000) newErrors.count = 'Cannot generate more than 1000 coupons at once';
    if (!formData.discount_value || formData.discount_value <= 0) {
      newErrors.discount_value = 'Discount value must be greater than 0';
    }
    if (formData.type === 'percentage' && formData.discount_value > 100) {
      newErrors.discount_value = 'Percentage discount cannot exceed 100%';
    }
    if (formData.min_order_value && formData.min_order_value < 0) {
      newErrors.min_order_value = 'Minimum order value cannot be negative';
    }
    if (formData.max_uses_per_code && formData.max_uses_per_code <= 0) {
      newErrors.max_uses_per_code = 'Maximum uses per code must be greater than 0';
    }
    if (formData.start_date && formData.end_date && new Date(formData.start_date) >= new Date(formData.end_date)) {
      newErrors.end_date = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await onGenerate(formData);
      onClose();
      // Reset form
      setFormData({
        base_name: '',
        count: 10,
        type: 'percentage',
        discount_value: '',
        max_uses_per_code: 1,
        min_order_value: '',
        start_date: '',
        end_date: ''
      });
      setPreview([]);
    } catch (error) {
      console.error('Error generating coupons:', error);
      setErrors({ submit: 'Failed to generate coupons' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content coupon-generator-modal">
        <div className="modal-header">
          <h2>Generate Bulk Coupon Codes</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="coupon-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="base_name">Base Name *</label>
              <input
                type="text"
                id="base_name"
                name="base_name"
                value={formData.base_name}
                onChange={handleInputChange}
                className={errors.base_name ? 'error' : ''}
                placeholder="e.g. HOLIDAY"
                style={{ textTransform: 'uppercase' }}
              />
              {errors.base_name && <span className="error-text">{errors.base_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="count">Number of Coupons *</label>
              <input
                type="number"
                id="count"
                name="count"
                value={formData.count}
                onChange={handleInputChange}
                className={errors.count ? 'error' : ''}
                min="1"
                max="1000"
              />
              {errors.count && <span className="error-text">{errors.count}</span>}
            </div>
          </div>

          {preview.length > 0 && (
            <div className="preview-section">
              <label>Preview Codes:</label>
              <div className="code-preview">
                {preview.map((code, index) => (
                  <span key={index} className="preview-code">{code}</span>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="type">Discount Type *</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="discount_value">
                Discount Value * 
                {formData.type === 'percentage' ? '(%)' : formData.type === 'fixed_amount' ? '($)' : '(%)'}
              </label>
              <input
                type="number"
                id="discount_value"
                name="discount_value"
                value={formData.discount_value}
                onChange={handleInputChange}
                className={errors.discount_value ? 'error' : ''}
                placeholder={formData.type === 'percentage' ? '15' : '10'}
                step="0.01"
                min="0"
                max={formData.type === 'percentage' ? '100' : undefined}
              />
              {errors.discount_value && <span className="error-text">{errors.discount_value}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="max_uses_per_code">Uses Per Code</label>
              <input
                type="number"
                id="max_uses_per_code"
                name="max_uses_per_code"
                value={formData.max_uses_per_code}
                onChange={handleInputChange}
                className={errors.max_uses_per_code ? 'error' : ''}
                min="1"
              />
              {errors.max_uses_per_code && <span className="error-text">{errors.max_uses_per_code}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="min_order_value">Minimum Order Value ($)</label>
              <input
                type="number"
                id="min_order_value"
                name="min_order_value"
                value={formData.min_order_value}
                onChange={handleInputChange}
                className={errors.min_order_value ? 'error' : ''}
                placeholder="0"
                step="0.01"
                min="0"
              />
              {errors.min_order_value && <span className="error-text">{errors.min_order_value}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_date">Start Date</label>
              <input
                type="datetime-local"
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="end_date">End Date</label>
              <input
                type="datetime-local"
                id="end_date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                className={errors.end_date ? 'error' : ''}
              />
              {errors.end_date && <span className="error-text">{errors.end_date}</span>}
            </div>
          </div>

          {errors.submit && <div className="error-text">{errors.submit}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Generating...' : `Generate ${formData.count} Coupons`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CouponGeneratorModal;

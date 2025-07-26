import React, { useState, useEffect } from 'react';
import './PromotionModal.css';

const PromotionModal = ({ isOpen, onClose, promotion, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    discount_percent: '',
    status: 'active',
    start_date: '',
    end_date: '',
    usage_limit: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (promotion) {
      setFormData({
        name: promotion.name || '',
        code: promotion.code || '',
        discount_percent: promotion.discount_percent || '',
        status: promotion.status || 'active',
        start_date: promotion.start_date ? new Date(promotion.start_date).toISOString().slice(0, 16) : '',
        end_date: promotion.end_date ? new Date(promotion.end_date).toISOString().slice(0, 16) : '',
        usage_limit: promotion.usage_limit || ''
      });
    } else {
      // Reset form for new promotion
      setFormData({
        name: '',
        code: '',
        discount_percent: '',
        status: 'active',
        start_date: '',
        end_date: '',
        usage_limit: ''
      });
    }
    setErrors({});
  }, [promotion, isOpen]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Promotion name is required';
    if (!formData.code.trim()) newErrors.code = 'Promotion code is required';
    if (!formData.status) newErrors.status = 'Promotion status is required';
    if (!formData.discount_percent || formData.discount_percent <= 0) {
      newErrors.discount_percent = 'Discount percent must be greater than 0';
    }
    if (formData.discount_percent > 100) {
      newErrors.discount_percent = 'Discount percent cannot exceed 100%';
    }
    if (formData.usage_limit && formData.usage_limit <= 0) {
      newErrors.usage_limit = 'Usage limit must be greater than 0';
    }
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }
    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
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
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving promotion:', error);
      setErrors({ submit: 'Failed to save promotion' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content promotion-modal">
        <div className="modal-header">
          <h2>{promotion ? 'Edit Promotion' : 'Create New Promotion'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="promotion-form">
          <div className="form-group">
            <label htmlFor="name">Promotion Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={errors.name ? 'error' : ''}
              placeholder="e.g. Winter Sale 2024"
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="code">Promotion Code *</label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              className={errors.code ? 'error' : ''}
              placeholder="e.g. WINTER25"
              style={{ textTransform: 'uppercase' }}
            />
            {errors.code && <span className="error-text">{errors.code}</span>}
          </div>

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
              <label htmlFor="status">Promotion Status *</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className={errors.status ? 'error' : ''}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="discount_percent">
                Discount Percentage * (%)
              </label>
              <input
                type="number"
                id="discount_percent"
                name="discount_percent"
                value={formData.discount_percent}
                onChange={handleInputChange}
                className={errors.discount_percent ? 'error' : ''}
                placeholder="25"
                step="0.01"
                min="0"
                max="100"
              />
              {errors.discount_percent && <span className="error-text">{errors.discount_percent}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="usage_limit">Maximum Uses</label>
              <input
                type="number"
                id="usage_limit"
                name="usage_limit"
                value={formData.usage_limit}
                onChange={handleInputChange}
                className={errors.usage_limit ? 'error' : ''}
                placeholder="Leave empty for unlimited"
                min="1"
              />
              {errors.usage_limit && <span className="error-text">{errors.usage_limit}</span>}
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
              {isLoading ? 'Saving...' : (promotion ? 'Update Promotion' : 'Create Promotion')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromotionModal;

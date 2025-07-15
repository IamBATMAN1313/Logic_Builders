import React, { useState, useEffect } from 'react';
import './PromotionModal.css';

const PromotionModal = ({ isOpen, onClose, promotion, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'percentage',
    discount_value: '',
    max_uses: '',
    min_order_value: '',
    start_date: '',
    end_date: '',
    description: '',
    is_active: true
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (promotion) {
      setFormData({
        name: promotion.name || '',
        code: promotion.code || '',
        type: promotion.type || 'percentage',
        discount_value: promotion.discount_value || '',
        max_uses: promotion.max_uses || '',
        min_order_value: promotion.min_order_value || '',
        start_date: promotion.start_date ? new Date(promotion.start_date).toISOString().slice(0, 16) : '',
        end_date: promotion.end_date ? new Date(promotion.end_date).toISOString().slice(0, 16) : '',
        description: promotion.description || '',
        is_active: promotion.is_active !== undefined ? promotion.is_active : true
      });
    } else {
      // Reset form for new promotion
      setFormData({
        name: '',
        code: '',
        type: 'percentage',
        discount_value: '',
        max_uses: '',
        min_order_value: '',
        start_date: '',
        end_date: '',
        description: '',
        is_active: true
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
    if (!formData.discount_value || formData.discount_value <= 0) {
      newErrors.discount_value = 'Discount value must be greater than 0';
    }
    if (formData.type === 'percentage' && formData.discount_value > 100) {
      newErrors.discount_value = 'Percentage discount cannot exceed 100%';
    }
    if (formData.min_order_value && formData.min_order_value < 0) {
      newErrors.min_order_value = 'Minimum order value cannot be negative';
    }
    if (formData.max_uses && formData.max_uses <= 0) {
      newErrors.max_uses = 'Maximum uses must be greater than 0';
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
                placeholder={formData.type === 'percentage' ? '25' : '20'}
                step="0.01"
                min="0"
                max={formData.type === 'percentage' ? '100' : undefined}
              />
              {errors.discount_value && <span className="error-text">{errors.discount_value}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="max_uses">Maximum Uses</label>
              <input
                type="number"
                id="max_uses"
                name="max_uses"
                value={formData.max_uses}
                onChange={handleInputChange}
                className={errors.max_uses ? 'error' : ''}
                placeholder="Leave empty for unlimited"
                min="1"
              />
              {errors.max_uses && <span className="error-text">{errors.max_uses}</span>}
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

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Promotion description..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
              />
              Active Promotion
            </label>
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

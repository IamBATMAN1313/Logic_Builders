import React, { useState } from 'react';

const AdminSignup = () => {
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    department: '',
    position: '',
    reason_for_access: '',
    requested_clearance: 'INVENTORY_MANAGER'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const clearanceLevels = [
    { value: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
    { value: 'PRODUCT_EXPERT', label: 'Product Expert' },
    { value: 'ORDER_MANAGER', label: 'Order Manager' },
    { value: 'PROMO_MANAGER', label: 'Promotion Manager' },
    { value: 'ANALYTICS', label: 'Analytics' }
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/signup-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: formData.employee_id,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          department: formData.department,
          position: formData.position,
          reason_for_access: formData.reason_for_access,
          requested_clearance: formData.requested_clearance
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.message || 'Signup request failed');
      }
    } catch (error) {
      console.error('Signup request error:', error);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-container">
        <div className="login-form" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ color: '#2ecc71', marginBottom: '1rem' }}>Request Submitted!</h2>
          <p style={{ marginBottom: '2rem', color: '#7f8c8d' }}>
            Your admin access request has been submitted successfully. 
            A General Manager will review your request and notify you of the decision.
          </p>
          <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '5px', marginBottom: '2rem' }}>
            <strong>What happens next?</strong>
            <ul style={{ textAlign: 'left', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>Your request will be reviewed by a General Manager</li>
              <li>You'll receive an email notification with the decision</li>
              <li>If approved, you'll be able to login with your credentials</li>
            </ul>
          </div>
          <a 
            href="/admin" 
            style={{ 
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3498db',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '5px'
            }}
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form" style={{ maxWidth: '500px', width: '90%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>Request Admin Access</h1>
          <p style={{ color: '#7f8c8d' }}>Submit a request to become a LogicBuilders admin</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="employee_id">Employee ID *</label>
            <input
              type="text"
              id="employee_id"
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              placeholder="e.g., EMP002"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your full name"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your.email@company.com"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Choose a secure password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1-555-123-4567"
            />
          </div>

          <div className="form-group">
            <label htmlFor="department">Department *</label>
            <input
              type="text"
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              placeholder="e.g., IT, Sales, Marketing"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="position">Position/Job Title *</label>
          <input
            type="text"
            id="position"
            name="position"
            value={formData.position}
            onChange={handleChange}
            placeholder="e.g., Senior Developer, Marketing Manager"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="requested_clearance">Requested Access Level *</label>
          <select
            id="requested_clearance"
            name="requested_clearance"
            value={formData.requested_clearance}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '1rem'
            }}
          >
            {clearanceLevels.map(level => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
          <small style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>
            Choose the access level you need for your role
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="reason_for_access">Reason for Admin Access *</label>
          <textarea
            id="reason_for_access"
            name="reason_for_access"
            value={formData.reason_for_access}
            onChange={handleChange}
            placeholder="Explain why you need admin access and how you'll use it..."
            required
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '1rem',
              resize: 'vertical'
            }}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
          style={{ marginBottom: '1rem' }}
        >
          {loading ? 'Submitting Request...' : 'Submit Admin Request'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <a 
            href="/admin" 
            style={{ color: '#3498db', textDecoration: 'none' }}
          >
            Already have admin access? Login here
          </a>
        </div>
      </form>
    </div>
  );
};

export default AdminSignup;

import React, { useState } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const Login = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(employeeId, password);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>LogicBuilders Admin</h1>
          <p style={{ color: '#7f8c8d' }}>Sign in to access the admin dashboard</p>
        </div>

        <div className="form-group">
          <label htmlFor="employeeId">Employee ID</label>
          <input
            type="text"
            id="employeeId"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="Enter your employee ID"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: '#7f8c8d' }}>
          For demo purposes, use Employee ID: <strong>EMP001</strong>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <span style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>
            Need admin access? 
          </span>
          <a 
            href="/admin/signup" 
            style={{ 
              color: '#3498db', 
              textDecoration: 'none', 
              marginLeft: '0.5rem',
              fontWeight: 'bold'
            }}
          >
            Request Access
          </a>
        </div>
      </form>
    </div>
  );
};

export default Login;

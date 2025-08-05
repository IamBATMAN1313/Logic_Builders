import React, { useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import '../css/FormStyles.css'; 


export default function LoginForm() {
  const { login } = useContext(AuthContext);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setErr('');
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setErr('Invalid credentials');
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Log In</h2>
      <div className="form-group">
        <label>
          Username or Email <span className="required">*</span>
          <input
            placeholder="Username or Email"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="form-group">
        <label>
          Password <span className="required">*</span>
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
      </div>
      <button className="auth-btn" type="submit">Log In</button>
      <p>
        Don't have an account?{' '}
        <Link to="/signup" className="link-btn">Sign Up</Link>
      </p>
      {err && <p className="error">{err}</p>}
    </form>
  );
}

import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export default function LoginForm({ toggle }) {
  const { login } = useContext(AuthContext);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]  = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await login(identifier, password);
    } catch {
      setErr('Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Log In</h2>
      <input
        placeholder="Username or Email"
        value={identifier}
        onChange={e => setIdentifier(e.target.value)}
        required
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit">Log In</button>
      <p>
        Don't have an account?{' '}
        <button type="button" onClick={toggle}>
          Sign Up
        </button>
      </p>
      {err && <p style={{ color: 'red' }}>{err}</p>}
    </form>
  );
}

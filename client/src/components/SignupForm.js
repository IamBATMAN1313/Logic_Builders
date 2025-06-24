import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export default function SignupForm({ toggle }) {
  const { signup } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [email,  setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [contact,  setContact]  = useState('');
  const [fullName, setFullName] = useState('');
  const [gender,   setGender]   = useState('');
  const [err,  setErr]  = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await signup(
        {username, email, password, contact_no: contact, full_name: fullName, gender});
      toggle(); 
    } catch (err) {
        console.error('Signup error response:', err.response);
        setErr(err.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign Up</h2>
      <input
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
      />
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <input
        placeholder="Contact No"
        value={contact}
        onChange={e => setContact(e.target.value)}
      />
      <input
        placeholder="Full Name"
        value={fullName}
        onChange={e => setFullName(e.target.value)}
        required
      />
      <input
        placeholder="Gender"
        value={gender}
        onChange={e => setGender(e.target.value)}
      />
      <button type="submit">Sign Up</button>
      <p>
        Already have an account?{' '}
        <button type="button" onClick={toggle}>
          Log In
        </button>
      </p>
      {err && <p style={{ color: 'red' }}>{err}</p>}
    </form>
  );
}

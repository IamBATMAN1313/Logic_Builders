import React, { useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import '../css/FormStyles.css';
import '../css/SpecsFilter.css'; // Import for spec-select class
import '../css/SpecsFilter.css'; // Import for spec-select class

export default function SignupForm() {
  const { signup } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [contact, setContact] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setErr('');
    if (password !== confirmPassword) {
      setErr('Passwords do not match');
      return;
    }
    try {
      await signup({
        username,
        email,
        password,
        contact_no: contact,
        full_name: fullName,
        gender
      });
      navigate('/');
    } catch (err) {
      setErr(err.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Sign Up</h2>
      <div className="form-group">
        <label>
          Username <span className="required">*</span>
          <input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="form-group">
        <label>
          Email <span className="required">*</span>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
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
      <div className="form-group">
        <label>
          Confirm Password <span className="required">*</span>
          <input
            placeholder="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="form-group">
        <label>
          Contact No
          <input
            placeholder="Contact No"
            value={contact}
            onChange={e => setContact(e.target.value)}
          />
        </label>
      </div>
      <div className="form-group">
        <label>
          Full Name <span className="required">*</span>
          <input
            placeholder="Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="form-group">
        <label>
          Gender
          <select
            value={gender}
            onChange={e => setGender(e.target.value)}
            className="spec-select"
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
      </div>
      <button className="auth-btn" type="submit">Sign Up</button>
      <p>
        Already have an account?{' '}
        <Link to="/login" className="link-btn">Log In</Link>
      </p>
      {err && <p className="error">{err}</p>}
    </form>
  );
}

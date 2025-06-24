import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // On mount, check for stored token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const { userId, username, exp } = jwtDecode(token);
      if (Date.now() < exp * 1000) setUser({ userId, username });
      else localStorage.removeItem('token');
    }
  }, []);

  const login = async (identifier, password) => {
    const { data } = await api.post('/api/login', { identifier, password });
    localStorage.setItem('token', data.token);
    const { userId, username } = jwtDecode(data.token);
    setUser({ userId, username });
  };

   const signup = async ({ username, email, password, contact_no, full_name, gender }) => {
   await api.post('/api/signup', { username, email, password, contact_no, full_name, gender });}


  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

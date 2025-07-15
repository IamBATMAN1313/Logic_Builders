import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api';

export const AuthContext = createContext();

export function AuthContextProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const { exp, userId, username } = jwtDecode(token);
        if (Date.now() < exp * 1000) {
          setUser({ userId, username });
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Error decoding token:', error);
        localStorage.removeItem('token');
      }
    }
  }, []);

  const login = async (identifier, password) => {
    try {
      const { data } = await api.post('/auth/login', { identifier, password });
      localStorage.setItem('token', data.token);
      const { userId, username } = jwtDecode(data.token);
      setUser({ userId, username });
      return data;
    } catch (error) {
      throw error;
    }
  };

  const signup = async ({ username, email, password, contact_no, full_name, gender }) => {
    try {
      const response = await api.post('/auth/signup', { 
        username, 
        email, 
        password, 
        contact_no, 
        full_name, 
        gender 
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

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

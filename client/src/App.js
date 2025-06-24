// client/src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

import Header       from './components/Header';
import Homepage     from './components/Homepage';
import ProductPage  from './components/ProductPage';
import LoginForm    from './components/LoginForm';
import SignupForm   from './components/SignupForm';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* this Header shows login/signup or user info */}
        <Header />

        {/* these Routes control which “page” you see */}
        <Routes>
          <Route path="/"           element={<Homepage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/login"      element={<LoginForm />} />
          <Route path="/signup"     element={<SignupForm />} />
          {/* you can add more routes here later */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

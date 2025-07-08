import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

import Header       from './components/Layout/Header';
import Homepage     from './components/Layout/Homepage';
import ProductPage  from './components/Products/ProductPage';
import SearchResults from './components/Products/SearchResults';
import LoginForm    from './components/Authentication/LoginForm';
import SignupForm   from './components/Authentication/SignupForm';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Header for login/signup/info */}
        <Header />

        {/* these Routes control which “page” we see, will add one by one */}
        <Routes>
          <Route path="/"           element={<Homepage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/search"     element={<SearchResults />} />
          <Route path="/login"      element={<LoginForm />} />
          <Route path="/signup"     element={<SignupForm />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

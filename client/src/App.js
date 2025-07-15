import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthContextProvider } from './contexts/AuthContext';

import Header       from './components/Layout/Header';
import Homepage     from './components/Layout/Homepage';
import ProductPage  from './components/Products/ProductPage';
import SearchResults from './components/Products/SearchResults';
import CategoriesPage from './components/Products/CategoriesPage';
import CategoryProducts from './components/Products/CategoryProducts';
import LoginForm    from './components/Authentication/LoginForm';
import SignupForm   from './components/Authentication/SignupForm';

// Account Components
import AccountLayout from './components/Account/AccountLayout';
import Orders from './components/Account/Orders';
import Cart from './components/Account/Cart';
import Builds from './components/Account/Builds';
import Reviews from './components/Account/Reviews';
import Vouchers from './components/Account/Vouchers';
import Settings from './components/Account/Settings';

export default function App() {
  return (
    <AuthContextProvider>
      <BrowserRouter>
        {/* Header for login/signup/info */}
        <Header />

        {/* these Routes control which “page” we see, will add one by one */}
        <Routes>
          <Route path="/"               element={<Homepage />} />
          <Route path="/product/:id"    element={<ProductPage />} />
          <Route path="/search"         element={<SearchResults />} />
          <Route path="/categories"     element={<CategoriesPage />} />
          <Route path="/category/:id"   element={<CategoryProducts />} />
          <Route path="/login"          element={<LoginForm />} />
          <Route path="/signup"         element={<SignupForm />} />
          
          {/* Account Routes */}
          <Route path="/account" element={<AccountLayout />}>
            <Route path="orders" element={<Orders />} />
            <Route path="cart" element={<Cart />} />
            <Route path="builds" element={<Builds />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="vouchers" element={<Vouchers />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContextProvider>
  );
}

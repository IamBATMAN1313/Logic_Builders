import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminAuth } from './contexts/AdminAuthContext';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import AdminSignup from './pages/AdminSignup';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Promotions from './pages/Promotions';
import Analytics from './pages/Analytics';
import AdminManagement from './pages/AdminManagement';

function App() {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem' 
      }}>
        Loading...
      </div>
    );
  }

  if (!admin) {
    return (
      <Routes>
        <Route path="/signup" element={<AdminSignup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/products" element={<Products />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/admin-management" element={<AdminManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminLayout>
  );
}

export default App;

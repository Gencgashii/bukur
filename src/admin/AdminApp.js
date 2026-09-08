import React, { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, setCsrf, setAuthLostHandler } from './api';
import AdminLayout from './AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProductsList from './pages/ProductsList';
import ProductForm from './pages/ProductForm';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Payments from './pages/Payments';
import Customers from './pages/Customers';
import Categories from './pages/Categories';
import Settings from './pages/Settings';
import './admin.css';

export default function AdminApp() {
  const [auth, setAuth] = useState({ status: 'checking', admin: null });

  const bootstrap = useCallback(async () => {
    try {
      const s = await api.session();
      setCsrf(s.csrfToken);
      setAuth({ status: 'in', admin: s.admin });
    } catch {
      setCsrf('');
      setAuth({ status: 'out', admin: null });
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);
  useEffect(() => {
    setAuthLostHandler(() => setAuth({ status: 'out', admin: null }));
  }, []);

  const onLoggedIn = (admin) => setAuth({ status: 'in', admin });
  const onLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setCsrf('');
    setAuth({ status: 'out', admin: null });
  };

  if (auth.status === 'checking') {
    return <div className="ad-boot">Loading BUKUR admin…</div>;
  }
  if (auth.status === 'out') {
    return <Login onLoggedIn={onLoggedIn} />;
  }

  return (
    <AdminLayout admin={auth.admin} onLogout={onLogout}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductsList />} />
        <Route path="products/new" element={<ProductForm mode="new" />} />
        <Route path="products/:id/edit" element={<ProductForm mode="edit" />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="customers" element={<Customers />} />
        <Route path="categories" element={<Categories />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}

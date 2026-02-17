// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { CartProvider, useCart } from '@/context/CartContext';

import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import AdminDashboard from '@/pages/AdminDashboard';
import VendorDashboard from '@/pages/VendorDashboard';
import CatalogPage from '@/pages/CatalogPage';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShoppingCart from '@/components/ShoppingCart';

import '@/styles/theme.css';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const DashboardRouter = () => {
  const { user } = useSupabaseAuth();
  const role = user?.tipo_usuario?.toLowerCase() || '';

  if (role.includes('admin') || role.includes('gestor')) return <Navigate to="/admin" replace />;
  if (role.includes('vendedor') || role.includes('representante')) return <Navigate to="/vendedor" replace />;
  return <Navigate to="/catalog" replace />;
};

const Layout = () => {
  const { isCartOpen, setIsCartOpen } = useCart();

  return (
    <div className="min-h-screen flex flex-col bg-black text-gray-200 font-sans">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
    </div>
  );
};

export default function App() {
  return (
    <SupabaseAuthProvider>
      <CartProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="catalog" element={<CatalogPage />} />

              <Route
                path="dashboard"
                element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>}
              />

              <Route
                path="vendedor"
                element={<ProtectedRoute><VendorDashboard /></ProtectedRoute>}
              />

              <Route
                path="admin"
                element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>}
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster />
        </Router>
      </CartProvider>
    </SupabaseAuthProvider>
  );
}

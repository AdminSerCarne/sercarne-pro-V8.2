import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { CartProvider, useCart } from "@/context/CartContext";

import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import VendorDashboard from "@/pages/VendorDashboard";
import CatalogPage from "@/pages/CatalogPage";
import ConfirmacaoPedidoPublica from "@/pages/ConfirmacaoPedidoPublica";
import { resolveHomeRoute, resolveUserRole } from "@/domain/accessProfile";

import "@/styles/theme.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShoppingCart from "@/components/ShoppingCart";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, loading, user } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles.length > 0) {
    const currentRole = resolveUserRole(user);
    if (!allowedRoles.includes(currentRole)) {
      return <Navigate to={resolveHomeRoute(user)} replace />;
    }
  }

  return children;
};

const DashboardRedirect = () => {
  const { user } = useSupabaseAuth();
  return <Navigate to={resolveHomeRoute(user)} replace />;
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
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/confirmacao/:orderId/:token" element={<ConfirmacaoPedidoPublica />} />
            <Route path="/confirmar/:orderId/:token" element={<ConfirmacaoPedidoPublica />} />

            {/* Layout wrapper */}
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />

              {/* Catalog público */}
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="cliente" element={<Navigate to="/catalog" replace />} />

              {/* Rotas que teu LoginPage usa */}
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="vendedor"
                element={
                  <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                    <VendorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="gestorcomercial"
                element={
                  <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                    <VendorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="supervisor"
                element={
                  <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                    <VendorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="producao"
                element={
                  <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                    <VendorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="transferencias"
                element={
                  <ProtectedRoute>
                    <CatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="transferencia"
                element={<Navigate to="/transferencias" replace />}
              />
              <Route
                path="cliente_B2B"
                element={
                  <ProtectedRoute>
                    <CatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="cliente_b2b"
                element={<Navigate to="/cliente_B2B" replace />}
              />
              <Route
                path="cliente_B2C"
                element={
                  <ProtectedRoute>
                    <CatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="cliente_b2c"
                element={<Navigate to="/cliente_B2C" replace />}
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster />
        </Router>
      </CartProvider>
    </SupabaseAuthProvider>
  );
}

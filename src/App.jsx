import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider, useCart } from "@/context/CartContext";

import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import VendorDashboard from "@/pages/VendorDashboard";
import CatalogPage from "@/pages/CatalogPage";

import "@/styles/theme.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShoppingCart from "@/components/ShoppingCart";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
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
    <AuthProvider>
      <SupabaseAuthProvider>
        <CartProvider>
          <Router>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Layout wrapper */}
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />

                {/* Catalog público */}
                <Route path="catalog" element={<CatalogPage />} />

                {/* Rotas que teu LoginPage usa */}
                <Route
                  path="vendedor"
                  element={
                    <ProtectedRoute>
                      <VendorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin"
                  element={
                    <ProtectedRoute>
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
    </AuthProvider>
  );
}

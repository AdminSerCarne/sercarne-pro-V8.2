
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { AuthProvider } from '@/context/AuthContext'; 
import { CartProvider, useCart } from '@/context/CartContext';

// Pages
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import AdminDashboard from '@/pages/AdminDashboard';
import VendorDashboard from '@/pages/VendorDashboard';
import CatalogPage from '@/pages/CatalogPage';
import '@/styles/theme.css';

// Components
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShoppingCart from '@/components/ShoppingCart';

// --- Internal Components for Routing Structure ---

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useSupabaseAuth();
  
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
    </div>
  );
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const DashboardRouter = () => {
  const { user } = useSupabaseAuth();
  const role = user?.tipo_usuario?.toLowerCase() || '';

  if (role.includes('admin') || role.includes('gestor')) return <AdminDashboard />;
  if (role.includes('vendedor') || role.includes('representante')) return <VendorDashboard />;
  
  return <Navigate to="/catalog" replace />;
};

// Main Layout wrapping Header, Footer and Page Content
const Layout = () => {
  // Use context for cart state to control sidebar visibility globally
  const { isCartOpen, setIsCartOpen } = useCart();

  return (
    <div className="min-h-screen flex flex-col bg-black text-gray-200 font-sans">
      {/* Universal Header */}
      <Header />
      
      {/* Page Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Universal Footer */}
      <Footer />

      {/* Global Shopping Cart Sidebar - Available on all pages in Layout */}
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SupabaseAuthProvider>
        <CartProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Wrapped Routes (All have Header/Footer) */}
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                
                {/* Catalog is PUBLIC and accessible WITHOUT authentication */}
                <Route path="catalog" element={<CatalogPage />} />
                
                {/* Protected Routes */}
                <Route path="dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
                <Route path="vendor-dashboard" element={<ProtectedRoute><VendorDashboard /></ProtectedRoute>} />
                <Route path="admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              </Route>

              {/* Redirects */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
          </Router>
        </CartProvider>
      </SupabaseAuthProvider>
    </AuthProvider>
  );
}

export default App;

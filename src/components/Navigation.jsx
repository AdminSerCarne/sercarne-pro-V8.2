import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, ShoppingCart, LogOut, BarChart3, Package, Menu, X, LogIn } from 'lucide-react';
console.log("[Navigation] ARQUIVO CARREGADO (topo do module)");
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { Button } from '@/components/ui/button';

const Navigation = () => {
  console.log("[Navigation] COMPONENTE RENDERIZOU");
  const navigate = useNavigate();
  const location = useLocation();
  //const { user, logout, isAdmin, isVendor, isPublic, isAuthenticated } = useAuth();
  const { user, logout, isAuthenticated } = useSupabaseAuth();
  
  const roleRaw = user?.tipo_de_Usuario ?? user?.tipo_usuario ?? user?.role ?? "";
  const role = String(roleRaw).trim().toLowerCase();
  
  const isAdmin = role === "admin" || user?.app_login === "/admin";
  const isVendor = role === "vendedor" || user?.app_login === "/vendedor";
  const isPublic = !isAuthenticated;
  
  console.log("[Navigation] user =", user);
  console.log("[Navigation] roleRaw/role =", { roleRaw, role });
  console.log("[Navigation] flags =", { isAuthenticated, isPublic, isAdmin, isVendor });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  if (isAuthenticated && !user) {
    return null; // ou um placeholder simples
  }
  const menuItems = [
    ...(isAdmin ? [
      { icon: BarChart3, label: 'Dashboard', path: '/admin' },
      { icon: Package, label: 'Pedidos', path: '/admin' },
    ] : []),
    ...(isVendor ? [
      { icon: Home, label: 'Dashboard', path: '/dashboard' },
    ] : []),
    ...(isPublic || (!isAuthenticated) ? [
      { icon: Package, label: 'Catálogo', path: '/cliente' },
    ] : []),
  ];

  console.log("[Navigation] isVendor =", isVendor);

  return (
    <nav className="bg-[#1a1a1a] text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo Section */}
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center transform rotate-3 hover:rotate-0 transition-all duration-300">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold tracking-tight text-white">SISTEMA<span className="text-[#FF8C42]">VENDAS</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Schlosser Pro V9</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-[#FF8C42]' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-4 h-4 mr-2 ${isActive ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* User Profile & Actions */}
          <div className="hidden md:flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{user?.usuario || user?.name}</p>
                  <p className="text-xs text-[#FF8C42] uppercase font-bold tracking-wider">
                    {user?.role || user?.tipo_de_Usuario || (user?.app_login === "/vendedor" ? "Vendedor" : "")}
                  </p>
                </div>
                <div className="h-8 w-px bg-gray-700"></div>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="text-gray-300 hover:text-[#FF8C42] hover:bg-gray-800"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                className="bg-[#FF8C42] hover:bg-[#E67E22] text-white border-none"
              >
                <LogIn className="w-4 h-4 mr-2" /> Login
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-300 hover:text-white p-2"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#2d2d2d] border-t border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
                className={`flex w-full items-center px-3 py-4 rounded-md text-base font-medium ${
                  location.pathname === item.path
                    ? 'bg-gray-900 text-[#FF8C42]'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            ))}
            <div className="border-t border-gray-700 pt-4 mt-4">
              {isAuthenticated ? (
                <div className="flex items-center px-3">
                  <div className="ml-3">
                    <div className="text-base font-medium leading-none text-white">{user?.name}</div>
                    <div className="text-sm font-medium leading-none text-gray-400 mt-1">{user?.role}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="ml-auto bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center px-3 py-3 bg-[#FF8C42] text-white rounded-lg font-bold"
                >
                  <LogIn className="w-5 h-5 mr-2" /> Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;

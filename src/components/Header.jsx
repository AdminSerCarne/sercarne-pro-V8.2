import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, Menu, X, LogOut, User, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { resolveHomeRoute, resolveUserRole } from '@/domain/accessProfile';

const Header = () => {
  const { user, login, logout } = useSupabaseAuth();
  const { cartItems, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { toast } = useToast();

  // Inline Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantidade, 0);

  const handleInlineLogin = async (e) => {
      e.preventDefault();
      if (!loginEmail || !loginPassword) {
          toast({
              title: "Campos vazios",
              description: "Por favor, preencha seu e-mail e senha.",
              variant: "destructive"
          });
          return;
      }
      
      setIsLoggingIn(true);
      try {
          const result = await login(loginEmail, loginPassword);
          if (!result?.success) {
              toast({
                  title: "Falha no login",
                  description: result?.error || "Verifique suas credenciais e tente novamente.",
                  variant: "destructive"
              });
          } else {
             // Successful login
             setLoginEmail('');
             setLoginPassword('');
             setIsMobileMenuOpen(false);
          }
      } catch (err) {
          console.error(err);
      } finally {
          setIsLoggingIn(false);
      }
  };

  const getNavLinks = () => {
    const links = [
      { name: 'Início', path: '/' },
      { name: 'Catálogo', path: '/catalog' },
    ];

    if (user) {
        const role = resolveUserRole(user);
        const homeRoute = resolveHomeRoute(user);

        if (homeRoute !== '/catalog') {
             links.push({ name: 'Dashboard', path: homeRoute });
        }
        
        if (role === 'admin') {
             links.push({ name: 'Admin', path: '/admin' });
        }
    }

    return links;
  };

  const navLinks = getNavLinks();
  const isActive = (path) => location.pathname === path;
  const LOGO_URL = "https://horizons-cdn.hostinger.com/f5e592ff-4b11-4a06-90fa-42f9bf225481/e979c9ad073c28cd8ccd3102f1dd9c56.jpg";

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24 gap-4">
          
          {/* Logo Area */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="group flex items-center gap-2">
              <div className="bg-black p-2 rounded-md">
                <img 
                  src={LOGO_URL} 
                  alt="Schlosser Logo" 
                  className="h-12 w-auto md:h-16 object-contain"
                />
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8 items-center flex-shrink-0">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`text-sm uppercase tracking-widest font-medium transition-colors duration-300 hover:text-[#FF6B35] relative group font-sans ${
                  isActive(link.path) ? 'text-[#FF6B35]' : 'text-gray-300'
                }`}
              >
                {link.name}
                <span className={`absolute -bottom-1 left-0 w-0 h-0.5 bg-[#FF6B35] transition-all duration-300 group-hover:w-full ${isActive(link.path) ? 'w-full' : ''}`}></span>
              </Link>
            ))}
          </nav>

          {/* Actions Area */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            
            {/* Desktop Inline Login / User Area */}
            <div className="hidden lg:flex items-center">
                {user ? (
                    <div className="flex items-center gap-4 animate-in fade-in">
                         <div className="text-right">
                            <p className="text-xs text-[#FF6B35] uppercase tracking-widest">Bem-vindo</p>
                            <p className="text-sm font-medium text-white font-sans truncate max-w-[150px]">{user.usuario}</p>
                         </div>
                         <div className="h-8 w-[1px] bg-white/10"></div>
                         <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={logout}
                            className="text-gray-300 hover:text-red-400 hover:bg-white/5"
                            title="Sair"
                         >
                            <LogOut className="w-5 h-5" />
                         </Button>
                    </div>
                ) : (
                    <form onSubmit={handleInlineLogin} className="flex items-center gap-2 animate-in fade-in">
                        <Input 
                            type="text" 
                            placeholder="Email ou Usuário" 
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="h-9 w-44 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#FF6B35] focus:ring-[#FF6B35] text-xs"
                        />
                        <Input 
                            type="password" 
                            placeholder="Senha" 
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="h-9 w-32 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#FF6B35] focus:ring-[#FF6B35] text-xs"
                        />
                        <Button 
                            type="submit" 
                            disabled={isLoggingIn}
                            className="h-9 bg-[#FF6B35] hover:bg-[#e55a2b] text-white text-xs px-4 font-bold"
                        >
                            {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENTRAR"}
                        </Button>
                    </form>
                )}
            </div>

            {/* Cart Button */}
            <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-300 hover:text-[#FF6B35] hover:bg-white/5 relative"
                onClick={() => setIsCartOpen(true)}
             >
                <ShoppingCart className="w-6 h-6 md:w-5 md:h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF6B35] text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
             </Button>

             {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-300 hover:text-white focus:outline-none md:hidden"
            >
              {isMobileMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a0a] border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block text-lg font-medium uppercase tracking-wider font-sans ${
                    isActive(link.path) ? 'text-[#FF6B35]' : 'text-gray-300'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              
              <div className="border-t border-white/10 pt-4 mt-4">
                {user ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FF6B35] flex items-center justify-center text-white">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.usuario}</p>
                        <p className="text-xs text-gray-500">Conectado</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                      className="text-red-400 hover:text-red-300 hover:bg-white/5"
                    >
                      Sair
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                     <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">Acesso ao Sistema</p>
                     <form onSubmit={handleInlineLogin} className="space-y-3">
                        <Input 
                            type="text" 
                            placeholder="Email / Usuário" 
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="w-full bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#FF6B35] focus:ring-[#FF6B35] text-sm"
                        />
                        <Input 
                            type="password" 
                            placeholder="Senha" 
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                             className="w-full bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#FF6B35] focus:ring-[#FF6B35] text-sm"
                        />
                        <Button 
                            type="submit" 
                            disabled={isLoggingIn}
                            className="w-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] font-bold"
                        >
                             {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                             ENTRAR
                        </Button>
                     </form>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;

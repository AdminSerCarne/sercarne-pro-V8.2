
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { schlosserApi } from '@/services/schlosserApi';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [clientData, setClientData] = useState(null); // For authenticated client/vendor
  const [publicCity, setPublicCity] = useState(null); // For public user
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = () => {
    try {
      const storedAuth = localStorage.getItem('schlosser_auth');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        if (Date.now() - (parsed.timestamp || 0) < 24 * 60 * 60 * 1000) {
          setUser(parsed);
        } else {
          localStorage.removeItem('schlosser_auth');
        }
      }
      
      const storedClient = localStorage.getItem('schlosser_client_data');
      if (storedClient) setClientData(JSON.parse(storedClient));

      const storedCity = localStorage.getItem('schlosser_public_city');
      if (storedCity) setPublicCity(JSON.parse(storedCity));

    } catch (error) {
      localStorage.removeItem('schlosser_auth');
    } finally {
      setLoading(false);
    }
  };

  const login = async (role, key = null) => {
    setLoading(true);
    try {
      const effectiveKey = role === 'public' ? null : key;
      await schlosserApi.getProducts(role, effectiveKey);
      
      const userData = {
        role,
        key: effectiveKey,
        name: role === 'public' ? 'Visitante' : (role === 'vendor' ? 'Vendedor' : 'Administrador'),
        timestamp: Date.now()
      };

      localStorage.setItem('schlosser_auth', JSON.stringify(userData));
      setUser(userData);
      
      if (role === 'public') {
          toast({ title: "Bem-vindo!", description: `Acesso ao catálogo público liberado.` });
      } else {
          toast({ title: "Login realizado!", description: `Bem-vindo ao Schlosser Pro V9.` });
      }
      return { success: true };
    } catch (error) {
      toast({ title: "Erro no login", description: "Credenciais inválidas.", variant: "destructive" });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('schlosser_auth');
    localStorage.removeItem('schlosser_client_data');
    localStorage.removeItem('schlosser_public_city');
    setUser(null);
    setClientData(null);
    setPublicCity(null);
  };

  const selectClient = (client) => {
      setClientData(client);
      localStorage.setItem('schlosser_client_data', JSON.stringify(client));
  };

  const selectCity = (city) => {
      setPublicCity(city);
      localStorage.setItem('schlosser_public_city', JSON.stringify(city));
  };

  const value = {
    user,
    clientData,
    publicCity,
    loading,
    login,
    logout,
    selectClient,
    selectCity,
    isAuthenticated: !!user,
    isVendor: user?.role === 'vendor',
    isAdmin: user?.role === 'admin',
    isPublic: user?.role === 'public' || (!user), // Treat undefined as potentially public
    role: user?.role || 'public',
    userKey: user?.key
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

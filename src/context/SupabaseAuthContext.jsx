import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const SupabaseAuthContext = createContext(null);

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  return context;
};

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

const buildAuthEmail = (loginInput) => {
  const d = onlyDigits(loginInput);
  if (!d) return '';
  return `tel-${d}@sercarne.local`;
};

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user || null);
      setLoading(false);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const login = async (loginInput, passwordInput) => {
    setLoading(true);
    try {
      const email = buildAuthEmail(loginInput);
      if (!email) throw new Error('Informe um telefone válido.');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: passwordInput,
      });

      if (error) throw error;

      toast({
        title: "Login realizado ✅",
        description: `Bem-vindo!`,
      });

      return { success: true, user: data.user };
    } catch (e) {
      return { success: false, error: e?.message || 'Falha no login' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    toast({ title: "Logout realizado" });
  };

  return (
    <SupabaseAuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

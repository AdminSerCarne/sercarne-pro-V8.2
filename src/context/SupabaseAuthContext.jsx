// src/context/SupabaseAuthContext.jsx
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

export const SupabaseAuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);            // seu "userSession" (app)
  const [authUser, setAuthUser] = useState(null);    // user do Supabase Auth (JWT)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // mantém auth state real do Supabase
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setAuthUser(data?.session?.user || null);
      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  /**
   * LOGIN por telefone (UX), mas autentica via Supabase Auth (JWT real)
   */
  const login = async (loginInput, passwordInput) => {
    setLoading(true);

    try {
      const loginNorm = onlyDigits(loginInput);

      // 1) Busca na tabela "usuarios" (teu controle interno)
      const { data: usuarioData, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('login', loginInput) // se no banco tá com máscara
        .maybeSingle();

      // Se no banco teu login está só com dígitos, use .eq('login', loginNorm)
      if (error) throw new Error(error.message);
      if (!usuarioData) throw new Error('Usuário não encontrado.');
      if (usuarioData.ativo === false) throw new Error('Usuário inativo. Contate o administrador.');
      if (String(usuarioData.senha_hash) !== String(passwordInput)) throw new Error('Senha incorreta.');

      // 2) Precisa ter um email real para autenticar no Supabase Auth
      const authEmail =
        String(usuarioData.auth_email || usuarioData.email || '').trim();

      if (!authEmail) {
        throw new Error('Usuário sem auth_email/email para login no Supabase Auth.');
      }

      // 3) Login REAL no Supabase Auth -> gera JWT e alimenta o RLS
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: passwordInput,
      });

      if (signInErr) throw new Error(`Falha Supabase Auth: ${signInErr.message}`);

      // 4) Monte teu userSession do app (pode manter como tu gosta)
      const userSession = {
        id: usuarioData.login,
        usuario: usuarioData.usuario,
        login: usuarioData.login,
        tipo_usuario: usuarioData.tipo_de_Usuario,
        nivel: usuarioData.Nivel,
        tab_preco: usuarioData['TabR$'],
        app_login_route: usuarioData['app login'],
        auth_email: authEmail,
      };

      setUser(userSession);
      setAuthUser(signInData?.user || null);

      toast({
        title: 'Login realizado com sucesso!',
        description: `Bem-vindo, ${userSession.usuario}`,
      });

      return { success: true, user: userSession };

    } catch (err) {
      return { success: false, error: err?.message || 'Falha na autenticação' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setAuthUser(null);
      setLoading(false);
      toast({ title: 'Logout realizado', description: 'Você saiu do sistema.' });
    }
  };

  // ✅ isAuthenticated AGORA é baseado no Auth real (JWT)
  const isAuthenticated = !!authUser;

  return (
    <SupabaseAuthContext.Provider
      value={{ user, authUser, loading, login, logout, isAuthenticated }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
};

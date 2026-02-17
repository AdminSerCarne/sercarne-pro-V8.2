// src/context/SupabaseAuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const SupabaseAuthContext = createContext(null);

export const useSupabaseAuth = () => {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  return ctx;
};

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // 1) pega sessão atual (se já estiver logado)
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user ?? null);
      setLoading(false);
    };

    bootstrap();

    // 2) escuta mudanças de login/logout
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // ✅ LOGIN REAL: Supabase Auth
  const login = async (loginInput, passwordInput) => {
    setLoading(true);

    try {
      // A) Descobre o email do vendedor via tabela "usuarios" (usando o login/telefone)
      const { data: usuarioData, error: errUser } = await supabase
        .from('usuarios')
        .select('email, usuario, login, ativo, tipo_de_Usuario, Nivel, "TabR$", "app login"')
        .eq('login', loginInput)
        .maybeSingle();

      if (errUser) throw new Error('Erro ao buscar usuário no banco.');
      if (!usuarioData) throw new Error('Usuário não encontrado.');
      if (usuarioData.ativo === false) throw new Error('Usuário inativo. Contate o administrador.');
      if (!usuarioData.email) throw new Error('Usuário sem email cadastrado (necessário no Auth).');

      // B) Faz login de verdade no Supabase Auth (gera JWT)
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: usuarioData.email,
        password: passwordInput
      });

      if (authErr) throw new Error('Senha inválida no Supabase Auth (ajustar senha do usuário no Auth).');

      // C) Garante metadata (RLS usa auth.jwt()->user_metadata.login)
      // Se já existir, ok. Se não existir, atualiza.
      const meta = authData?.user?.user_metadata || {};
      if (!meta.login || meta.login !== usuarioData.login) {
        await supabase.auth.updateUser({
          data: {
            login: usuarioData.login,
            usuario: usuarioData.usuario,
            nivel: usuarioData.Nivel
          }
        });
      }

      toast({
        title: "Login realizado ✅",
        description: `Bem-vindo, ${usuarioData.usuario}`,
      });

      return { success: true, user: authData.user };

    } catch (e) {
      toast({
        title: "Erro no login",
        description: e?.message || "Não foi possível logar.",
        variant: "destructive"
      });
      return { success: false, error: e?.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    toast({ title: "Logout", description: "Você saiu do sistema." });
  };

  return (
    <SupabaseAuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

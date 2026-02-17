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

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // seu user “do app”
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // carrega sessão real do Supabase Auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await hydrateUserFromTable(data.session.user);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await hydrateUserFromTable(session.user);
      else setUser(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const hydrateUserFromTable = async (authUser) => {
    // tenta pegar o login do metadata (se existir)
    const metaLogin = authUser?.user_metadata?.login;
    const metaLoginNorm = onlyDigits(metaLogin);

    // busca na tabela usuarios (por login ou por auth_email)
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('*')
      .or(
        metaLoginNorm
          ? `login.eq.${metaLoginNorm},auth_email.eq.${authUser.email}`
          : `auth_email.eq.${authUser.email}`
      )
      .maybeSingle();

    // monta user do app (igual teu padrão)
    const userSession = {
      id: metaLoginNorm || usuarioData?.login || authUser.id,
      auth_uid: authUser.id,
      auth_email: authUser.email,
      usuario: usuarioData?.usuario || authUser.user_metadata?.usuario || authUser.email,
      login: usuarioData?.login || metaLoginNorm,
      tipo_usuario: usuarioData?.tipo_de_Usuario || authUser.user_metadata?.tipo_usuario,
      nivel: usuarioData?.Nivel || authUser.user_metadata?.nivel,
      tab_preco: usuarioData?.['TabR$'],
      app_login_route: usuarioData?.['app login'] || '/catalog'
    };

    setUser(userSession);
  };

  const login = async (loginInput, passwordInput) => {
    setLoading(true);

    try {
      const loginNorm = onlyDigits(loginInput);
      // 1) achar auth_email na tabela usuarios pelo telefone OU pelo próprio email digitado
      const { data: usuarioData, error } = await supabase
        .from('usuarios')
        .select('*')
        .or(`login.eq.${loginNorm},auth_email.eq.${String(loginInput).trim()}`)
        .maybeSingle();

      if (error) throw error;
      if (!usuarioData) throw new Error('Usuário não encontrado.');
      if (usuarioData.ativo === false) throw new Error('Usuário inativo. Contate o administrador.');
      if (!usuarioData.auth_email) throw new Error('Usuário sem auth_email cadastrado.');

      // 2) login REAL no Supabase Auth
      const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
        email: String(usuarioData.auth_email).trim(),
        password: String(passwordInput)
      });
      if (signErr) throw signErr;

      // 3) garantir metadata no Auth (pra RLS e auditoria)
      await supabase.auth.updateUser({
        data: {
          login: usuarioData.login,
          usuario: usuarioData.usuario,
          nivel: usuarioData.Nivel,
          tipo_usuario: usuarioData.tipo_de_Usuario
        }
      });
      await supabase.auth.refreshSession();

      await hydrateUserFromTable(signData.user);

      toast({ title: "Login realizado com sucesso!", description: `Bem-vindo, ${usuarioData.usuario}` });
      return { success: true };

    } catch (e) {
      return { success: false, error: e?.message || 'Falha na autenticação' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    toast({ title: "Logout realizado", description: "Você saiu do sistema." });
  };

  return (
    <SupabaseAuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

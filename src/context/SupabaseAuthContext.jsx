import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/customSupabaseClient";

const SupabaseAuthContext = createContext(null);

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const toBool = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (['true', '1', 'sim', 'yes', 'y', 'ativo'].includes(normalized)) return true;
  if (['false', '0', 'nao', 'não', 'no', 'inativo'].includes(normalized)) return false;
  return false;
};

export function SupabaseAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null); // usuário do Supabase Auth (JWT)
  const [user, setUser] = useState(null);         // perfil vindo de public.usuarios
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!session?.user;

  // Carrega perfil interno (public.usuarios) pelo auth_email do auth user
  const loadProfileByAuthEmail = async (email) => {
    if (!email) return null;

    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("auth_email", email)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[Auth] loadProfile error:", error);
      return null;
    }
    return data || null;
  };



  const ensureJwtMetadata = async (_profile) => {
    return;
  };
  // Atualiza metadata do usuário LOGADO (não precisa service role)
//  const ensureJwtMetadata = async (profile) => {
 //   try {
 //     if (!profile) return;

 //     const meta = {
 //       login: profile.login || "",
 //       usuario: profile.usuario || profile.Usuario || profile.display_name || profile.nome || profile.usuario || "",
 //       nivel: profile.Nivel ?? profile.nivel ?? null,
  //      tipo_usuario: profile.tipo_de_Usuario ?? profile.tipo_usuario ?? profile["tipo_de_Usuario"] ?? "",
  //    };

 //     // grava metadata no próprio user (permitido)
 //     const { error } = await supabase.auth.updateUser({ data: meta });
 //     if (error) console.warn("[Auth] updateUser metadata warning:", error);

 //     // força token novo
 //     await supabase.auth.refreshSession();
 //   } catch (e) {
 //     console.warn("[Auth] ensureJwtMetadata warning:", e);
 //   }
//  };

  const bootstrap = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const sess = data?.session || null;

      setSession(sess);
      setAuthUser(sess?.user || null);

      const email = sess?.user?.email || null;
      const profile = await loadProfileByAuthEmail(email);
      setUser(profile || null);

      // Só faz metadata se estiver autenticado
      if (sess?.user) {
        await ensureJwtMetadata(profile);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setAuthUser(newSession?.user || null);

      const email = newSession?.user?.email || null;
      const profile = await loadProfileByAuthEmail(email);
      setUser(profile || null);

      if (newSession?.user) {
        await ensureJwtMetadata(profile);
      }

      setLoading(false);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // LOGIN: recebe login (telefone) + senha
  const login = async (loginInput, password) => {
    const loginNorm = onlyDigits(loginInput);

    if (!loginNorm) {
      return { success: false, error: "Login inválido (sem dígitos)" };
    }

    try {
      if (!loginNorm) {
        return { success: false, error: "Informe um login válido (ex: 55-99962-7055)." };
      }

      // Busca auth_email pelo login na tabela usuarios
      const { data: profile, error: profileErr } = await supabase
        .from("usuarios")
        .select("*")
        .eq("login", loginNorm)
        .limit(1)
        .maybeSingle();

      if (profileErr) {
        return { success: false, error: "Erro ao consultar usuários." };
      }

      if (!profile) {
        return { success: false, error: "Usuário não encontrado" };
      }

      const isActive = toBool(profile?.ativo ?? profile?.active ?? true);
      if (!isActive) {
        return { success: false, error: "Usuário inativo. Contate o administrador." };
      }

      const email = String(profile?.auth_email || '').trim().toLowerCase();
      if (!email) {
        return {
          success: false,
          error: "Usuário sem vínculo de autenticação (auth_email). Vincule o e-mail no cadastro para liberar o login."
        };
      }

      // Faz sign-in no Supabase Auth com email + senha
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: "Credenciais inválidas no Supabase Auth para este usuário."
        };
      }

      setSession(data.session);
      setAuthUser(data.session?.user || null);
      setUser(profile);

      // grava metadata (opcional, mas ajuda teu frontend)
      await ensureJwtMetadata(profile);

      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || "Falha no login." };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthUser(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      session,
      authUser,
      user,
      loading,
      isAuthenticated,
      login,
      logout,
    }),
    [session, authUser, user, loading, isAuthenticated]
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export const useSupabaseAuth = () => {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return ctx;
};

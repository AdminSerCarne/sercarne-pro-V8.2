// src/context/SupabaseAuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/customSupabaseClient";

const SupabaseAuthContext = createContext(null);

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const isEmail = (s) => String(s || "").includes("@");

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Boot: pega sessão atual + escuta mudanças
  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session || null);
        setUser(data.session?.user || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession || null);
      setUser(newSession?.user || null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ✅ LOGIN: aceita email OU telefone/login -> busca auth_email na tabela public.usuarios
  const signIn = async ({ loginOrEmail, password }) => {
    const raw = String(loginOrEmail || "").trim();
    if (!raw) throw new Error("Informe login/email.");
    if (!password) throw new Error("Informe a senha.");

    let emailToUse = raw;

    // Se for telefone/login, traduz -> auth_email
    if (!isEmail(raw)) {
      const loginNorm = onlyDigits(raw);

      // Busca por login (telefone) OU por campo login (que pode ter caracteres)
      const { data: u, error: uErr } = await supabase
        .from("usuarios")
        .select("auth_email, login, usuario, ativo")
        .or(`login.eq.${raw},login.eq.${loginNorm}`)
        .limit(1)
        .maybeSingle();

      if (uErr) throw new Error(`Erro buscando usuário: ${uErr.message}`);
      if (!u) throw new Error("Login não encontrado no cadastro.");
      if (u.ativo === false) throw new Error("Usuário inativo. Fale com o suporte.");

      emailToUse = String(u.auth_email || "").trim();
      if (!emailToUse) {
        throw new Error("Usuário sem auth_email cadastrado. Preencha a coluna auth_email em public.usuarios.");
      }
    }

    // Garante sessão “limpa” em caso de tentativa anterior ruim
    await supabase.auth.signOut();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error) {
      // Mensagem mais útil
      throw new Error("Falha no login: email/telefone ou senha inválidos.");
    }

    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signIn,
      signOut,
    }),
    [user, session, loading]
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
};

export const useSupabaseAuth = () => {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error("useSupabaseAuth deve ser usado dentro de SupabaseAuthProvider");
  return ctx;
};

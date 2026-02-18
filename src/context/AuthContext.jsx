import React, { createContext, useContext } from "react";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/context/SupabaseAuthContext";

// Este arquivo vira apenas um "adaptador" para o restante do app
// que ainda importa AuthProvider/useAuth de "@/context/AuthContext".

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  return (
    <SupabaseAuthProvider>
      <AuthContext.Provider value={null}>{children}</AuthContext.Provider>
    </SupabaseAuthProvider>
  );
};

// Mantém compatibilidade: quem chama useAuth() vai receber o contexto do Supabase
export const useAuth = () => useSupabaseAuth();


import React from 'react';

// This file is deprecated and should not be used.
// Please use src/context/SupabaseAuthContext.jsx instead.

export const AuthProvider = ({ children }) => {
  console.warn('DEPRECATED: AuthProvider from src/contexts/SupabaseAuthContext.jsx is being used. Please migrate to src/context/SupabaseAuthContext.jsx');
  return <>{children}</>;
};

export const useAuth = () => {
  throw new Error('DEPRECATED: useAuth from src/contexts/SupabaseAuthContext.jsx is deprecated. Use useSupabaseAuth from src/context/SupabaseAuthContext.jsx');
};

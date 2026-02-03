
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const SupabaseAuthContext = createContext(null);

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  return context;
};

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const storedSession = localStorage.getItem('supabase_session');
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        // Basic expiration check (e.g. 24 hours) could be added here
        // For now, we trust the local storage if it exists
        setUser(parsedSession.user);
      }
    } catch (error) {
      console.error('Session check failed', error);
      localStorage.removeItem('supabase_session');
    } finally {
      setLoading(false);
    }
  };

  const login = async (loginInput, passwordInput) => {
    setLoading(true);
    console.log('--- START LOGIN PROCESS ---');
    console.log(`Attempting login for: ${loginInput}`);

    try {
      // 1. Query the 'usuarios' table matching the 'login' column
      // Using maybeSingle() to handle 0 or 1 result gracefully
      const { data: usuarioData, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('login', loginInput)
        .maybeSingle();

      if (error) {
        console.error('Supabase query error:', error);
        // Often RLS errors look like specific codes or messages
        if (error.code === '42501') {
           throw new Error('Acesso negado ao banco de dados (RLS).');
        }
        throw new Error('Erro ao conectar com o banco de dados.');
      }

      console.log('Query result:', usuarioData ? 'User Found' : 'User Not Found');

      if (!usuarioData) {
        throw new Error('Usuário não encontrado.');
      }

      // 2. Check if user is active
      if (usuarioData.ativo === false) { 
        console.warn(`User ${loginInput} is inactive.`);
        throw new Error('Usuário inativo. Contate o administrador.');
      }

      // 3. Verify password (direct hash comparison)
      console.log('Verifying password...'); 
      
      if (String(usuarioData.senha_hash) !== String(passwordInput)) {
        console.warn('Password mismatch');
        throw new Error('Senha incorreta.');
      }

      // 4. Construct user object for session
      const userSession = {
        id: usuarioData.login, // using login as unique ID
        usuario: usuarioData.usuario,
        login: usuarioData.login,
        tipo_usuario: usuarioData.tipo_de_Usuario,
        nivel: usuarioData.Nivel,
        tab_preco: usuarioData['TabR$'], // Handling special character column name
        app_login_route: usuarioData['app login']
      };

      console.log('Login successful. Session created for:', userSession.usuario);

      // 5. Store in LocalStorage and State
      localStorage.setItem('supabase_session', JSON.stringify({
        user: userSession,
        timestamp: Date.now()
      }));
      
      setUser(userSession);

      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo, ${userSession.usuario}`,
      });

      return { success: true, user: userSession };

    } catch (error) {
      console.error('Login flow error:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
      console.log('--- END LOGIN PROCESS ---');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('supabase_session');
    toast({
      title: "Logout realizado",
      description: "Você saiu do sistema."
    });
  };

  return (
    <SupabaseAuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

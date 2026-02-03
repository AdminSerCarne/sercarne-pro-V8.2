export const errorHandler = {
  handle(error, context = 'Operação') {
    console.error(`Error in ${context}:`, error);
    
    // Supabase errors
    if (error.message) {
      return this.parseSupabaseError(error);
    }
    
    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'Erro de conexão. Verifique sua internet.';
    }
    
    // Generic error
    return error.toString() || 'Ocorreu um erro inesperado.';
  },

  parseSupabaseError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid login credentials')) {
      return 'Email ou senha incorretos.';
    }
    
    if (message.includes('user already registered')) {
      return 'Este email já está cadastrado.';
    }
    
    if (message.includes('email not confirmed')) {
      return 'Por favor, confirme seu email.';
    }
    
    if (message.includes('network')) {
      return 'Erro de conexão. Tente novamente.';
    }
    
    if (message.includes('jwt')) {
      return 'Sessão expirada. Faça login novamente.';
    }
    
    return error.message;
  },

  isAuthError(error) {
    const message = error.message?.toLowerCase() || '';
    return message.includes('jwt') || 
           message.includes('unauthorized') || 
           message.includes('session');
  },

  isNetworkError(error) {
    return error instanceof TypeError && error.message.includes('fetch');
  }
};
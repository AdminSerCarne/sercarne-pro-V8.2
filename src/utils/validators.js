export const validators = {
  email(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email é obrigatório';
    if (!regex.test(email)) return 'Email inválido';
    return null;
  },

  password(password) {
    if (!password) return 'Senha é obrigatória';
    if (password.length < 6) return 'Senha deve ter no mínimo 6 caracteres';
    return null;
  },

  required(value, fieldName = 'Campo') {
    if (!value || value.toString().trim() === '') {
      return `${fieldName} é obrigatório`;
    }
    return null;
  },

  nome(nome) {
    if (!nome) return 'Nome é obrigatório';
    if (nome.length < 3) return 'Nome deve ter no mínimo 3 caracteres';
    return null;
  },

  tipo(tipo) {
    const validTypes = ['Admin', 'Vendedor', 'Cliente'];
    if (!tipo) return 'Tipo de usuário é obrigatório';
    if (!validTypes.includes(tipo)) return 'Tipo de usuário inválido';
    return null;
  },

  rota(rota) {
    const validRotas = ['Missões', 'Cultura', 'Fronteira', 'Local', 'Celeiro'];
    if (!rota) return 'Rota é obrigatória';
    if (!validRotas.includes(rota)) return 'Rota inválida';
    return null;
  },

  tabela(tabela) {
    const num = parseInt(tabela);
    if (isNaN(num)) return 'Tabela inválida';
    if (num < 0 || num > 5) return 'Tabela deve estar entre 0 e 5';
    return null;
  },

  quantidade(quantidade) {
    const num = parseInt(quantidade);
    if (isNaN(num)) return 'Quantidade inválida';
    if (num < 1) return 'Quantidade deve ser no mínimo 1';
    return null;
  }
};
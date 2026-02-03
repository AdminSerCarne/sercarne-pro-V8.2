export const formatters = {
  currency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) return 'R$ 0,00';
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  },

  date(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) return '-';
    
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  },

  datetime(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) return '-';
    
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  },

  number(value) {
    if (value === null || value === undefined) return '0';
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) return '0';
    
    return new Intl.NumberFormat('pt-BR').format(num);
  },

  roundStock(value) {
    return Math.round(Number(value) || 0);
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  truncate(str, maxLength = 50) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }
};
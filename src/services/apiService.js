const API_URL = 'https://script.google.com/macros/s/AKfycbzjNH_qiKH3QCI2FaVJsvYRQGwNO389p5NCNhxR-kncjA1JbNr3Ym43_dS4p1WxEQ1kAw/exec';
const CACHE_KEY = 'products_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export const apiService = {
  async fetchProducts(forceRefresh = false) {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cachedData = this.getCachedProducts();
        if (cachedData) {
          return { success: true, data: cachedData, fromCache: true };
        }
      }

      // Fetch from API
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Falha ao buscar produtos');
      }

      const data = await response.json();
      
      // Process and structure the data
      const products = this.processProducts(data);
      
      // Cache the results
      this.cacheProducts(products);
      
      return { success: true, data: products, fromCache: false };
    } catch (error) {
      console.error('Error fetching products:', error);
      
      // Try to return cached data even if expired
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        return { success: false, data: parsed.products, error: error.message, fromCache: true };
      }
      
      return { success: false, error: error.message };
    }
  },

  processProducts(rawData) {
    // Expected format from API: array of products with codigo, nome, and price tables (0-5)
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData.map(item => ({
      codigo: item.codigo || item.Codigo || item.CODIGO,
      nome: item.nome || item['Nome do Produto'] || item.nome_produto,
      tabela_0: parseFloat(item.tabela_0 || item.Tabela_0 || 0),
      tabela_1: parseFloat(item.tabela_1 || item.Tabela_1 || 0),
      tabela_2: parseFloat(item.tabela_2 || item.Tabela_2 || 0),
      tabela_3: parseFloat(item.tabela_3 || item.Tabela_3 || 0),
      tabela_4: parseFloat(item.tabela_4 || item.Tabela_4 || 0),
      tabela_5: parseFloat(item.tabela_5 || item.Tabela_5 || 0),
    }));
  },

  cacheProducts(products) {
    const cacheData = {
      products,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  },

  getCachedProducts() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { products, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < CACHE_DURATION) {
        return products;
      }

      // Cache expired
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  },

  clearCache() {
    localStorage.removeItem(CACHE_KEY);
  },

  getCacheAge() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { timestamp } = JSON.parse(cached);
      return Date.now() - timestamp;
    } catch (error) {
      return null;
    }
  }
};

import { useState, useEffect, useCallback } from 'react';
import { schlosserApi } from '@/services/schlosserApi';
import { useAuth } from '@/context/AuthContext';
import { fetchStockData } from '@/services/googleSheetsService';

export const useProducts = () => {
  const { role } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Base Products (Names, prices, etc)
      const baseProducts = await schlosserApi.getProducts(role);
      
      // 2. Fetch Live Stock Data (Now includes brand, species, packaging)
      let stockItems = [];
      try {
          stockItems = await fetchStockData();
      } catch (e) {
          console.warn('Failed to load stock data, continuing with base products', e);
      }
      
      // Create a map for fast lookup: Code -> Stock Info
      const stockMap = new Map();
      stockItems.forEach(item => {
        if (item.codigo_produto) {
          stockMap.set(item.codigo_produto, item);
        }
      });

      if (Array.isArray(baseProducts)) {
        // Merge stock, weight, and new filter attributes into products
        const mergedProducts = baseProducts.map(p => {
             const code = p.codigo?.toString().trim();
             const stockInfo = stockMap.get(code);
             
             return {
                 ...p,
                 // Map the specific fields requested
                 estoque_und: stockInfo ? stockInfo.estoque_und : 0,
                 // If we have a live weight from the sheet (Column I), use it. Otherwise fallback to base.
                 pesoMedio: (stockInfo && stockInfo.peso_medio_kg > 0) ? stockInfo.peso_medio_kg : p.pesoMedio,
                 // Keep the requested structure key available as well
                 peso_medio_kg: stockInfo ? stockInfo.peso_medio_kg : p.pesoMedio,
                 // Unit from Column AC
                 unidade_estoque: stockInfo ? stockInfo.unidade_estoque : 'UND',
                 
                 // Task 3: New Filter Data from Stock Sheet
                 marca: stockInfo ? stockInfo.marca : '',
                 especie: stockInfo ? stockInfo.especie : '',
                 tipo_embalagem: stockInfo ? stockInfo.tipo_embalagem : ''
             };
        });

        // Filter by visibility (Column AX)
        const visibleProducts = mergedProducts.filter(p => {
             const isVisible = p.visivel === true;
             // Keeping debug log for visibility as requested previously
             // console.log('Produto SKU:', p.sku, 'Coluna AX:', p.ax_raw, 'Visível:', isVisible);
             return isVisible;
        });

        // Debug logging for new filter data (Task 3)
        if (visibleProducts.length > 0) {
            console.log('✅ [useProducts] Dados de Filtros Carregados (Amostra):', {
                sku: visibleProducts[0].sku,
                marca: visibleProducts[0].marca,
                especie: visibleProducts[0].especie,
                tipo_embalagem: visibleProducts[0].tipo_embalagem
            });
        }
        
        setProducts(visibleProducts);
      } else {
        setProducts([]);
      }

    } catch (err) {
      console.error('[useProducts] Error:', err);
      setError('Erro ao carregar produtos.');
      setProducts([]); 
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    refreshProducts: fetchProducts,
  };
};

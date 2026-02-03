import { useState, useEffect, useCallback } from 'react';
import { schlosserApi } from '@/services/schlosserApi';
import { useAuth } from '@/context/AuthContext';
import { fetchStockData } from '@/services/googleSheetsService';
import { getAvailabilityMapForDate } from '@/utils/stockValidator';

const toBool = (v) => {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', 'verdadeiro', 'sim', 'yes', 'y'].includes(s);
};

export const useProducts = () => {
  const { role } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1) Base Products
      const baseProducts = await schlosserApi.getProducts(role);

      // 2) Stock Sheet (inclui AX, estoque_und, peso, etc)
      let stockItems = [];
      try {
        stockItems = await fetchStockData();
      } catch (e) {
        console.warn('[useProducts] Falha ao carregar stockData, seguindo só com baseProducts', e);
      }

      // Mapa: codigo -> stockInfo
      const stockMap = new Map();
      (stockItems || []).forEach((item) => {
        const code = String(item.codigo_produto ?? item.codigo ?? '').trim();
        if (code) stockMap.set(code, item);
      });

      if (!Array.isArray(baseProducts)) {
        setProducts([]);
        return;
      }

      // 3) Merge
      const mergedProducts = baseProducts.map((p) => {
        const code = String(p.codigo ?? '').trim();
        const stockInfo = stockMap.get(code);

        // AX (coluna 50) - tentativas de nomes comuns
        const axRaw =
          stockInfo?.ax ??
          stockInfo?.AX ??
          stockInfo?.exibir_na_plataforma ??
          stockInfo?.exibir_plataforma ??
          stockInfo?.exibir ??
          stockInfo?.visivel ??
          p?.visivel;

        const visivel = toBool(axRaw);

        const pesoSheet = Number(stockInfo?.peso_medio_kg ?? stockInfo?.pesoMedio ?? 0);
        const pesoMedio = pesoSheet > 0 ? pesoSheet : p.pesoMedio;

        return {
          ...p,
          visivel, // ✅ garantia do CAP 4

          // “Base” físico de hoje vindo do sheet (coluna estoque_und)
          estoque_und: Number(stockInfo?.estoque_und ?? 0) || 0,

          pesoMedio,
          peso_medio_kg: pesoMedio,

          unidade_estoque: stockInfo?.unidade_estoque || 'UND',

          // Filtros extras
          marca: stockInfo?.marca || '',
          especie: stockInfo?.especie || '',
          tipo_embalagem: stockInfo?.tipo_embalagem || ''
        };
      });

      // 4) Filtra visível (CAP 4)
      const visibleProducts = mergedProducts.filter((p) => p.visivel === true);

      // 5) CAP 5: calcular disponível HOJE (Base + Entradas - Pedidos)
      // Fazemos isso em lote (1 consulta de pedidos + entradas/base cacheadas)
      const todayStr = new Date().toISOString().split('T')[0];
      const codes = visibleProducts.map((p) => String(p.codigo).trim()).filter(Boolean);

      const availabilityMap = await getAvailabilityMapForDate(codes, todayStr); // Map<code, available>

      const withAvailability = visibleProducts.map((p) => {
        const code = String(p.codigo).trim();
        const available_today = availabilityMap.get(code) ?? 0;
        return { ...p, available_today };
      });

      setProducts(withAvailability);
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
    refreshProducts: fetchProducts
  };
};

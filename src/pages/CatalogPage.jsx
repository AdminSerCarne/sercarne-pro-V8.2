import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import ProductCard from '@/components/ProductCard';
import CatalogBanner from '@/components/CatalogBanner';
import { Search, AlertTriangle, RefreshCw, Loader2, Lock, ShieldCheck } from 'lucide-react';
// ❌ REMOVIDO: useProducts (caminho antigo googleSheetsService)
// import { useProducts } from '@/hooks/useProducts';
import { supabase } from '@/lib/customSupabaseClient';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { getTodayISODateLocal } from '@/utils/dateUtils';

// ✅ CAP 5: ordenar por estoque disponível HOJE
import { getAvailableStockForDateBatch } from '@/utils/stockValidator';

// ✅ FONTE OFICIAL (manual): schlosserApi GVIZ
import { schlosserApi } from '@/services/schlosserApi';

const normalizeTextUpper = (value) => String(value ?? '').trim().toUpperCase();

const getBrandLabel = (product) => {
  const raw = String(product?.brandName ?? product?.marca ?? '').trim();
  return raw || 'SEM MARCA';
};

const isComboProduct = (product) => {
  const explicitCombo = String(product?.combo ?? '').trim().toLowerCase();
  if (['true', '1', 'sim', 'yes'].includes(explicitCombo)) return true;

  const text = normalizeTextUpper(
    [
      product?.descricao,
      product?.descricao_complementar,
      product?.name,
      product?.nome,
    ]
      .filter(Boolean)
      .join(' ')
  );

  return ['COMBO', 'KIT', 'MIX', 'CESTA', 'SORTIDO'].some((token) => text.includes(token));
};

const getProductTypeLabel = (product) => {
  const explicitType = String(product?.tipo_produto ?? product?.tipoProduto ?? product?.especie ?? '').trim();
  if (explicitType) return explicitType.toUpperCase();

  const text = normalizeTextUpper(
    [
      product?.descricao,
      product?.descricao_complementar,
      product?.name,
      product?.nome,
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (text.includes('BOVIN') || text.includes('VACA') || text.includes('NOVILHO')) return 'BOVINO';
  if (text.includes('SUIN') || text.includes('PORCO')) return 'SUINO';
  if (text.includes('FRANGO') || text.includes('AVE') || text.includes('GALINHA')) return 'AVES';
  if (text.includes('OVIN') || text.includes('CORDEIRO')) return 'OVINO/CORDEIRO';
  if (text.includes('PEIXE') || text.includes('TILAPIA') || text.includes('SALMAO')) return 'PEIXES';
  if (text.includes('LINGUICA') || text.includes('EMBUT')) return 'EMBUTIDOS';
  return 'OUTROS';
};

const getStockValueFromMap = (product, stockMapToday) => {
  const code = String(product?.codigo || '').trim();
  const stockMapValue = Number(stockMapToday?.[code]);
  if (!Number.isNaN(stockMapValue)) return stockMapValue;
  return Number(product?.estoque_und || 0);
};

const CatalogPage = () => {
  const { user } = useSupabaseAuth();
  const { notifyStockUpdate, stockUpdateTrigger } = useCart();

  // ✅ substitui useProducts mantendo o mesmo “contrato”
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // papel para schlosserApi (publico vs vendedor)
  const role = user ? 'vendedor' : 'publico';
  const userLevel = useMemo(() => {
    if (!user) return 0;
    const n = Number(user?.Nivel ?? user?.nivel);
    if (Number.isFinite(n) && n > 0) return n;
    const roleRaw = String(user?.tipo_de_Usuario ?? user?.tipo_usuario ?? user?.role ?? '').toLowerCase();
    if (roleRaw.includes('admin') || roleRaw.includes('gestor')) return 10;
    return 0;
  }, [user]);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await schlosserApi.getProducts(role);
      const visible = (Array.isArray(list) ? list : []).filter((p) => p?.visivel === true);
      setProducts(visible);
    } catch (e) {
      console.error('[CatalogPage] Erro ao carregar produtos via schlosserApi:', e);
      setProducts([]);
      setError(e?.message || 'Falha ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  // carrega 1x (e recarrega quando muda role)
  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [comboFilter, setComboFilter] = useState('all');
  const [productTypeFilter, setProductTypeFilter] = useState('all');
  const [sortMode, setSortMode] = useState('stock_desc');
  const [isRefreshingStock, setIsRefreshingStock] = useState(false);

  // ✅ mapa: { [codigo]: disponivelHoje }
  const [stockMapToday, setStockMapToday] = useState({});
  const [loadingSortStock, setLoadingSortStock] = useState(false);

  // ✅ força recálculo do stockMapToday mesmo se products não mudarem
  const [stockTick, setStockTick] = useState(0);

  // -----------------------------------
  // Header content
  // -----------------------------------
  const headerContent = useMemo(() => {
    if (!user) {
      return {
        title: "Catálogo Público Schlosser",
        subtitle: "Produtos selecionados com qualidade premium para você.",
      };
    }
    return {
      title: "Portal do Cliente",
      subtitle: `Bem-vindo, ${user.usuario || 'Cliente'}.`,
    };
  }, [user]);

  // -----------------------------------
  // ✅ Centraliza “recalcular estoque”
  // - notifica context
  // - refaz produtos
  // - força stockMapToday refazer
  // -----------------------------------
  const triggerFullStockRefresh = useCallback(() => {
    try { notifyStockUpdate?.(); } catch (e) {}
    try { refreshProducts?.(); } catch (e) {}

    // força o efeito do stockMapToday rodar
    setStockTick(Date.now());
  }, [notifyStockUpdate, refreshProducts]);

  // -----------------------------------
  // Realtime: pedidos mudaram => refaz estoque
  // -----------------------------------
  useEffect(() => {
    const channel = supabase
      .channel('public:pedidos_stock_tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        // pequena “segurada” pra evitar rajadas
        setTimeout(() => {
          triggerFullStockRefresh();
        }, 150);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerFullStockRefresh]);

  // -----------------------------------
  // ✅ Ouve o evento disparado pelo Dashboard (CANCELAR/REATIVAR etc)
  // -----------------------------------
  useEffect(() => {
    const onUpdate = () => triggerFullStockRefresh();

    const onStorage = (e) => {
      if (e.key === 'schlosser_stock_update') onUpdate();
    };

    window.addEventListener('schlosser:stock-updated', onUpdate);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('schlosser:stock-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [triggerFullStockRefresh]);

  // -----------------------------------
  // Manual refresh
  // -----------------------------------
  const handleManualRefresh = () => {
    setIsRefreshingStock(true);
    triggerFullStockRefresh();
    setTimeout(() => setIsRefreshingStock(false), 800);
  };

  // -----------------------------------
  // ✅ CAP 5: calcular disponibilidade HOJE em lote
  // roda quando:
  // - products muda
  // - stockUpdateTrigger muda (seu context)
  // - stockTick muda (evento / realtime / manual)
  // -----------------------------------
  useEffect(() => {
    const run = async () => {
      if (!products || products.length === 0) {
        setStockMapToday({});
        return;
      }

      try {
        setLoadingSortStock(true);
        const todayStr = getTodayISODateLocal();

        const codes = products
          .map(p => String(p.codigo || '').trim())
          .filter(Boolean);

        const map = await getAvailableStockForDateBatch(codes, todayStr);
        setStockMapToday(map || {});
      } catch (e) {
        console.warn('[CatalogPage] Falha ao montar stockMapToday, usando fallback estoque_und', e);
        setStockMapToday({});
      } finally {
        setLoadingSortStock(false);
      }
    };

    run();
  }, [products, stockUpdateTrigger, stockTick]);

  const brandOptions = useMemo(() => {
    const set = new Set();
    (products || []).forEach((product) => set.add(getBrandLabel(product)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [products]);

  const productTypeOptions = useMemo(() => {
    const set = new Set();
    (products || []).forEach((product) => set.add(getProductTypeLabel(product)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [products]);

  useEffect(() => {
    if (brandFilter !== 'all' && !brandOptions.includes(brandFilter)) {
      setBrandFilter('all');
    }
  }, [brandFilter, brandOptions]);

  useEffect(() => {
    if (productTypeFilter !== 'all' && !productTypeOptions.includes(productTypeFilter)) {
      setProductTypeFilter('all');
    }
  }, [productTypeFilter, productTypeOptions]);

  const clearCatalogFilters = useCallback(() => {
    setSearchTerm('');
    setBrandFilter('all');
    setComboFilter('all');
    setProductTypeFilter('all');
    setSortMode('stock_desc');
  }, []);

  // -----------------------------------
  // Filter + Sort
  // -----------------------------------
  const filteredAndSortedProducts = useMemo(() => {
    const term = String(searchTerm || '').toLowerCase();

    const filtered = (products || []).filter((product) => {
      const matchesSearch =
        !term ||
        (product.codigo && String(product.codigo).includes(searchTerm)) ||
        (product.descricao && String(product.descricao).toLowerCase().includes(term)) ||
        (product.nome && String(product.nome).toLowerCase().includes(term)) ||
        (product.name && String(product.name).toLowerCase().includes(term));
      if (!matchesSearch) return false;

      const brandLabel = getBrandLabel(product);
      if (brandFilter !== 'all' && brandLabel !== brandFilter) return false;

      const combo = isComboProduct(product);
      if (comboFilter === 'combo' && !combo) return false;
      if (comboFilter === 'avulso' && combo) return false;

      const typeLabel = getProductTypeLabel(product);
      if (productTypeFilter !== 'all' && typeLabel !== productTypeFilter) return false;

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const stockA = getStockValueFromMap(a, stockMapToday);
      const stockB = getStockValueFromMap(b, stockMapToday);

      if (sortMode === 'stock_asc') {
        if (stockA !== stockB) return stockA - stockB;
      } else if (sortMode === 'name_asc') {
        const nameA = String(a.descricao || a.nome || a.name || '').toLowerCase();
        const nameB = String(b.descricao || b.nome || b.name || '').toLowerCase();
        const byName = nameA.localeCompare(nameB, 'pt-BR');
        if (byName !== 0) return byName;
      } else if (sortMode === 'code_asc') {
        const byCode = String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR');
        if (byCode !== 0) return byCode;
      } else {
        if (stockB !== stockA) return stockB - stockA;
      }

      return String(a.codigo || '').localeCompare(String(b.codigo || ''));
    });

    return sorted;
  }, [products, searchTerm, stockMapToday, brandFilter, comboFilter, productTypeFilter, sortMode]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <Helmet>
        <title>Catálogo - Schlosser</title>
      </Helmet>

      <CatalogBanner />

      <div className="relative z-10 -mt-20 md:-mt-32 flex flex-col items-center text-center px-4 mb-8 pointer-events-none">
        {!user && (
          <>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-md">
              {headerContent.title}
            </h1>
            <p className="text-lg text-gray-200 font-light max-w-xl mx-auto drop-shadow-sm">
              {headerContent.subtitle}
            </p>
          </>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 pb-20">
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 text-center bg-gradient-to-r from-orange-900/20 via-black to-orange-900/20 py-6 border-y border-orange-500/20 rounded-lg backdrop-blur-sm"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex items-center gap-2 text-[#FF6B35]">
                <Lock className="w-6 h-6" />
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-white tracking-wide">
                  Catálogo Exclusivo <span className="text-[#FF6B35]">Clientes B2B</span>
                </h1>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="text-gray-400 text-sm md:text-base font-light">
                Preços e condições especiais liberadas para{' '}
                <span className="text-white font-medium">{user.usuario}</span>
              </p>
            </div>
          </motion.div>
        )}

        <div className="bg-[#121212] p-6 rounded-xl shadow-2xl border border-white/10 mb-8 backdrop-blur-sm pointer-events-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="md:w-[420px] md:shrink-0">
            <h2 className="text-2xl font-serif font-bold text-white mb-1">Produtos Disponíveis</h2>
            <p className="text-sm text-gray-500">
              {user
                ? (userLevel >= 5 ? `Tabela Aplicada: ${user.tab_preco || 'Padrão'}` : 'Preços personalizados ativos')
                : 'Faça login para ver preços personalizados'}
              {loadingSortStock ? ' • Ordenando por estoque do dia…' : ''}
              {!loading && !error ? (
              <>
                {' • '}
                <span className="inline-block tabular-nums min-w-[90px]">
                  {filteredAndSortedProducts.length}/{products.length} itens
                </span>
              </>
            ) : ''}
            </p>
          </div>

              <div className="w-full md:flex-1 md:min-w-0 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-full md:justify-end items-center">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Buscar por código ou descrição..."
                    className="w-full pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF6B35] focus:border-[#FF6B35] rounded-md"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none border-[#FF6B35]/30 text-[#FF6B35] hover:bg-[#FF6B35]/10 hover:text-[#FF6B35]"
                    onClick={handleManualRefresh}
                    disabled={isRefreshingStock}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingStock ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-full min-w-0 bg-[#0a0a0a] border-white/10 text-white justify-start text-left pl-3">
                    <SelectValue className="flex-1 text-left truncate" placeholder="Marca" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                    <SelectItem value="all">Marca: todas</SelectItem>
                    {brandOptions.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={comboFilter} onValueChange={setComboFilter}>
                  <SelectTrigger className="w-full min-w-0 bg-[#0a0a0a] border-white/10 text-white justify-start text-left pl-3">
                    <SelectValue className="flex-1 text-left truncate" placeholder="Combo" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                    <SelectItem value="all">Combo: todos</SelectItem>
                    <SelectItem value="combo">Somente combos</SelectItem>
                    <SelectItem value="avulso">Somente avulsos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                  <SelectTrigger className="w-full min-w-0 bg-[#0a0a0a] border-white/10 text-white justify-start text-left pl-3">
                    <SelectValue className="flex-1 text-left truncate" placeholder="Tipo de produto" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                    <SelectItem value="all">Tipo: todos</SelectItem>
                    {productTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortMode} onValueChange={setSortMode}>
                  <SelectTrigger className="w-full min-w-0 bg-[#0a0a0a] border-white/10 text-white justify-start text-left pl-3">
                    <SelectValue className="flex-1 text-left truncate" placeholder="Ordenação" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                    <SelectItem value="stock_desc">Maior estoque</SelectItem>
                    <SelectItem value="stock_asc">Menor estoque</SelectItem>
                    <SelectItem value="name_asc">Descrição A-Z</SelectItem>
                    <SelectItem value="code_asc">Código A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className="text-xs text-gray-400 hover:text-white"
                  onClick={clearCatalogFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-grow">
            {error ? (
              <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-10 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-400 mb-2">Erro ao carregar produtos</h3>
                <p className="text-red-300/70 mb-6">{error}</p>
                <Button variant="outline" onClick={refreshProducts} className="border-red-500/50 text-red-400 hover:bg-red-950">
                  Tentar Novamente
                </Button>
              </div>
            ) : loading ? (
              <div className="flex flex-col justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-10 h-10 text-[#FF6B35] animate-spin mb-4" />
                <p>Carregando catálogo...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedProducts.map(product => (
                  <ProductCard
                    key={product.id || product.codigo}
                    product={product}
                  />
                ))}
              </div>
            )}

            {!loading && !error && filteredAndSortedProducts.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <p className="text-lg">Nenhum produto encontrado com os filtros atuais.</p>
                <Button variant="link" onClick={clearCatalogFilters} className="text-[#FF6B35]">Limpar filtros</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;

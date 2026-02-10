import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import ProductCard from '@/components/ProductCard';
import CatalogBanner from '@/components/CatalogBanner';
import { Search, AlertTriangle, RefreshCw, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { supabase } from '@/lib/customSupabaseClient';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

// ✅ CAP 5: ordenar por estoque disponível HOJE
import { getAvailableStockForDateBatch } from '@/utils/stockValidator';

const CatalogPage = () => {
  const { user } = useSupabaseAuth();
  const { notifyStockUpdate, stockUpdateTrigger } = useCart(); // stockUpdateTrigger (se existir no teu context) ajuda a recalcular
  const { products, loading, error, refreshProducts } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshingStock, setIsRefreshingStock] = useState(false);

  // ✅ mapa: { [codigo]: disponivelHoje }
  const [stockMapToday, setStockMapToday] = useState({});
  const [loadingSortStock, setLoadingSortStock] = useState(false);

  // Dynamic Header Content
  const getPageHeaderContent = () => {
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
  };

  const headerContent = getPageHeaderContent();

  useEffect(() => {
    // Prevent infinite loop by only creating subscription once
    const channel = supabase
      .channel('public:pedidos_stock_tracker')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          notifyStockUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshingStock(true);
    notifyStockUpdate();
    refreshProducts();
    setTimeout(() => setIsRefreshingStock(false), 1000);
  };

  // ✅ CAP 5: calcular disponibilidade HOJE em lote
  useEffect(() => {
    const run = async () => {
      if (!products || products.length === 0) {
        setStockMapToday({});
        return;
      }

      try {
        setLoadingSortStock(true);
        const todayStr = new Date().toISOString().split('T')[0];

        // lista de códigos visíveis
        const codes = products
          .map(p => String(p.codigo || '').trim())
          .filter(Boolean);

        // batelada (1 chamada)
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
    // ⚠️ Recalcula quando o catálogo muda e quando o sistema avisa “estoque mudou”
  }, [products, stockUpdateTrigger]);

  // Memoized Filter & Sort Logic
  const filteredAndSortedProducts = useMemo(() => {
    // 1. Filter by search term
    const filtered = (products || []).filter(p =>
      (p.codigo && String(p.codigo).includes(searchTerm)) ||
      (p.descricao && p.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // 2. Sort by Stock Descending (CAP 5)
    const sorted = [...filtered].sort((a, b) => {
      const codeA = String(a.codigo || '').trim();
      const codeB = String(b.codigo || '').trim();

      // ✅ estoque disponível HOJE (base + entradas - pedidos)
      const stockA = Number(stockMapToday?.[codeA]);
      const stockB = Number(stockMapToday?.[codeB]);

      // fallback seguro se mapa não carregou ainda
      const safeA = !isNaN(stockA) ? stockA : Number(a.estoque_und || 0);
      const safeB = !isNaN(stockB) ? stockB : Number(b.estoque_und || 0);

      if (safeB !== safeA) return safeB - safeA;

      // desempate: código asc
      return String(a.codigo || '').localeCompare(String(b.codigo || ''));
    });

    return sorted;
  }, [products, searchTerm, stockMapToday]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <Helmet>
        <title>Catálogo - Schlosser</title>
      </Helmet>

      {/* Hero Banner Component */}
      <CatalogBanner />

      {/* Conditional Header Content */}
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
        {/* B2B Exclusive Title Section (Only for Logged In Users) */}
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
                Preços e condições especiais liberadas para <span className="text-white font-medium">{user.usuario}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Controls Bar */}
        <div className="bg-[#121212] p-6 rounded-xl shadow-2xl border border-white/10 mb-8 backdrop-blur-sm pointer-events-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h2 className="text-2xl font-serif font-bold text-white mb-1">Produtos Disponíveis</h2>
              <p className="text-sm text-gray-500">
                {user ? `Tabela Aplicada: ${user.tab_preco || 'Padrão'}` : 'Faça login para ver preços personalizados'}
                {loadingSortStock ? ' • Ordenando por estoque do dia…' : ''}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Buscar por código ou descrição..."
                  {/* versão antiga (escura) */}
                  {/* className="w-full pl-10 bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:ring-[#FF6B35] focus:border-[#FF6B35] rounded-md" */}
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
                <Button variant="link" onClick={() => setSearchTerm('')} className="text-[#FF6B35]">Limpar busca</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;

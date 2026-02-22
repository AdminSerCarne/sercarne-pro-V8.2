import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, RefreshCw, Search, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

import { schlosserApi } from '@/services/schlosserApi';
import { stockEntriesService } from '@/services/stockEntriesService';

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatDateLabel = (dateValue) => {
  const raw = String(dateValue || '').trim();
  if (!raw) return '-';

  try {
    const iso = raw.includes('T') ? raw.slice(0, 10) : raw;
    return format(parseISO(iso), 'dd/MM/yyyy');
  } catch {
    return raw;
  }
};

const formatQty = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString('pt-BR') : '0';
};

const getProductDescription = (product) => {
  return String(product?.descricao || product?.descricao_complementar || '').trim() || 'Produto sem descrição';
};

const AdminStockEntriesPanel = () => {
  const { toast } = useToast();

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    data_entrada: todayIso(),
    codigo: '',
    qtd_und: '',
    obs: '',
    search: '',
  });

  const endpointConfigured = stockEntriesService.hasSyncEndpoint();
  const endpointPreview = stockEntriesService.getSyncEndpoint();

  const productsByCode = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const code = String(product?.codigo || '').trim();
      if (code) map.set(code, product);
    });
    return map;
  }, [products]);

  const selectedCode = useMemo(() => {
    const fromCode = onlyDigits(form.codigo);
    if (fromCode && productsByCode.has(fromCode)) return fromCode;

    const fromSearch = onlyDigits(form.search);
    if (fromSearch && productsByCode.has(fromSearch)) return fromSearch;

    return '';
  }, [form.codigo, form.search, productsByCode]);

  const selectedProduct = selectedCode ? productsByCode.get(selectedCode) : null;

  const suggestions = useMemo(() => {
    const query = normalizeText(form.search);
    if (!query) return [];

    const queryDigits = onlyDigits(form.search);
    return products
      .filter((product) => {
        const code = String(product?.codigo || '').trim();
        const desc = normalizeText(getProductDescription(product));
        if (queryDigits && code.includes(queryDigits)) return true;
        return desc.includes(query);
      })
      .slice(0, 8);
  }, [form.search, products]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await schlosserApi.getProducts('admin');
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[AdminStockEntriesPanel] loadProducts:', error);
      setProducts([]);
      toast({
        title: 'Erro ao carregar catálogo',
        description: 'Não foi possível carregar produtos para lançamento.',
        variant: 'destructive',
      });
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

  const loadRecentEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const data = await stockEntriesService.listRecentFromSupabase(30);
      setRecentEntries(data);
    } catch (error) {
      console.error('[AdminStockEntriesPanel] loadRecentEntries:', error);
      setRecentEntries([]);
      toast({
        title: 'Erro ao carregar histórico',
        description: error?.message || 'Falha ao consultar entradas no Supabase.',
        variant: 'destructive',
      });
    } finally {
      setEntriesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
    loadRecentEntries();
  }, [loadProducts, loadRecentEntries]);

  const handleFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectProduct = (product) => {
    const code = String(product?.codigo || '').trim();
    if (!code) return;
    setForm((current) => ({
      ...current,
      codigo: code,
      search: `${code} - ${getProductDescription(product)}`,
    }));
  };

  const clearSelection = () => {
    setForm((current) => ({
      ...current,
      codigo: '',
      search: '',
    }));
  };

  const saveEntry = async () => {
    if (!endpointConfigured) {
      toast({
        title: 'Integração não configurada',
        description: 'Defina VITE_STOCK_ENTRY_SYNC_ENDPOINT na Vercel para habilitar o lançamento pelo site.',
        variant: 'destructive',
      });
      return;
    }

    const data_entrada = String(form.data_entrada || '').trim();
    const codigo = selectedCode;
    const qtd_und = Number(form.qtd_und);
    const obs = String(form.obs || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_entrada)) {
      toast({
        title: 'Data inválida',
        description: 'Informe a data de entrada no formato YYYY-MM-DD.',
        variant: 'destructive',
      });
      return;
    }

    if (!codigo) {
      toast({
        title: 'Produto obrigatório',
        description: 'Selecione um produto válido (código existente).',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(qtd_und) || qtd_und <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await stockEntriesService.createViaSheetSync({
        data_entrada,
        codigo,
        qtd_und,
        obs,
      });

      await loadRecentEntries();

      setForm((current) => ({
        ...current,
        qtd_und: '',
        obs: '',
      }));

      toast({
        title: 'Entrada lançada',
        description: `Produto ${codigo} lançado para ${formatDateLabel(data_entrada)} (UPSERT por código + data).`,
      });
    } catch (error) {
      console.error('[AdminStockEntriesPanel] saveEntry:', error);
      toast({
        title: 'Falha ao lançar entrada',
        description: error?.message || 'Não foi possível enviar o lançamento ao Apps Script.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-[#121212] border-white/10 text-white">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-[#FF6B35]" />
          Entradas de Estoque (ENTRADAS_ESTOQUE)
        </CardTitle>
        <p className="text-sm text-gray-400">
          Lançamento operacional pelo site: grava no Sheets via Apps Script e sincroniza no Supabase para cálculo de estoque.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={endpointConfigured ? 'border-emerald-500/40 text-emerald-300' : 'border-amber-500/40 text-amber-300'}>
            {endpointConfigured ? 'Apps Script configurado' : 'Apps Script pendente'}
          </Badge>
          <Badge variant="outline" className="border-white/10 text-gray-300">
            Catálogo carregado: {productsLoading ? '...' : products.length}
          </Badge>
          <Badge variant="outline" className="border-white/10 text-gray-300">
            Histórico Supabase: {entriesLoading ? '...' : recentEntries.length}
          </Badge>
        </div>

        {!endpointConfigured && (
          <div className="rounded border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
            Configure na Vercel: <strong>VITE_STOCK_ENTRY_SYNC_ENDPOINT</strong>.
            <br />
            Endpoint atual: {endpointPreview || '(não definido)'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <Input
            type="date"
            value={form.data_entrada}
            onChange={(event) => handleFormChange('data_entrada', event.target.value)}
            className="bg-[#0a0a0a] border-white/10 text-white md:col-span-2"
          />

          <Input
            value={form.search}
            onChange={(event) => handleFormChange('search', event.target.value)}
            placeholder="Digite código ou nome do produto"
            className="bg-[#0a0a0a] border-white/10 text-white md:col-span-5"
          />

          <Input
            value={form.codigo}
            onChange={(event) => handleFormChange('codigo', onlyDigits(event.target.value))}
            placeholder="Código"
            className="bg-[#0a0a0a] border-white/10 text-white md:col-span-2"
          />

          <Input
            type="number"
            min="1"
            value={form.qtd_und}
            onChange={(event) => handleFormChange('qtd_und', event.target.value)}
            placeholder="Qtd UND"
            className="bg-[#0a0a0a] border-white/10 text-white md:col-span-2"
          />

          <Button
            type="button"
            onClick={saveEntry}
            disabled={saving}
            className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white md:col-span-1"
          >
            <Send className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <Input
            value={form.obs}
            onChange={(event) => handleFormChange('obs', event.target.value)}
            placeholder="Observação (opcional)"
            className="bg-[#0a0a0a] border-white/10 text-white md:col-span-10"
          />

          <Button
            type="button"
            onClick={() => loadRecentEntries()}
            variant="outline"
            className="border-white/20 text-gray-200 hover:bg-white/10 md:col-span-2"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${entriesLoading ? 'animate-spin' : ''}`} />
            Atualizar histórico
          </Button>
        </div>

        {selectedProduct ? (
          <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2 text-xs text-emerald-200 flex items-center justify-between gap-2">
            <span>
              Selecionado: <strong>{selectedCode}</strong> - {getProductDescription(selectedProduct)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection} className="text-emerald-200 hover:text-white hover:bg-emerald-900/40">
              Limpar
            </Button>
          </div>
        ) : (
          <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-gray-400">
            Digite o código completo ou escolha um produto da sugestão para evitar lançamento incorreto.
          </div>
        )}

        {form.search && suggestions.length > 0 && (
          <div className="rounded border border-white/10 bg-[#0f0f0f] p-2">
            <p className="text-xs uppercase text-gray-500 font-semibold mb-2 flex items-center gap-1">
              <Search className="h-3.5 w-3.5" /> Sugestões
            </p>
            <div className="space-y-1">
              {suggestions.map((product) => {
                const code = String(product?.codigo || '').trim();
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className="w-full text-left rounded border border-white/10 bg-[#0a0a0a] hover:bg-[#131313] px-2 py-1.5 text-xs text-gray-200"
                  >
                    <strong>{code}</strong> - {getProductDescription(product)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded border border-white/10 bg-[#0f0f0f] overflow-hidden">
          <div className="grid grid-cols-12 text-[11px] uppercase tracking-wide font-semibold text-gray-400 bg-black/30 border-b border-white/10 px-2 py-2">
            <span className="col-span-3">Data</span>
            <span className="col-span-3">Código</span>
            <span className="col-span-2">Qtd UND</span>
            <span className="col-span-4">Obs</span>
          </div>

          {entriesLoading ? (
            <div className="p-3 text-xs text-gray-400">Carregando entradas recentes...</div>
          ) : recentEntries.length === 0 ? (
            <div className="p-3 text-xs text-gray-500">Sem lançamentos recentes no Supabase.</div>
          ) : (
            <div className="max-h-64 overflow-auto divide-y divide-white/5">
              {recentEntries.map((entry) => (
                <div key={entry.id || `${entry.codigo}-${entry.data_entrada}-${entry.created_at || ''}`} className="grid grid-cols-12 text-xs text-gray-200 px-2 py-2">
                  <span className="col-span-3">{formatDateLabel(entry.data_entrada)}</span>
                  <span className="col-span-3">{String(entry.codigo || '').trim()}</span>
                  <span className="col-span-2">{formatQty(entry.qtd_und)}</span>
                  <span className="col-span-4 text-gray-400">{String(entry.obs || '').trim() || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminStockEntriesPanel;

import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { AlertTriangle, CheckCircle2, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';

import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { schlosserApi } from '@/services/schlosserApi';
import { buildDesossaShareText, calculateDesossaTotals } from '@/domain/desossaServiceCalculator';

const BASE_SERVICE_CODES = new Set(['400010', '400020', '400025']);
const DEFAULT_SERVICE_FEE = 2.9;
const DEFAULT_EXTRA_BURGER_FEE = 2.9;

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatWeight = (value, maxFractionDigits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(Number(value || 0));

const buildDefaultRow = (id) => ({
  id,
  sourceCode: '',
  serviceCode: '',
  description: '',
  weightKg: '',
  priceKg: '',
});

const resolveBasePrice = (product) => {
  const prices = product?.prices || {};
  const candidates = [prices.TAB5, prices.TAB0, prices.TAB1, prices.TAB4, prices.TAB2, prices.TAB3];
  const found = candidates.find((value) => Number(value) > 0);
  return Number(found || 0);
};

const resolveSuggestedCutPrice = (product) => {
  const prices = product?.prices || {};
  const preferred = Number(prices?.TAB0 || 0); // Coluna V (TAB0)
  if (preferred > 0) return preferred;

  const fallback = [prices.TAB1, prices.TAB4, prices.TAB2, prices.TAB3, prices.TAB5]
    .map((value) => Number(value || 0))
    .find((value) => value > 0);
  return Number(fallback || 0);
};

const ServicoDesossaPage = () => {
  const { toast } = useToast();
  const { user } = useSupabaseAuth();

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [orderName, setOrderName] = useState('');
  const [selectedBaseCode, setSelectedBaseCode] = useState('');
  const [quantityUnd, setQuantityUnd] = useState('20');
  const [pesoMedioPrevistoKg, setPesoMedioPrevistoKg] = useState('');
  const [pesoEntradaRealKg, setPesoEntradaRealKg] = useState('');
  const [basePriceKg, setBasePriceKg] = useState('');
  const [serviceFeeKg, setServiceFeeKg] = useState(String(DEFAULT_SERVICE_FEE));
  const [extraBurgerKg, setExtraBurgerKg] = useState('');
  const [extraBurgerFeeKg, setExtraBurgerFeeKg] = useState(String(DEFAULT_EXTRA_BURGER_FEE));
  const [notes, setNotes] = useState('');
  const [cutRows, setCutRows] = useState([buildDefaultRow(1)]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    setLoadError('');
    try {
      const role = user ? 'vendedor' : 'publico';
      const data = await schlosserApi.getProducts(role);
      const list = Array.isArray(data) ? data : [];
      setProducts(list);
    } catch (error) {
      console.error('[ServicoDesossaPage] loadProducts:', error);
      setProducts([]);
      setLoadError('Não foi possível carregar catálogo para o módulo de desossa.');
    } finally {
      setLoadingProducts(false);
    }
  };

  React.useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productMapByCode = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const code = String(product?.codigo || '').trim();
      if (code) map.set(code, product);
    });
    return map;
  }, [products]);

  const baseProducts = useMemo(() => {
    const explicit = products.filter((product) => BASE_SERVICE_CODES.has(String(product?.codigo || '').trim()));
    if (explicit.length > 0) {
      return explicit.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    }

    return products
      .filter((product) => String(product?.codigo || '').startsWith('4000'))
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  }, [products]);

  React.useEffect(() => {
    if (!baseProducts.length) return;

    const alreadySelected = selectedBaseCode && baseProducts.some((item) => String(item.codigo) === selectedBaseCode);
    if (alreadySelected) return;

    const first = baseProducts[0];
    setSelectedBaseCode(String(first.codigo));
    setPesoMedioPrevistoKg(String(Number(first?.pesoMedio || first?.peso || 0)));
    setBasePriceKg(String(resolveBasePrice(first) || ''));
  }, [baseProducts, selectedBaseCode]);

  const serviceProducts = useMemo(() => {
    const dedupe = new Map();

    products.forEach((product) => {
      const comboServico = product?.comboServico === true;
      const serviceCode = String(product?.codigoServico || '').trim();
      if (!comboServico || !serviceCode) return;

      if (!dedupe.has(serviceCode)) {
        dedupe.set(serviceCode, {
          serviceCode,
          sourceCode: String(product?.codigo || '').trim(),
          description:
            String(product?.descricao || '').trim() ||
            String(product?.descricao_complementar || '').trim() ||
            `Produto ${serviceCode}`,
          suggestedPriceKg: resolveSuggestedCutPrice(product),
        });
      }
    });

    return Array.from(dedupe.values()).sort((a, b) => a.description.localeCompare(b.description));
  }, [products]);

  const serviceMap = useMemo(() => {
    const map = new Map();
    serviceProducts.forEach((item) => map.set(item.serviceCode, item));
    return map;
  }, [serviceProducts]);

  const baseProduct = selectedBaseCode ? productMapByCode.get(selectedBaseCode) || null : null;

  const quantityUndNumber = Math.max(0, toNumber(quantityUnd));
  const weightPerUnitKg = Math.max(0, toNumber(pesoMedioPrevistoKg));
  const estimatedEntryWeightKg = quantityUndNumber * weightPerUnitKg;
  const realEntryWeightKg = Math.max(0, toNumber(pesoEntradaRealKg));
  const weightForNegotiationKg = realEntryWeightKg > 0 ? realEntryWeightKg : estimatedEntryWeightKg;

  const totals = useMemo(
    () =>
      calculateDesossaTotals({
        weightForNegotiationKg,
        basePriceKg: toNumber(basePriceKg),
        serviceFeeKg: toNumber(serviceFeeKg),
        extraBurgerKg: toNumber(extraBurgerKg),
        extraBurgerFeeKg: toNumber(extraBurgerFeeKg),
        entryWeightRealKg: realEntryWeightKg,
        cutRows: cutRows.map((row) => ({
          ...row,
          weightKg: toNumber(row.weightKg),
          priceKg: toNumber(row.priceKg),
        })),
      }),
    [
      weightForNegotiationKg,
      basePriceKg,
      serviceFeeKg,
      extraBurgerKg,
      extraBurgerFeeKg,
      realEntryWeightKg,
      cutRows,
    ]
  );

  const updateCutRow = (id, patch) => {
    setCutRows((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        return { ...row, ...patch };
      })
    );
  };

  const onSelectServiceCode = (id, serviceCode) => {
    const option = serviceMap.get(serviceCode);
    const suggestedPrice = Number(option?.suggestedPriceKg || 0);
    updateCutRow(id, {
      serviceCode,
      sourceCode: option?.sourceCode || '',
      description: option?.description || '',
      priceKg: suggestedPrice > 0 ? String(suggestedPrice) : '',
    });
  };

  const addCutRow = () => {
    setCutRows((rows) => {
      const nextId = rows.length > 0 ? Math.max(...rows.map((row) => Number(row.id || 0))) + 1 : 1;
      return [...rows, buildDefaultRow(nextId)];
    });
  };

  const removeCutRow = (id) => {
    setCutRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)));
  };

  const applyAverageOutputPrice = () => {
    const suggested = totals?.production?.avgOutputPriceKg || 0;
    if (suggested <= 0) {
      toast({
        title: 'Preço médio indisponível',
        description: 'Preencha peso de negociação e linhas de corte para calcular o preço médio de saída.',
        variant: 'destructive',
      });
      return;
    }

    setCutRows((rows) =>
      rows.map((row) => ({
        ...row,
        priceKg: String(suggested),
      }))
    );
  };

  const resetPlanner = () => {
    setOrderName('');
    setQuantityUnd('20');
    setPesoEntradaRealKg('');
    setServiceFeeKg(String(DEFAULT_SERVICE_FEE));
    setExtraBurgerKg('');
    setExtraBurgerFeeKg(String(DEFAULT_EXTRA_BURGER_FEE));
    setNotes('');
    setCutRows([buildDefaultRow(1)]);

    if (baseProducts.length > 0) {
      const first = baseProducts[0];
      setSelectedBaseCode(String(first.codigo));
      setPesoMedioPrevistoKg(String(Number(first?.pesoMedio || first?.peso || 0)));
      setBasePriceKg(String(resolveBasePrice(first) || ''));
    }
  };

  const copySummary = async () => {
    try {
      const text = buildDesossaShareText({
        orderName,
        baseProductCode: selectedBaseCode,
        baseProductName: baseProduct?.descricao || '',
        negotiated: totals.negotiated,
        production: totals.production,
        allocation: totals.allocation,
      });

      await navigator.clipboard.writeText(text);
      toast({
        title: 'Resumo copiado',
        description: 'Texto pronto para envio interno/WhatsApp.',
      });
    } catch (error) {
      toast({
        title: 'Falha ao copiar',
        description: 'Não foi possível copiar o resumo automaticamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Helmet>
        <title>SERviço Desossa | Schlosser PRO</title>
      </Helmet>

      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">SERviço Personalizado de Desossa</h1>
            <p className="text-gray-400 mt-1">
              Fluxo completo: negociação base, produção (peso real) e simulação/rateio de preço por corte.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={loadProducts}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar dados
            </Button>
            <Button
              type="button"
              onClick={copySummary}
              className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar resumo
            </Button>
          </div>
        </section>

        {loadError && (
          <Card className="bg-red-950/20 border-red-500/40">
            <CardContent className="pt-6 text-red-200 text-sm">{loadError}</CardContent>
          </Card>
        )}

        <Card className="bg-[#121212] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">1) Negociação base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4 space-y-1">
                <label className="text-xs text-gray-400">Nome do lote / pedido (opcional)</label>
                <Input
                  value={orderName}
                  onChange={(event) => setOrderName(event.target.value)}
                  placeholder="Ex.: Lote Pronto 10 BAH"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="text-xs text-gray-400">Produto base (meia res)</label>
                <Select
                  value={selectedBaseCode}
                  onValueChange={(value) => {
                    setSelectedBaseCode(value);
                    const selected = productMapByCode.get(value);
                    if (!selected) return;
                    setPesoMedioPrevistoKg(String(Number(selected?.pesoMedio || selected?.peso || 0)));
                    setBasePriceKg(String(resolveBasePrice(selected) || ''));
                  }}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                    <SelectValue placeholder={loadingProducts ? 'Carregando...' : 'Selecione'} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-white/10 text-white">
                    {baseProducts.map((product) => (
                      <SelectItem key={product.codigo} value={String(product.codigo)}>
                        {String(product.codigo)} - {String(product.descricao || '').slice(0, 70)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Qtd. UND (meias res)</label>
                <Input
                  type="number"
                  min="0"
                  value={quantityUnd}
                  onChange={(event) => setQuantityUnd(event.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Qtd. Bovinos (equiv.)</label>
                <Input
                  value={formatWeight(quantityUndNumber / 2, 2)}
                  readOnly
                  className="bg-[#101010] border-white/10 text-gray-300"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Peso médio previsto (kg/UND)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={pesoMedioPrevistoKg}
                  onChange={(event) => setPesoMedioPrevistoKg(event.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Peso entrada real (kg)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={pesoEntradaRealKg}
                  onChange={(event) => setPesoEntradaRealKg(event.target.value)}
                  placeholder="produção lança aqui"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Preço base (R$/kg)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={basePriceKg}
                  onChange={(event) => setBasePriceKg(event.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Taxa desossa (R$/kg)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={serviceFeeKg}
                  onChange={(event) => setServiceFeeKg(event.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Kg para hambúrguer (extra)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={extraBurgerKg}
                  onChange={(event) => setExtraBurgerKg(event.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-gray-400">Taxa extra hambúrguer (R$/kg)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={extraBurgerFeeKg}
                  onChange={(event) => setExtraBurgerFeeKg(event.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>
            </div>

            <div className="rounded border border-white/10 bg-[#0d0d0d] p-3 text-sm text-gray-300">
              Peso previsto de entrada: <strong>{formatWeight(estimatedEntryWeightKg, 3)} kg</strong> | Peso usado na negociação:{' '}
              <strong>{formatWeight(weightForNegotiationKg, 3)} kg</strong>{' '}
              {realEntryWeightKg <= 0 && <span className="text-amber-300">(usando estimado)</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#121212] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">2) Totais da negociação e rendimento</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Preço final (base + serviço)</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(totals.negotiated.effectivePriceKg)}/kg</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Valor base</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(totals.negotiated.baseTotal)}</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Extra hambúrguer</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(totals.negotiated.burgerExtraTotal)}</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Valor final negociado</p>
              <p className="text-lg font-semibold text-[#FF8C42]">{formatCurrency(totals.negotiated.finalTotal)}</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Saída total dos cortes</p>
              <p className="text-lg font-semibold text-white">{formatWeight(totals.production.outputWeightKg, 3)} kg</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Preço médio lote saída</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(totals.production.avgOutputPriceKg)}/kg</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Quebra (ossos/descartes)</p>
              <p className="text-lg font-semibold text-white">
                {formatWeight(totals.production.wasteWeightKg, 3)} kg
              </p>
              <p className="text-xs text-gray-400 mt-1">{formatWeight(totals.production.wastePercent, 2)}%</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3">
              <p className="text-xs text-gray-400">Rendimento de saída</p>
              <p className="text-lg font-semibold text-white">{formatWeight(totals.production.yieldPercent, 2)}%</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3 md:col-span-2">
              <p className="text-xs text-gray-400">Rateio alocado nos cortes</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(totals.allocation.allocatedTotal)}</p>
              <p className="text-xs text-gray-400 mt-1">Cobertura: {formatWeight(totals.allocation.coveragePercent, 2)}%</p>
            </div>

            <div className="rounded border border-white/10 bg-[#0a0a0a] p-3 md:col-span-2">
              <p className="text-xs text-gray-400">Diferença para fechar negociação</p>
              <p
                className={`text-lg font-semibold ${
                  Math.abs(totals.allocation.differenceTotal) < 0.01 ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {formatCurrency(totals.allocation.differenceTotal)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#121212] border-white/10">
          <CardHeader className="space-y-2">
            <CardTitle className="text-white">3) Simulação e rateio por corte</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge
                className={`${
                  totals.allocation.withinTargetRange ? 'bg-emerald-600/30 text-emerald-300' : 'bg-amber-600/20 text-amber-300'
                } border-0`}
              >
                {totals.allocation.withinTargetRange ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Fechamento na faixa 98%-102%
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Ajustar preços dos cortes para fechar 98%-102%
                  </>
                )}
              </Badge>
              <Badge variant="outline" className="border-white/20 text-gray-300">
                Itens combo serviço carregados: {serviceProducts.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={addCutRow}
                className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar corte
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={applyAverageOutputPrice}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Aplicar preço médio do lote
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetPlanner}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Limpar simulação
              </Button>
            </div>

            <div className="space-y-3">
              {cutRows.map((row, index) => {
                const computed = totals.allocation.rows[index] || {};
                const rendimento =
                  weightForNegotiationKg > 0 ? (Number(computed.weightKg || 0) / weightForNegotiationKg) * 100 : 0;
                const serviceInfo = row.serviceCode ? serviceMap.get(row.serviceCode) : null;
                const suggestedPriceKg = Number(serviceInfo?.suggestedPriceKg || 0);

                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded border border-white/10 bg-[#0a0a0a] p-3"
                  >
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs text-gray-400">Corte do serviço (código DD)</label>
                      <Select value={row.serviceCode} onValueChange={(value) => onSelectServiceCode(row.id, value)}>
                        <SelectTrigger className="bg-[#121212] border-white/10 text-white">
                          <SelectValue placeholder="Selecione o corte" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#141414] border-white/10 text-white max-h-[340px]">
                          {serviceProducts.map((product) => (
                            <SelectItem key={product.serviceCode} value={product.serviceCode}>
                              {product.serviceCode} - {product.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs text-gray-400">Código original (D)</label>
                      <Input
                        value={row.sourceCode}
                        readOnly
                        className="bg-[#101010] border-white/10 text-gray-300"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs text-gray-400">Peso saída (kg)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={row.weightKg}
                        onChange={(event) => updateCutRow(row.id, { weightKg: event.target.value })}
                        className="bg-[#121212] border-white/10 text-white"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs text-gray-400">Preço corte (R$/kg)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={row.priceKg}
                        onChange={(event) => updateCutRow(row.id, { priceKg: event.target.value })}
                        className="bg-[#121212] border-white/10 text-white"
                      />
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs text-gray-400">Rend.</label>
                      <Input
                        value={`${formatWeight(rendimento, 2)}%`}
                        readOnly
                        className="bg-[#101010] border-white/10 text-gray-300"
                      />
                    </div>

                    <div className="md:col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeCutRow(row.id)}
                        className="w-full border-white/20 text-white hover:bg-white/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="md:col-span-12 rounded bg-black/40 border border-white/5 p-2 text-sm text-gray-200">
                      <span className="text-gray-400">Subtotal do corte:</span> {formatCurrency(computed.total || 0)}
                      {row.description ? <span className="text-gray-500"> • {row.description}</span> : null}
                      {suggestedPriceKg > 0 ? (
                        <span className="text-gray-500"> • Sugerido TAB0: {formatCurrency(suggestedPriceKg)}/kg</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8">
                <label className="text-xs text-gray-400">Observações operacionais (interno)</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: cliente pediu picanha premium com gramatura específica..."
                  className="w-full min-h-[100px] mt-1 bg-[#0a0a0a] border border-white/10 rounded-md px-3 py-2 text-white"
                />
              </div>
              <div className="md:col-span-4 space-y-2 rounded border border-white/10 bg-[#0a0a0a] p-3">
                <p className="text-sm text-gray-300">
                  Meta de fechamento recomendada: <strong>98% a 102%</strong> do valor negociado.
                </p>
                <p className="text-xs text-gray-400">
                  Comissão exibida no dashboard do vendedor é previsão. Valor real depende de faturamento e recebimento financeiro.
                </p>
                <p className="text-xs text-gray-400">
                  Módulo operacional inicial: simulação e cálculo. Persistência final em banco pode ser ativada na próxima etapa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ServicoDesossaPage;

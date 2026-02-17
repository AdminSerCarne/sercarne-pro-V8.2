export const parseNumberBR = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

  if (typeof val === 'string') {
    // aceita "25,38" ou "4567.67"
    const s = val.trim();

    // Se tiver vírgula como decimal, troca pra ponto
    // e remove separador de milhar quando for caso típico pt-BR
    const normalized =
      s.includes(',') && !s.includes('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s;

    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

export const normalizeItemsInput = (items) => {
  // 1) já é array
  if (Array.isArray(items)) return items;

  // 2) pode vir como string JSON do Supabase: "[{...}]"
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      // se falhar, devolve vazio pra não quebrar
      return [];
    }
  }

  return [];
};

export const calculateWeight = (qtd, peso_medio) => {
  const q = parseNumberBR(qtd);
  const p = parseNumberBR(peso_medio);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
};

export const calculateSubtotal = (qtd, preco_kg, peso_medio) => {
  const weight = calculateWeight(qtd, peso_medio);
  const price = parseNumberBR(preco_kg);
  if (!Number.isFinite(weight) || !Number.isFinite(price)) return 0;
  return weight * price;
};

export const calculateOrderMetrics = (items) => {
  const DEBUG_METRICS = false;

  let totalWeight = 0;
  let totalValue = 0;

  const safeItems = normalizeItemsInput(items);

  const processedItems = safeItems.map((item) => {
    // helpers
    const pick = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');

    // 1) Quantity
    const quantity = parseNumberBR(
      pick(
        item.quantity_unit,
        item.quantity,
        item.quantidade,
        item.qtd,
        item.quantityUnit,   // extra
        item.qty             // extra
      )
    );

    // 2) Price per Kg (agora cobre pricePerKg do supabase)
    const rawPrice = pick(
      item.pricePerKg,
      item.price_per_kg,
      item.preco_kg,
      item.precoKg,
      item.price,
      item.preco
    );
    let pricePerKg = parseNumberBR(rawPrice);
    if (!Number.isFinite(pricePerKg) || pricePerKg < 0) pricePerKg = 0;

    // 3) Average weight (agora cobre averageWeight/pesoMedio)
    const rawWeight = pick(
      item.averageWeight,
      item.pesoMedio,
      item.peso_medio_kg,
      item.peso_medio,
      item.peso
    );
    let averageWeight = parseNumberBR(rawWeight);
    if (!Number.isFinite(averageWeight) || averageWeight < 0) averageWeight = 0;

    const name = item.name || item.descricao || 'Produto sem nome';
    const sku = item.sku || item.codigo || item.SKU || '';

    // 4) Unit type
    let unitType = pick(
      item.unitType,
      item.unidade_estoque,
      item.unit_type,
      item.tipoVenda,
      item.unit,
      item.unidade
    );

    if (!unitType) {
      const numericSku = Number(sku);
      if (!isNaN(numericSku) && numericSku >= 410000) unitType = 'CX';
      else unitType = 'UND';
    }
    unitType = String(unitType).toUpperCase();

    // 5) Estimated weight
    // Se já vier do banco (ex.: total_weight / estimatedWeight), respeita
    const rawEstimatedWeight = pick(item.estimatedWeight, item.total_weight, item.totalWeight);
    let estimatedWeightFromDB = parseNumberBR(rawEstimatedWeight);

    let estimatedWeight = 0;

    if (estimatedWeightFromDB > 0) {
      estimatedWeight = estimatedWeightFromDB;
    } else if (!Number.isFinite(quantity) || quantity < 0) {
      estimatedWeight = 0;
    } else if (unitType === 'CX') {
      estimatedWeight = quantity * 10;
    } else if (unitType === 'KG') {
      estimatedWeight = quantity;
    } else {
      estimatedWeight = calculateWeight(quantity, averageWeight);
    }

    const safeWeight = Number.isFinite(estimatedWeight) ? estimatedWeight : 0;

    // 6) Estimated value
    // Se já vier do banco (ex.: total_value / estimatedValue), respeita
    const rawEstimatedValue = pick(item.estimatedValue, item.total_value, item.totalValue);
    let estimatedValueFromDB = parseNumberBR(rawEstimatedValue);

    const estimatedValue =
      estimatedValueFromDB > 0 ? estimatedValueFromDB : (safeWeight * pricePerKg);

    if (Number.isFinite(safeWeight)) totalWeight += safeWeight;
    if (Number.isFinite(estimatedValue)) totalValue += estimatedValue;

    if (DEBUG_METRICS) {
      // eslint-disable-next-line no-console
      console.log(
        `[Metrics] SKU:${sku} | Qty:${quantity} | Unit:${unitType} | AvgW:${averageWeight} | Price:${pricePerKg} -> W:${safeWeight} | V:${estimatedValue}`
      );
    }

    return {
      ...item,
      name,
      sku,
      unitType,
      quantity,
      pricePerKg,
      averageWeight,
      estimatedWeight: safeWeight,
      estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : 0,
      formattedWeight: safeWeight.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      formattedValue: (Number.isFinite(estimatedValue) ? estimatedValue : 0).toLocaleString(
        'pt-BR',
        { style: 'currency', currency: 'BRL' }
      ),
      pesoMedioDisplay: averageWeight > 0 ? averageWeight.toFixed(3) : 'N/A'
    };
  });

  return {
    totalWeight: Number.isFinite(totalWeight) ? totalWeight : 0,
    totalValue: Number.isFinite(totalValue) ? totalValue : 0,
    processedItems
  };
};

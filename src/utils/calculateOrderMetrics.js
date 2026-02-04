export const calculateWeight = (qtd, peso_medio) => {
  const q = parseFloat(qtd);
  const p = parseFloat(peso_medio);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
};

export const calculateSubtotal = (qtd, preco_kg, peso_medio) => {
  const weight = calculateWeight(qtd, peso_medio);
  const price = parseFloat(preco_kg);
  if (!Number.isFinite(weight) || !Number.isFinite(price)) return 0;
  return weight * price;
};

export const calculateOrderMetrics = (items) => {
  const DEBUG_METRICS = false;

  let totalWeight = 0;
  let totalValue = 0;

  const safeItems = Array.isArray(items) ? items : [];

  const processedItems = safeItems.map((item) => {
    // 1) Quantity
    const quantity = Number(
      item.quantity_unit ??
      item.quantity ??
      item.quantidade ??
      item.qtd ??
      0
    );

    // 2) Price per Kg
    const rawPrice = item.price ?? item.preco ?? item.price_per_kg ?? 0;
    let pricePerKg = parseFloat(rawPrice);
    if (!Number.isFinite(pricePerKg) || pricePerKg < 0) pricePerKg = 0;

    // 3) Average weight
    const rawWeight = item.peso ?? item.pesoMedio ?? item.peso_medio_kg ?? 0;
    let averageWeight = parseFloat(rawWeight);
    if (!Number.isFinite(averageWeight) || averageWeight < 0) averageWeight = 0;

    const name = item.name || item.descricao || 'Produto sem nome';
    const sku = item.sku || item.codigo || '';

    // 4) Unit type
    let unitType =
      item.unitType ??
      item.unidade_estoque ??
      item.unit_type ??
      item.tipoVenda ??
      '';

    if (!unitType) {
      const numericSku = Number(sku);
      if (!isNaN(numericSku) && numericSku >= 410000) unitType = 'CX';
      else unitType = 'UND';
    }
    unitType = String(unitType).toUpperCase();

    // 5) Estimated weight
    let estimatedWeight = 0;
    if (!Number.isFinite(quantity) || quantity < 0) {
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
    const estimatedValue = safeWeight * pricePerKg;

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

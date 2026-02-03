
export const calculateWeight = (qtd, peso_medio) => {
  const q = parseFloat(qtd);
  const p = parseFloat(peso_medio);

  if (!Number.isFinite(q) || !Number.isFinite(p)) {
    console.log('[calculateWeight] Invalid input:', { qtd, peso_medio });
    return 0;
  }
  return q * p;
};

export const calculateSubtotal = (qtd, preco_kg, peso_medio) => {
  const weight = calculateWeight(qtd, peso_medio);
  const price = parseFloat(preco_kg);

  if (!Number.isFinite(weight) || !Number.isFinite(price)) {
    console.log('[calculateSubtotal] Invalid input:', { qtd, preco_kg, peso_medio });
    return 0;
  }
  return weight * price;
};

export const calculateOrderMetrics = (items) => {
  let totalWeight = 0;
  let totalValue = 0;

  const processedItems = items.map(item => {
    // 1. Normalize Input Fields
    const quantity = Number(item.quantity_unit || item.quantidade || 0);
    
    // Defensive Price Extraction
    let rawPrice = item.price;
    if (rawPrice === undefined || rawPrice === null) rawPrice = item.preco;
    if (rawPrice === undefined || rawPrice === null) rawPrice = item.price_per_kg;

    // Force conversion and check NaN
    let pricePerKg = parseFloat(rawPrice);
    if (!Number.isFinite(pricePerKg)) pricePerKg = 0;

    // Defensive Weight Extraction
    let rawWeight = item.peso;
    if (rawWeight === undefined || rawWeight === null) rawWeight = item.pesoMedio;
    
    let averageWeight = parseFloat(rawWeight);
    if (!Number.isFinite(averageWeight)) averageWeight = 0;

    const name = item.name || item.descricao || 'Produto sem nome';
    const sku = item.sku || item.codigo;
    
    if (isNaN(quantity) || quantity < 0) {
        console.warn(`[Metrics] Invalid quantity for ${sku}:`, quantity);
    }

    // 2. Determine Unit Type
    let unitType = item.unit_type || item.tipoVenda;
    
    if (!unitType) {
       const numericSku = Number(sku);
       if (!isNaN(numericSku) && numericSku >= 410000) {
         unitType = 'CX';
       } else {
         unitType = 'UND';
       }
    }
    unitType = String(unitType).toUpperCase();

    // 3. Calculate Estimated Weight
    let estimatedWeight = 0;
    
    if (unitType === 'CX') {
      estimatedWeight = quantity * 10;
    } else if (unitType === 'KG') {
      estimatedWeight = quantity;
    } else {
      // Default to UND behavior, using our safe helper
      estimatedWeight = calculateWeight(quantity, averageWeight);
    }

    // 4. Calculate Estimated Value (Weight * Price)
    // We can use calculateSubtotal logic here, but need to respect the weight calculated above which handles Unit Types
    const safeWeight = Number.isFinite(estimatedWeight) ? estimatedWeight : 0;
    const estimatedValue = safeWeight * pricePerKg;

    // Accumulate Totals
    if (Number.isFinite(estimatedWeight)) totalWeight += estimatedWeight;
    if (Number.isFinite(estimatedValue)) totalValue += estimatedValue;

    // Console Log for Debugging
    console.log(`[Metrics] SKU:${sku} | Qty:${quantity} | AvgW:${averageWeight} | Price:${pricePerKg} -> W:${estimatedWeight} | V:${estimatedValue}`);

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
      // Helper for display
      formattedWeight: safeWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formattedValue: (Number.isFinite(estimatedValue) ? estimatedValue : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      pesoMedioDisplay: averageWeight > 0 ? averageWeight.toFixed(3) : 'N/A'
    };
  });

  return {
    totalWeight: Number.isFinite(totalWeight) ? totalWeight : 0,
    totalValue: Number.isFinite(totalValue) ? totalValue : 0,
    processedItems
  };
};

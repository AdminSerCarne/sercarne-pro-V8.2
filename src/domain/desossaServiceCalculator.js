const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

export const calculateDesossaTotals = ({
  weightForNegotiationKg = 0,
  basePriceKg = 0,
  serviceFeeKg = 0,
  extraBurgerKg = 0,
  extraBurgerFeeKg = 0,
  entryWeightRealKg = 0,
  cutRows = [],
}) => {
  const negotiationWeight = Math.max(0, toNumber(weightForNegotiationKg));
  const priceBase = Math.max(0, toNumber(basePriceKg));
  const fee = Math.max(0, toNumber(serviceFeeKg));
  const burgerKg = Math.max(0, toNumber(extraBurgerKg));
  const burgerFee = Math.max(0, toNumber(extraBurgerFeeKg));
  const entryReal = Math.max(0, toNumber(entryWeightRealKg));

  const effectivePriceKg = priceBase + fee;
  const negotiatedBaseTotal = negotiationWeight * effectivePriceKg;
  const negotiatedBurgerExtraTotal = burgerKg * burgerFee;
  const negotiatedTotal = negotiatedBaseTotal + negotiatedBurgerExtraTotal;

  const normalizedRows = (Array.isArray(cutRows) ? cutRows : []).map((row) => {
    const weightKg = Math.max(0, toNumber(row?.weightKg));
    const priceKg = Math.max(0, toNumber(row?.priceKg));
    const total = weightKg * priceKg;

    return {
      ...row,
      weightKg,
      priceKg,
      total,
    };
  });

  const outputWeightKg = normalizedRows.reduce((sum, row) => sum + row.weightKg, 0);
  const allocatedTotal = normalizedRows.reduce((sum, row) => sum + row.total, 0);

  const baseForYield = entryReal > 0 ? entryReal : negotiationWeight;
  const wasteWeightKg = Math.max(0, baseForYield - outputWeightKg);
  const yieldPercent = baseForYield > 0 ? (outputWeightKg / baseForYield) * 100 : 0;
  const wastePercent = baseForYield > 0 ? (wasteWeightKg / baseForYield) * 100 : 0;

  const avgOutputPriceKg = outputWeightKg > 0 ? negotiatedTotal / outputWeightKg : 0;
  const differenceTotal = negotiatedTotal - allocatedTotal;
  const coveragePercent = negotiatedTotal > 0 ? (allocatedTotal / negotiatedTotal) * 100 : 0;

  const withinTargetRange = coveragePercent >= 98 && coveragePercent <= 102;

  return {
    negotiated: {
      weightKg: round(negotiationWeight, 3),
      basePriceKg: round(priceBase, 4),
      serviceFeeKg: round(fee, 4),
      effectivePriceKg: round(effectivePriceKg, 4),
      baseTotal: round(negotiatedBaseTotal),
      burgerExtraKg: round(burgerKg, 3),
      burgerExtraFeeKg: round(burgerFee, 4),
      burgerExtraTotal: round(negotiatedBurgerExtraTotal),
      finalTotal: round(negotiatedTotal),
    },
    production: {
      entryWeightRealKg: round(entryReal, 3),
      outputWeightKg: round(outputWeightKg, 3),
      wasteWeightKg: round(wasteWeightKg, 3),
      yieldPercent: round(yieldPercent, 2),
      wastePercent: round(wastePercent, 2),
      avgOutputPriceKg: round(avgOutputPriceKg, 4),
    },
    allocation: {
      rows: normalizedRows,
      allocatedTotal: round(allocatedTotal),
      differenceTotal: round(differenceTotal),
      coveragePercent: round(coveragePercent, 2),
      withinTargetRange,
    },
  };
};

export const buildDesossaShareText = ({
  orderName = '',
  baseProductCode = '',
  baseProductName = '',
  negotiated,
  production,
  allocation,
}) => {
  const money = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value));
  const weight = (value, max = 2) =>
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: max,
    }).format(toNumber(value));

  const lines = [
    `*SERviço Desossa* ${orderName ? `- ${orderName}` : ''}`.trim(),
    `Produto base: ${baseProductCode || '-'} ${baseProductName ? `| ${baseProductName}` : ''}`.trim(),
    '------------------------------',
    '*Negociação*',
    `Peso base: ${weight(negotiated?.weightKg, 3)} kg`,
    `Preço base + serviço: ${money(negotiated?.effectivePriceKg)}/kg`,
    `Valor base: ${money(negotiated?.baseTotal)}`,
    `Extra hambúrguer: ${weight(negotiated?.burgerExtraKg, 3)} kg x ${money(negotiated?.burgerExtraFeeKg)}/kg = ${money(negotiated?.burgerExtraTotal)}`,
    `Valor final negociado: ${money(negotiated?.finalTotal)}`,
    '------------------------------',
    '*Produção*',
    `Entrada real: ${weight(production?.entryWeightRealKg, 3)} kg`,
    `Saída total em cortes: ${weight(production?.outputWeightKg, 3)} kg`,
    `Quebra/ossos: ${weight(production?.wasteWeightKg, 3)} kg (${weight(production?.wastePercent, 2)}%)`,
    `Preço médio do lote de saída: ${money(production?.avgOutputPriceKg)}/kg`,
    '------------------------------',
    '*Rateio por cortes*',
  ];

  const rows = Array.isArray(allocation?.rows) ? allocation.rows : [];
  rows.forEach((row) => {
    if (!row?.description) return;
    if (!row?.weightKg) return;
    lines.push(
      `- ${row.description}: ${weight(row.weightKg, 3)} kg x ${money(row.priceKg)}/kg = ${money(row.total)}`
    );
  });

  lines.push('------------------------------');
  lines.push(`Rateio total: ${money(allocation?.allocatedTotal)}`);
  lines.push(`Cobertura da negociação: ${weight(allocation?.coveragePercent, 2)}%`);
  lines.push(`Diferença para fechar: ${money(allocation?.differenceTotal)}`);
  lines.push('Sistema Schlosser PRO • sercarne.com');

  return lines.join('\n');
};

import { ORDER_STATUS, normalizeOrderStatus } from '@/domain/orderStatus';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';

// Ajuste estes percentuais conforme a politica comercial oficial vigente.
// Percentual em decimal: 1% = 0.01
export const COMMISSION_TABLE_RATE = Object.freeze({
  TB0: 0.01,
  TB1: 0.012,
  TB2: 0,
  TB3: 0.013,
  TB4: 0.011,
  TB5: 0.008,
});

// Multiplicador por linha de produto.
export const COMMISSION_LINE_MULTIPLIER = Object.freeze({
  BOVINO_IN_NATURA: 1.0,
  BOVINO_EMBALADO: 1.08,
  OVINO: 1.15,
  INDUSTRIALIZADO: 1.25,
  SERVICO: 1.0,
  OUTROS: 1.0,
});

const TAB_TO_TB = Object.freeze({
  TAB0: 'TB0',
  TAB1: 'TB1',
  TAB2: 'TB2',
  TAB3: 'TB3',
  TAB4: 'TB4',
  TAB5: 'TB5',
});

const resolveTableToken = (raw) => {
  const token = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (!token) return '';
  if (TAB_TO_TB[token]) return TAB_TO_TB[token];
  if (/^TB[0-5]$/.test(token)) return token;
  if (/^[0-5]$/.test(token)) return `TB${token}`;
  return '';
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const classifyProductLine = (item) => {
  const text = normalizeText(
    [
      item?.name,
      item?.descricao,
      item?.product_name,
      item?.sku,
      item?.codigo,
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (!text) return 'OUTROS';

  if (
    text.includes('HAMBURGUER') ||
    text.includes('LINGUICA') ||
    text.includes('EMBUT') ||
    text.includes('SALSICHA') ||
    text.includes('CALABRESA')
  ) {
    return 'INDUSTRIALIZADO';
  }

  if (text.includes('OVINO') || text.includes('CORDEIRO') || text.includes('CARNEIRO')) {
    return 'OVINO';
  }

  if (text.includes('DESOSSA') || text.includes('SERVICO') || text.includes('SERVICO')) {
    return 'SERVICO';
  }

  if (text.includes('BOVIN') || text.includes('NOVILHO') || text.includes('VACA') || text.includes('MEIA RES') || text.includes('CARCACA') || text.includes('GANCHO')) {
    if (text.includes('CONGEL') || text.includes('RESFRIAD') || text.includes('EMBALAD')) {
      return 'BOVINO_EMBALADO';
    }
    return 'BOVINO_IN_NATURA';
  }

  return 'OUTROS';
};

const inferTableByVolumeAndLevel = (items, userLevel) => {
  const totalUnd = items.reduce((acc, item) => {
    return acc + toNumber(item?.quantity_unit ?? item?.quantity ?? item?.quantidade ?? 0);
  }, 0);

  if (Number(userLevel) === 3) return 'TB2';
  if (totalUnd === 1) return 'TB1';
  if (totalUnd >= 2 && totalUnd <= 9) return 'TB0';
  if (totalUnd >= 10) return 'TB4';
  return 'TB3';
};

const resolveOrderTable = (order, items, userLevel) => {
  const orderTable =
    resolveTableToken(order?.commission_table) ||
    resolveTableToken(order?.price_table) ||
    resolveTableToken(order?.tabela) ||
    resolveTableToken(order?.tab_aplicada);

  if (orderTable) return { table: orderTable, source: 'order' };

  for (const item of items) {
    const itemTable =
      resolveTableToken(item?.applied_tab) ||
      resolveTableToken(item?.appliedTable) ||
      resolveTableToken(item?.price_table) ||
      resolveTableToken(item?.table) ||
      resolveTableToken(item?.tabName);
    if (itemTable) return { table: itemTable, source: 'item' };
  }

  return { table: inferTableByVolumeAndLevel(items, userLevel), source: 'inferred' };
};

export const calculateOrderCommissionPreview = (order, options = {}) => {
  const userLevel = Number(options?.userLevel || 0);
  const status = normalizeOrderStatus(order?.status);
  const cancelled = status === ORDER_STATUS.CANCELADO;

  const rawItems = parseItems(order?.items);
  const metrics = calculateOrderMetrics(rawItems);
  const processedItems = Array.isArray(metrics?.processedItems) ? metrics.processedItems : [];
  const tableInfo = resolveOrderTable(order, processedItems, userLevel);
  const tableRate = toNumber(COMMISSION_TABLE_RATE[tableInfo.table]);

  const itemsBreakdown = processedItems.map((item) => {
    const grossValue = toNumber(
      item?.total ??
      item?.total_value ??
      item?.estimatedValue ??
      item?.subtotal ??
      item?.estimated_value
    );
    const line = classifyProductLine(item);
    const multiplier = toNumber(COMMISSION_LINE_MULTIPLIER[line] || COMMISSION_LINE_MULTIPLIER.OUTROS || 1);
    const effectiveRate = tableRate * multiplier;
    const commissionValue = cancelled ? 0 : grossValue * effectiveRate;

    return {
      line,
      grossValue,
      multiplier,
      effectiveRate,
      commissionValue,
    };
  });

  const grossValueFromItems = itemsBreakdown.reduce((acc, item) => acc + item.grossValue, 0);
  const grossValue = toNumber(order?.total_value) > 0 ? toNumber(order?.total_value) : grossValueFromItems;
  const previewCommission = itemsBreakdown.reduce((acc, item) => acc + item.commissionValue, 0);

  const eligibleForInvoice = !cancelled && status === ORDER_STATUS.ENTREGUE;

  return {
    orderId: order?.id,
    status,
    table: tableInfo.table,
    tableSource: tableInfo.source,
    tableRate,
    grossValue,
    previewCommission,
    eligibleForInvoice,
    cancelled,
    itemsBreakdown,
  };
};

export const calculateCommissionSummary = (orders, options = {}) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const rows = safeOrders.map((order) => calculateOrderCommissionPreview(order, options));

  const previewTotal = rows.reduce((acc, row) => acc + row.previewCommission, 0);
  const deliveredEligibleTotal = rows
    .filter((row) => row.eligibleForInvoice)
    .reduce((acc, row) => acc + row.previewCommission, 0);
  const pipelineTotal = rows
    .filter((row) => !row.cancelled && !row.eligibleForInvoice)
    .reduce((acc, row) => acc + row.previewCommission, 0);

  const zeroRateCount = rows.filter((row) => row.tableRate <= 0 && !row.cancelled).length;
  const inferredTableCount = rows.filter((row) => row.tableSource === 'inferred').length;

  return {
    rows,
    totals: {
      previewTotal,
      deliveredEligibleTotal,
      pipelineTotal,
    },
    warnings: {
      zeroRateCount,
      inferredTableCount,
    },
  };
};


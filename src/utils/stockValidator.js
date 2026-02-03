import { supabase } from '@/lib/customSupabaseClient';
import { fetchStockData, getEntradasEstoque } from '@/services/googleSheetsService';
import { addDays } from 'date-fns';

const getToday = () => new Date().toISOString().split('T')[0];

let baseStockCache = { data: null, timestamp: 0 };
let entriesCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 60 * 1000;

// -------------------------
// SHEETS CACHE HELPERS
// -------------------------
const getBaseStockData = async () => {
  const now = Date.now();
  if (baseStockCache.data && (now - baseStockCache.timestamp < CACHE_DURATION)) {
    return baseStockCache.data;
  }
  const data = await fetchStockData();
  baseStockCache = { data, timestamp: now };
  return data;
};

const getEntriesData = async () => {
  const now = Date.now();
  if (entriesCache.data && (now - entriesCache.timestamp < CACHE_DURATION)) {
    return entriesCache.data;
  }
  const data = await getEntradasEstoque();
  entriesCache = { data, timestamp: now };
  return data;
};

// -------------------------
// PEDIDOS COMPROMETIDOS (DB)
// -------------------------
const getCommittedOrders = async (productCode, targetDateStr) => {
  console.log(`[StockValidator] Fetching committed orders for ${productCode} until ${targetDateStr}`);

  // ✅ Compatível com legado e Manual V8
  const COMMIT_STATUSES = [
    'PEDIDO ENVIADO',
    'PEDIDO CONFIRMADO',
    'SEU PEDIDO SAIU PARA ENTREGA',

    // legados possíveis:
    'CONFIRMADO',
    'ENVIADO',
    'SAIU PARA ENTREGA'
  ];

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, items, delivery_date, status')
    .in('status', COMMIT_STATUSES)
    .lte('delivery_date', targetDateStr);

  if (error) {
    console.error('[StockValidator] Error fetching pedidos:', error);
    return { total: 0 };
  }

  let totalQty = 0;
  const safeCode = String(productCode).trim();

  (data || []).forEach(order => {
    let items = order.items;

    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    if (Array.isArray(items)) {
      items.forEach(item => {
        const itemCode = String(item.codigo || item.id || item.sku || '').trim();
        if (itemCode === safeCode) {
          const qty = parseInt(item.quantidade || item.quantity || item.quantity_unit || 0);
          if (!isNaN(qty)) totalQty += qty;
        }
      });
    }
  });

  console.log(`[StockValidator] Found total ${totalQty} committed units for ${productCode}`);
  return { total: totalQty };
};

/**
 * ✅ NOVO (CAP 5: ordenação/uso sem travar)
 * Puxa pedidos comprometidos em 1 query e soma por SKU para uma data.
 * Retorna um map: { [codigo]: totalComprometido }
 */
const getCommittedOrdersMapUntilDate = async (targetDateStr) => {
  // mesmos status do Manual
  const COMMIT_STATUSES = [
    'PEDIDO ENVIADO',
    'PEDIDO CONFIRMADO',
    'SEU PEDIDO SAIU PARA ENTREGA',

    // legados possíveis:
    'CONFIRMADO',
    'ENVIADO',
    'SAIU PARA ENTREGA'
  ];

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, items, delivery_date, status')
    .in('status', COMMIT_STATUSES)
    .lte('delivery_date', targetDateStr);

  if (error) {
    console.error('[StockValidator] Error fetching pedidos (map):', error);
    return {};
  }

  const map = {};

  (data || []).forEach(order => {
    let items = order.items;

    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    if (!Array.isArray(items)) return;

    items.forEach(item => {
      const code = String(item.codigo || item.id || item.sku || '').trim();
      if (!code) return;

      const qty = parseInt(item.quantidade || item.quantity || item.quantity_unit || 0);
      if (isNaN(qty) || qty <= 0) return;

      map[code] = (map[code] || 0) + qty;
    });
  });

  return map;
};

// -------------------------
// BREAKDOWN (1 SKU)
// -------------------------
export const getStockBreakdown = async (productCode, date) => {
  const safeCode = String(productCode).trim();
  const targetDateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;

  console.groupCollapsed(`[StockValidator] Breakdown for ${safeCode} @ ${targetDateStr}`);

  // 1. Base Stock
  const stockData = await getBaseStockData();
  const productBase = stockData.find(p => String(p.codigo_produto) === safeCode);
  const baseStock = productBase ? (parseInt(productBase.estoque_und) || 0) : 0;
  console.log(`Base Stock (Sheet): ${baseStock}`);

  // 2. Entries (Up to Target Date)
  const allEntries = await getEntriesData();
  const entriesUntilDate = allEntries
    .filter(e => String(e.codigo) === safeCode && e.data_entrada <= targetDateStr)
    .reduce((sum, e) => sum + (e.qtd_und || 0), 0);
  console.log(`Entries (Sheet) <= Date: ${entriesUntilDate}`);

  // 3. Confirmed Orders (Up to Target Date)
  const { total: pedidosTotal } = await getCommittedOrders(safeCode, targetDateStr);
  console.log(`Confirmed Orders (DB) <= Date: ${pedidosTotal}`);

  // 4. Formula: Disponivel = Base + Entradas - Pedidos
  const available = baseStock + entriesUntilDate - pedidosTotal;
  console.log(`Final Calculation: ${baseStock} + ${entriesUntilDate} - ${pedidosTotal} = ${available}`);

  console.groupEnd();

  return {
    available: Math.max(0, available),
    rawAvailable: available,
    base: baseStock,
    entradas: entriesUntilDate,
    pedidos: pedidosTotal,
    targetDate: targetDateStr
  };
};

export const getAvailableStockForDate = async (productCode, date) => {
  const breakdown = await getStockBreakdown(productCode, date);
  return breakdown.available;
};

// Alias for getAvailableStockForDate to maintain compatibility with CheckoutModal
export const calcularEstoqueData = async (productCode, date) => {
  return getAvailableStockForDate(productCode, date);
};

// -------------------------
// ✅ NOVO: ESTOQUE EM LOTE (1 DATA)
// -------------------------
/**
 * Retorna um map { [codigo]: available } para uma lista de SKUs em uma data.
 * - Reusa cache do Sheets
 * - Faz 1 query no Supabase para pedidos comprometidos
 * - Faz soma eficiente de entradas por SKU (<= data)
 */
export const getAvailableStockForDateBatch = async (productCodes, date) => {
  const targetDateStr = date instanceof Date ? date.toISOString().split('T')[0] : String(date || '').split('T')[0];
  const codes = Array.from(
    new Set((productCodes || []).map(c => String(c).trim()).filter(Boolean))
  );

  if (codes.length === 0) return {};

  // 1) Base
  const stockData = await getBaseStockData();
  const baseMap = {};
  stockData.forEach(p => {
    const code = String(p.codigo_produto || '').trim();
    if (!code) return;
    if (!codes.includes(code)) return;
    baseMap[code] = parseInt(p.estoque_und) || 0;
  });

  // 2) Entradas
  const allEntries = await getEntriesData();
  const entriesMap = {};
  allEntries.forEach(e => {
    const code = String(e.codigo || '').trim();
    if (!code) return;
    if (!codes.includes(code)) return;
    if (String(e.data_entrada) > targetDateStr) return;

    const q = parseInt(e.qtd_und || 0);
    if (isNaN(q) || q <= 0) return;

    entriesMap[code] = (entriesMap[code] || 0) + q;
  });

  // 3) Pedidos comprometidos
  const committedMap = await getCommittedOrdersMapUntilDate(targetDateStr);

  // 4) Disponível = Base + Entradas - Pedidos
  const out = {};
  codes.forEach(code => {
    const base = baseMap[code] || 0;
    const ent = entriesMap[code] || 0;
    const ped = committedMap[code] || 0;
    const available = base + ent - ped;
    out[code] = Math.max(0, available);
  });

  return out;
};

// -------------------------
// SUGESTÃO DE DATA (mantém)
// -------------------------
export const getFutureStockAvailability = async (productCode, neededQty) => {
  const today = new Date();
  const suggestions = [];

  for (let i = 1; i <= 30; i++) {
    const nextDate = addDays(today, i);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    const breakdown = await getStockBreakdown(productCode, nextDateStr);

    if (breakdown.available >= neededQty) {
      suggestions.push({
        date: nextDateStr,
        available: breakdown.available
      });
      if (suggestions.length >= 1) break;
    }
  }
  return suggestions;
};

export const validateAndSuggestAlternativeDate = async (productCode, requestedQty, currentDate) => {
  let start = currentDate instanceof Date ? currentDate : new Date(currentDate);
  if (isNaN(start.getTime())) start = new Date();

  const dateStr = start.toISOString().split('T')[0];
  const breakdown = await getStockBreakdown(productCode, dateStr);

  if (breakdown.available >= requestedQty) {
    return {
      isValid: true,
      availableQty: breakdown.available,
      currentDate: dateStr,
      breakdown
    };
  }

  let suggestedDate = null;
  let daysAhead = 0;

  for (let i = 1; i <= 30; i++) {
    const nextDate = addDays(start, i);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const nextBreakdown = await getStockBreakdown(productCode, nextDateStr);

    if (nextBreakdown.available >= requestedQty) {
      suggestedDate = nextDateStr;
      daysAhead = i;
      break;
    }
  }

  return {
    isValid: false,
    availableQty: breakdown.available,
    currentDate: dateStr,
    suggestedDate,
    daysAhead,
    breakdown
  };
};

// -------------------------
// WEEKLY SCHEDULE (mantém, mas otimizado)
// -------------------------
export const getWeeklyStockSchedule = async (productCode) => {
  const today = new Date();
  const safeCode = String(productCode).trim();
  const schedule = [];

  // ✅ otimização simples: 7 dias = 7 chamadas ainda (ok),
  // mas agora já tem o batch se tu quiser evoluir depois.
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const dateStr = date.toISOString().split('T')[0];
    const qty = await getAvailableStockForDate(safeCode, dateStr);
    schedule.push({ date: dateStr, qty });
  }
  return schedule;
};

export const validateStockForAllProducts = async (cartItems, deliveryDate) => {
  const dateStr = deliveryDate instanceof Date
    ? deliveryDate.toISOString().split('T')[0]
    : String(deliveryDate || '').split('T')[0];

  const insufficientProducts = [];

  for (const item of cartItems) {
    const breakdown = await getStockBreakdown(item.codigo, dateStr);
    if (breakdown.available < item.quantidade) {
      insufficientProducts.push({
        ...item,
        available: breakdown.available,
        breakdown,
        needed: item.quantidade
      });
    }
  }

  return {
    isValid: insufficientProducts.length === 0,
    insufficientProducts
  };
};

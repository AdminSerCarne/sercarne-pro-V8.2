import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { ORDER_STATUS } from '@/domain/orderStatus';
import {
  EXTRA_TRUCK_CLIENT_THRESHOLD_KG,
  ROUTE_TARGET_CAPACITY_KG,
} from '@/domain/fleetConfig';
import {
  calculateOrderWeightKg,
  normalizeRouteName,
  toISODateKey,
} from '@/utils/fleetPlanner';
import { logisticsHelper } from '@/utils/logisticsHelper';
import { schlosserApi } from '@/services/schlosserApi';

const COMMITTED_STATUSES = [
  ORDER_STATUS.ENVIADO,
  ORDER_STATUS.CONFIRMADO,
  ORDER_STATUS.SAIU_PARA_ENTREGA,
  'PENDENTE',
  'ENVIADO',
  'CONFIRMADO',
  'SAIU PARA ENTREGA',
];

const routesMatch = (orderRoute, targetRoute) => {
  const orderNorm = normalizeRouteName(orderRoute || '');
  const targetNorm = normalizeRouteName(targetRoute || '');

  if (!orderNorm || !targetNorm) return false;
  return (
    orderNorm === targetNorm ||
    orderNorm.includes(targetNorm) ||
    targetNorm.includes(orderNorm)
  );
};

const formatDateLabel = (dateISO) => {
  try {
    return format(parseISO(dateISO), 'dd/MM/yyyy');
  } catch {
    return dateISO;
  }
};

const buildClientLoad = (orders) => {
  const map = new Map();

  (orders || []).forEach((order) => {
    const key = String(order?.client_name || order?.client_id || 'SEM CLIENTE').trim() || 'SEM CLIENTE';
    const previous = map.get(key) || { clientName: key, weightKg: 0, orders: 0 };

    previous.weightKg += calculateOrderWeightKg(order);
    previous.orders += 1;

    map.set(key, previous);
  });

  return Array.from(map.values()).sort((a, b) => Number(b.weightKg || 0) - Number(a.weightKg || 0));
};

const sumOrdersWeight = (orders) =>
  (orders || []).reduce((acc, order) => acc + calculateOrderWeightKg(order), 0);

export const routeCapacityService = {
  async fetchCommittedOrdersByDate(deliveryDateLike) {
    const deliveryDateISO = toISODateKey(deliveryDateLike);
    if (!deliveryDateISO || deliveryDateISO === 'SEM-DATA') return [];

    const { data, error } = await supabase
      .from('pedidos')
      .select('id, route_name, client_name, client_id, total_weight, items, status, delivery_date')
      .eq('delivery_date', deliveryDateISO)
      .in('status', COMMITTED_STATUSES);

    if (error) throw new Error(`Erro ao consultar carga da rota: ${error.message}`);
    return Array.isArray(data) ? data : [];
  },

  async getRouteCapacitySnapshot({
    deliveryDate,
    routeName,
    pendingWeightKg = 0,
    pendingClientName = 'PEDIDO EM ANALISE',
  }) {
    const deliveryDateISO = toISODateKey(deliveryDate);
    if (!deliveryDateISO || deliveryDateISO === 'SEM-DATA') {
      throw new Error('Data de entrega inválida para validação de capacidade.');
    }

    const targetRoute = String(routeName || '').trim();
    if (!targetRoute) {
      throw new Error('Rota inválida para validação de capacidade.');
    }

    const committedOrders = await this.fetchCommittedOrdersByDate(deliveryDateISO);
    const routeOrders = committedOrders.filter((order) => routesMatch(order?.route_name, targetRoute));

    const currentWeightKg = sumOrdersWeight(routeOrders);
    const pendingSafe = Number(pendingWeightKg || 0);
    const projectedWeightKg = currentWeightKg + (Number.isFinite(pendingSafe) ? pendingSafe : 0);

    const currentPercent = ROUTE_TARGET_CAPACITY_KG > 0
      ? (currentWeightKg / ROUTE_TARGET_CAPACITY_KG) * 100
      : 0;

    const projectedPercent = ROUTE_TARGET_CAPACITY_KG > 0
      ? (projectedWeightKg / ROUTE_TARGET_CAPACITY_KG) * 100
      : 0;

    const clients = buildClientLoad(routeOrders);
    if (pendingSafe > 0) {
      const pendingClientKey = String(pendingClientName || 'PEDIDO EM ANALISE').trim() || 'PEDIDO EM ANALISE';
      const existingIndex = clients.findIndex((entry) => entry.clientName === pendingClientKey);
      if (existingIndex >= 0) {
        clients[existingIndex].weightKg += pendingSafe;
      } else {
        clients.push({ clientName: pendingClientKey, weightKg: pendingSafe, orders: 1 });
      }
    }

    const sortedClients = clients.sort((a, b) => Number(b.weightKg || 0) - Number(a.weightKg || 0));
    const largestClient = sortedClients[0] || null;

    return {
      deliveryDateISO,
      routeName: targetRoute,
      targetCapacityKg: ROUTE_TARGET_CAPACITY_KG,
      currentWeightKg,
      projectedWeightKg,
      currentPercent,
      projectedPercent,
      isOverCapacity: projectedPercent > 100,
      clients: sortedClients,
      largestClient,
      extraTruckRequired: Boolean(largestClient && Number(largestClient.weightKg || 0) > EXTRA_TRUCK_CLIENT_THRESHOLD_KG),
      routeOrdersCount: routeOrders.length,
    };
  },

  async suggestNextValidDeliveryDate(routeName, currentDateLike) {
    const targetRoute = String(routeName || '').trim();
    if (!targetRoute) return null;

    const routes = await schlosserApi.getRoutes();
    const route = (routes || []).find((item) =>
      routesMatch(item?.descricao_grupo_rota, targetRoute)
    );

    if (!route) return null;

    const currentISO = toISODateKey(currentDateLike);
    const candidates = logisticsHelper.generateValidDates(
      {
        dias: route?.dias_entrega || '',
        corte: route?.corte_ate || '17:00',
      },
      60
    );

    const suggestion = candidates.find((candidate) => {
      if (!candidate?.isValid || !candidate?.date) return false;
      const iso = toISODateKey(candidate.date);
      if (!iso || iso === 'SEM-DATA') return false;
      return iso > currentISO;
    });

    if (!suggestion?.date) return null;

    const suggestionISO = toISODateKey(suggestion.date);

    return {
      routeName: route?.descricao_grupo_rota || targetRoute,
      cutoff: route?.corte_ate || '17:00',
      dateISO: suggestionISO,
      dateLabel: formatDateLabel(suggestionISO),
    };
  },

  formatCapacityBlockMessage(snapshot, suggestion) {
    const projected = Number(snapshot?.projectedWeightKg || 0);
    const percent = Number(snapshot?.projectedPercent || 0);

    if (suggestion?.dateLabel) {
      return `Carga prevista ${projected.toFixed(2)}kg (${percent.toFixed(1)}%). Limite da rota excedido. Sugestão: ${suggestion.dateLabel}.`;
    }

    return `Carga prevista ${projected.toFixed(2)}kg (${percent.toFixed(1)}%). Limite da rota excedido. Selecione a próxima data válida.`;
  },
};

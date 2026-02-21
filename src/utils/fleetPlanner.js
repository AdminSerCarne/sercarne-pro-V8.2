import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { isCommittedStatus } from '@/domain/orderStatus';
import {
  DEFAULT_FLEET,
  EXTRA_TRUCK_CLIENT_THRESHOLD_KG,
  ROUTE_TARGET_CAPACITY_KG,
  normalizeFleet,
} from '@/domain/fleetConfig';

const LOCAL_ROUTE_KEYWORDS = [
  'LOCAL',
  'TRANSFER',
  'TRANSFERENCIA',
  'TRANSFERÊN',
  'LOJA',
  'MATRIZ',
  'INTERNA',
];

const DISTANT_ROUTE_KEYWORDS = [
  'PORTO ALEGRE',
  'CANOAS',
  'GRAVATAI',
  'GRAVATAÍ',
  'VIAMAO',
  'VIAMÃO',
  'ALVORADA',
  'NOVO HAMBURGO',
  'SAO LEOPOLDO',
  'SÃO LEOPOLDO',
  'CAPITAL',
];

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

export const normalizeRouteName = (routeName) => normalizeText(routeName || 'SEM ROTA');

const normalizeCityToken = (value) => {
  const city = String(value || '').trim();
  if (!city) return '';
  const normalized = normalizeText(city);
  if (!normalized) return '';
  if (normalized === 'SEM ROTA' || normalized === 'SEM CIDADE') return '';
  return normalized;
};

const extractCitiesFromRouteName = (routeNameRaw) => {
  const raw = String(routeNameRaw || '').trim();
  if (!raw) return [];

  const out = [];

  const parenthesis = raw.match(/\(([^)]+)\)/);
  if (parenthesis?.[1]) {
    parenthesis[1]
      .split(/[;,/|]/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => out.push(part));
  }

  const segments = raw.split(' - ').map((part) => part.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const possibleCity = segments[segments.length - 1];
    const normalizedPossibleCity = normalizeText(possibleCity);
    if (
      normalizedPossibleCity &&
      !normalizedPossibleCity.includes('ROTA') &&
      normalizedPossibleCity !== normalizeText(raw)
    ) {
      out.push(possibleCity);
    }
  }

  return Array.from(new Set(out));
};

export const toISODateKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'SEM-DATA';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'SEM-DATA';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseOrderItems = (items) => {
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

export const calculateOrderWeightKg = (order) => {
  const fromDb = Number(order?.total_weight || 0);
  if (Number.isFinite(fromDb) && fromDb > 0) return fromDb;

  const metrics = calculateOrderMetrics(parseOrderItems(order?.items));
  return Number(metrics?.totalWeight || 0);
};

const resolveRouteType = (routeName) => {
  const normalized = normalizeRouteName(routeName);

  if (LOCAL_ROUTE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'local';
  }

  if (DISTANT_ROUTE_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))) {
    return 'distant';
  }

  return 'regional';
};

const getVehicle = (fleet, id) => {
  const target = fleet.find((item) => item.id === id && item.ativo);
  return target || null;
};

const getVehicleCapacity = (vehicle) => {
  const parsed = Number(vehicle?.capacidadeKg || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

export const getCapacitySignal = (percentRaw) => {
  const percent = Number(percentRaw || 0);

  if (percent > 100) {
    return {
      key: 'blocked',
      label: 'Bloqueado (>100%)',
      barClass: 'bg-red-600',
      textClass: 'text-red-400',
      emoji: '⛔',
    };
  }

  if (percent <= 35) {
    return {
      key: 'low',
      label: 'Baixa ocupação (até 35%)',
      barClass: 'bg-red-500',
      textClass: 'text-red-300',
      emoji: '🔴',
    };
  }

  if (percent < 70) {
    return {
      key: 'medium',
      label: 'Ocupação média (35-65%)',
      barClass: 'bg-amber-400',
      textClass: 'text-amber-300',
      emoji: '🟡',
    };
  }

  if (percent >= 90) {
    return {
      key: 'excellent',
      label: 'Excelente (>90%)',
      barClass: 'bg-emerald-500',
      textClass: 'text-emerald-300',
      emoji: '🎉',
    };
  }

  return {
    key: 'good',
    label: 'Boa ocupação (>70%)',
    barClass: 'bg-green-500',
    textClass: 'text-green-300',
    emoji: '🟢',
  };
};

const resolveBaseVehicle = (routeType, routeWeight, fleet) => {
  const vwNew = getVehicle(fleet, 'vw-new-2025');
  const iveco = getVehicle(fleet, 'iveco-reformado');
  const vwOld = getVehicle(fleet, 'vw-old');
  const volvo = getVehicle(fleet, 'volvo-truck-old');

  if (routeType === 'local') {
    if (routeWeight > getVehicleCapacity(vwOld) && volvo) return volvo;
    return vwOld || volvo || vwNew || iveco || null;
  }

  if (routeType === 'distant') {
    return vwNew || iveco || volvo || vwOld || null;
  }

  return iveco || vwNew || volvo || vwOld || null;
};

export const assignFleetForDayRoutes = (routesInput, fleetLike) => {
  const fleet = normalizeFleet(fleetLike || DEFAULT_FLEET);
  const routes = Array.isArray(routesInput) ? routesInput.map((route) => ({ ...route })) : [];

  if (routes.length === 0) return routes;

  routes.forEach((route) => {
    route.routeType = route.routeType || resolveRouteType(route.routeName || route.routeKey);
    route.assignedVehicle = resolveBaseVehicle(route.routeType, route.totalWeight, fleet);
    route.assignmentReason = route.routeType === 'local'
      ? 'Rota local prioriza Volvo/VW velho.'
      : route.routeType === 'distant'
      ? 'Rota longa prioriza VW novo.'
      : 'Rota regional prioriza Iveco.';
  });

  const nonLocal = routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => route.routeType !== 'local')
    .sort((a, b) => {
      const distanceScoreA = a.route.routeType === 'distant' ? 2 : 1;
      const distanceScoreB = b.route.routeType === 'distant' ? 2 : 1;
      if (distanceScoreA !== distanceScoreB) return distanceScoreB - distanceScoreA;
      return (b.route.totalWeight || 0) - (a.route.totalWeight || 0);
    });

  const vwNew = getVehicle(fleet, 'vw-new-2025');
  const iveco = getVehicle(fleet, 'iveco-reformado');
  const van = getVehicle(fleet, 'ducato-van');

  if (vwNew && nonLocal[0]) {
    routes[nonLocal[0].index].assignedVehicle = vwNew;
    routes[nonLocal[0].index].assignmentReason = 'Rota mais longa do dia: VW 2025 novo.';
  }

  if (iveco && nonLocal[1]) {
    routes[nonLocal[1].index].assignedVehicle = iveco;
    routes[nonLocal[1].index].assignmentReason = 'Segunda rota longa/regional: Iveco.';
  }

  if (van) {
    const positiveLoads = routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) => Number(route.totalWeight || 0) > 0)
      .sort((a, b) => Number(a.route.totalWeight || 0) - Number(b.route.totalWeight || 0));

    const smallest = positiveLoads[0];
    if (smallest) {
      const vanCapacity = getVehicleCapacity(van);
      if (Number(smallest.route.totalWeight || 0) <= vanCapacity) {
        routes[smallest.index].assignedVehicle = van;
        routes[smallest.index].assignmentReason = 'Menor carga do dia: Van Ducato.';
      } else {
        routes[smallest.index].vanSuggestionRejected = true;
      }
    }
  }

  return routes.map((route) => {
    const assignedCapacity = getVehicleCapacity(route.assignedVehicle);
    const targetPercent = ROUTE_TARGET_CAPACITY_KG > 0
      ? (Number(route.totalWeight || 0) / ROUTE_TARGET_CAPACITY_KG) * 100
      : 0;
    const vehiclePercent = assignedCapacity > 0
      ? (Number(route.totalWeight || 0) / assignedCapacity) * 100
      : 0;

    const largestClient = (route.clients || [])
      .slice()
      .sort((a, b) => Number(b.weightKg || 0) - Number(a.weightKg || 0))[0] || null;

    return {
      ...route,
      assignedCapacityKg: assignedCapacity,
      targetPercent,
      vehiclePercent,
      targetSignal: getCapacitySignal(targetPercent),
      vehicleSignal: getCapacitySignal(vehiclePercent),
      extraTruckRequired: Boolean(largestClient && Number(largestClient.weightKg || 0) > EXTRA_TRUCK_CLIENT_THRESHOLD_KG),
      largestClient,
    };
  });
};

export const buildFleetDashboardData = (orders, fleetLike = DEFAULT_FLEET) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const dayMap = new Map();

  safeOrders.forEach((order) => {
    if (!isCommittedStatus(order?.status)) return;

    const dayKey = toISODateKey(order?.delivery_date || order?.created_at);
    const routeNameRaw = String(order?.route_name || order?.delivery_city || 'SEM ROTA').trim();
    const routeKey = normalizeRouteName(routeNameRaw);

    const weight = calculateOrderWeightKg(order);
    const value = Number(order?.total_value || 0);
    const clientName = String(order?.client_name || order?.client_id || 'SEM CLIENTE').trim() || 'SEM CLIENTE';

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        dayKey,
        totalWeight: 0,
        totalValue: 0,
        totalOrders: 0,
        routesMap: new Map(),
      });
    }

    const dayNode = dayMap.get(dayKey);
    dayNode.totalWeight += weight;
    dayNode.totalValue += value;
    dayNode.totalOrders += 1;

    if (!dayNode.routesMap.has(routeKey)) {
      dayNode.routesMap.set(routeKey, {
        routeKey,
        routeName: routeNameRaw || routeKey,
        routeType: resolveRouteType(routeNameRaw),
        totalWeight: 0,
        totalValue: 0,
        totalOrders: 0,
        clientsMap: new Map(),
        citiesMap: new Map(),
      });
    }

    const routeNode = dayNode.routesMap.get(routeKey);
    routeNode.totalWeight += weight;
    routeNode.totalValue += value;
    routeNode.totalOrders += 1;

    const previousClient = routeNode.clientsMap.get(clientName) || { clientName, weightKg: 0, orders: 0 };
    previousClient.weightKg += weight;
    previousClient.orders += 1;
    routeNode.clientsMap.set(clientName, previousClient);

    const cityCandidates = [
      String(order?.delivery_city || '').trim(),
      ...extractCitiesFromRouteName(routeNameRaw),
    ];

    cityCandidates.forEach((city) => {
      const cityKey = normalizeCityToken(city);
      if (!cityKey) return;

      const current = routeNode.citiesMap.get(cityKey) || {
        cityName: String(city || '').trim().toUpperCase(),
        orders: 0,
      };
      current.orders += 1;
      routeNode.citiesMap.set(cityKey, current);
    });
  });

  const days = Array.from(dayMap.values())
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .map((day) => {
      const rawRoutes = Array.from(day.routesMap.values())
        .map((route) => ({
          routeKey: route.routeKey,
          routeName: route.routeName,
          routeType: route.routeType,
          totalWeight: route.totalWeight,
          totalValue: route.totalValue,
          totalOrders: route.totalOrders,
          clients: Array.from(route.clientsMap.values())
            .sort((a, b) => Number(b.weightKg || 0) - Number(a.weightKg || 0)),
          cities: Array.from(route.citiesMap.values())
            .sort((a, b) => Number(b.orders || 0) - Number(a.orders || 0))
            .map((city) => city.cityName)
            .filter(Boolean),
        }))
        .sort((a, b) => Number(b.totalWeight || 0) - Number(a.totalWeight || 0));

      const plannedRoutes = assignFleetForDayRoutes(rawRoutes, fleetLike);

      return {
        dayKey: day.dayKey,
        totalWeight: day.totalWeight,
        totalValue: day.totalValue,
        totalOrders: day.totalOrders,
        routes: plannedRoutes,
      };
    });

  const totals = days.reduce(
    (acc, day) => {
      acc.orders += day.totalOrders;
      acc.weight += day.totalWeight;
      acc.value += day.totalValue;
      acc.routes += day.routes.length;
      return acc;
    },
    { orders: 0, weight: 0, value: 0, routes: 0 }
  );

  return { days, totals };
};

export const ROUTE_TARGET_CAPACITY_KG = 5000;
export const EXTRA_TRUCK_CLIENT_THRESHOLD_KG = 2500;

export const FLEET_STORAGE_KEY = 'schlosser_fleet_v1';

export const DEFAULT_FLEET = Object.freeze([
  {
    id: 'vw-new-2025',
    nome: '3/4 Volks 2025 Novo',
    capacidadeKg: 5000,
    perfil: 'longa_distancia',
    observacao: 'Preferência rotas longas (Porto Alegre, Canoas, etc.)',
    ativo: true,
  },
  {
    id: 'iveco-reformado',
    nome: '3/4 Iveco Reformado',
    capacidadeKg: 5000,
    perfil: 'regional',
    observacao: 'Segunda opção para rotas longas/regional',
    ativo: true,
  },
  {
    id: 'vw-old',
    nome: '3/4 Volks Velho',
    capacidadeKg: 2000,
    perfil: 'local',
    observacao: 'Apoio em rota local e transferências curtas',
    ativo: true,
  },
  {
    id: 'ducato-van',
    nome: 'Van Ducato',
    capacidadeKg: 1700,
    perfil: 'baixa_carga',
    observacao: 'Preferência para rota com menor carga',
    ativo: true,
  },
  {
    id: 'volvo-truck-old',
    nome: 'Truck Volvo Velho',
    capacidadeKg: 12000,
    perfil: 'local_pesado',
    observacao: 'Uso local/transferência pesada (em avaliação de venda)',
    ativo: true,
  },
]);

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const normalizeFleetVehicle = (vehicle) => {
  if (!vehicle || typeof vehicle !== 'object') return null;

  const id = String(vehicle.id || '').trim();
  const nome = String(vehicle.nome || '').trim();

  if (!id || !nome) return null;

  return {
    id,
    nome,
    capacidadeKg: safeNumber(vehicle.capacidadeKg, 0),
    perfil: String(vehicle.perfil || '').trim() || 'geral',
    observacao: String(vehicle.observacao || '').trim(),
    ativo: vehicle.ativo !== false,
  };
};

export const normalizeFleet = (fleetLike) => {
  if (!Array.isArray(fleetLike) || fleetLike.length === 0) {
    return DEFAULT_FLEET.map((vehicle) => ({ ...vehicle }));
  }

  const normalized = fleetLike
    .map(normalizeFleetVehicle)
    .filter(Boolean)
    .filter((vehicle) => vehicle.capacidadeKg > 0);

  if (normalized.length === 0) {
    return DEFAULT_FLEET.map((vehicle) => ({ ...vehicle }));
  }

  return normalized;
};

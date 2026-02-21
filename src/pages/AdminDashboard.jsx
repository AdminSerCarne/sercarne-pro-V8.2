import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  MessageCircle,
  Phone,
  RefreshCw,
  Save,
  Trash2,
  Truck,
  Trophy,
  Undo2,
  UserPlus,
  Users,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import Navigation from '@/components/Navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import {
  DEFAULT_FLEET,
  DEFAULT_DELIVERY_TEAM,
  DELIVERY_TEAM_STORAGE_KEY,
  EXTRA_TRUCK_CLIENT_THRESHOLD_KG,
  FLEET_STORAGE_KEY,
  FLEET_ROUTE_PLAN_STORAGE_KEY,
  ROUTE_TARGET_CAPACITY_KG,
  normalizeFleet,
} from '@/domain/fleetConfig';
import { buildFleetDashboardData, getCapacitySignal } from '@/utils/fleetPlanner';
import { routeCapacityService } from '@/services/routeCapacityService';

const formatMoney = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatWeight = (value) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const formatDateLabel = (dayKey) => {
  if (!dayKey || dayKey === 'SEM-DATA') return 'Sem data';
  try {
    return format(parseISO(dayKey), "dd/MM/yyyy (EEE)", { locale: ptBR });
  } catch {
    return dayKey;
  }
};

const loadFleetFromStorage = () => {
  try {
    const raw = localStorage.getItem(FLEET_STORAGE_KEY);
    if (!raw) return normalizeFleet(DEFAULT_FLEET);

    const parsed = JSON.parse(raw);
    return normalizeFleet(parsed);
  } catch {
    return normalizeFleet(DEFAULT_FLEET);
  }
};

const normalizeRole = (role) => {
  const raw = String(role || '').trim().toUpperCase();
  if (raw === 'AUXILIAR') return 'AUXILIAR';
  return 'MOTORISTA';
};

const normalizeTeamMember = (member) => {
  if (!member || typeof member !== 'object') return null;
  const id = String(member.id || '').trim();
  const nome = String(member.nome || '').trim();
  if (!id || !nome) return null;

  return {
    id,
    nome,
    telefone: String(member.telefone || '').trim(),
    funcao: normalizeRole(member.funcao),
    ativo: member.ativo !== false,
  };
};

const normalizeTeam = (teamLike) => {
  if (!Array.isArray(teamLike) || teamLike.length === 0) {
    return [...DEFAULT_DELIVERY_TEAM];
  }
  return teamLike.map(normalizeTeamMember).filter(Boolean);
};

const loadTeamFromStorage = () => {
  try {
    const raw = localStorage.getItem(DELIVERY_TEAM_STORAGE_KEY);
    if (!raw) return normalizeTeam(DEFAULT_DELIVERY_TEAM);
    const parsed = JSON.parse(raw);
    return normalizeTeam(parsed);
  } catch {
    return normalizeTeam(DEFAULT_DELIVERY_TEAM);
  }
};

const loadRoutePlanFromStorage = () => {
  try {
    const raw = localStorage.getItem(FLEET_ROUTE_PLAN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};

const isValidPlanValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
};

const sanitizePlanEntry = (entry) => {
  const source = entry && typeof entry === 'object' ? entry : {};
  const next = {};
  Object.entries(source).forEach(([key, value]) => {
    if (!isValidPlanValue(value)) return;
    next[key] = value;
  });
  return next;
};

const routePlanKey = (dayKey, routeKey) => `${dayKey}::${routeKey}`;

const formatDateForMessage = (dayKey) => {
  if (!dayKey || dayKey === 'SEM-DATA') return 'Sem data';
  try {
    return format(parseISO(dayKey), 'dd/MM/yyyy');
  } catch {
    return dayKey;
  }
};

const tomorrowKey = () => format(addDays(new Date(), 1), 'yyyy-MM-dd');

const TEAM_ROLE_OPTIONS = Object.freeze([
  { value: 'MOTORISTA', label: 'Motorista' },
  { value: 'AUXILIAR', label: 'Auxiliar' },
]);

const CAPACITY_BAR_STRIPE = {
  backgroundImage:
    'repeating-linear-gradient(120deg, rgba(255,255,255,0.2), rgba(255,255,255,0.2) 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 12px)',
};

const AdminDashboard = () => {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fleet, setFleet] = useState(() => loadFleetFromStorage());
  const [routePlanMap, setRoutePlanMap] = useState(() => loadRoutePlanFromStorage());
  const [deliveryTeam, setDeliveryTeam] = useState(() => loadTeamFromStorage());
  const [selectedDayKey, setSelectedDayKey] = useState('all');
  const [savingFleet, setSavingFleet] = useState(false);
  const [savingRoutePlan, setSavingRoutePlan] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [newTeamMember, setNewTeamMember] = useState({
    nome: '',
    telefone: '',
    funcao: 'MOTORISTA',
  });

  const [overloadSuggestions, setOverloadSuggestions] = useState({});

  const fetchOrders = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, delivery_date, route_name, delivery_city, total_weight, total_value, items, status, client_name, client_id, created_at')
        .order('delivery_date', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[AdminDashboard] fetchOrders:', err);
      toast({
        title: 'Erro ao carregar pedidos',
        description: err?.message || 'Falha ao consultar dados no Supabase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const channel = supabase
      .channel('admin_dashboard_fleet_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const overview = useMemo(() => buildFleetDashboardData(orders, fleet), [orders, fleet]);

  const fleetMap = useMemo(() => {
    const map = new Map();
    fleet.forEach((vehicle) => {
      map.set(vehicle.id, vehicle);
    });
    return map;
  }, [fleet]);

  const teamMap = useMemo(() => {
    const map = new Map();
    deliveryTeam.forEach((member) => {
      map.set(member.id, member);
    });
    return map;
  }, [deliveryTeam]);

  const activeDrivers = useMemo(
    () => deliveryTeam.filter((member) => member.ativo && member.funcao === 'MOTORISTA'),
    [deliveryTeam]
  );
  const activeHelpers = useMemo(
    () => deliveryTeam.filter((member) => member.ativo && member.funcao === 'AUXILIAR'),
    [deliveryTeam]
  );
  const allDrivers = useMemo(
    () => deliveryTeam.filter((member) => member.funcao === 'MOTORISTA'),
    [deliveryTeam]
  );
  const allHelpers = useMemo(
    () => deliveryTeam.filter((member) => member.funcao === 'AUXILIAR'),
    [deliveryTeam]
  );

  const planningDays = useMemo(() => {
    return overview.days.map((day) => {
      const nextRoutes = day.routes.map((route) => {
        const planKey = routePlanKey(day.dayKey, route.routeKey);
        const planEntry = sanitizePlanEntry(routePlanMap[planKey]);

        const manualVehicle = planEntry.vehicleId ? fleetMap.get(planEntry.vehicleId) || null : null;
        const effectiveVehicle = manualVehicle || route.assignedVehicle || null;

        const assignedCapacityKg = Number(effectiveVehicle?.capacidadeKg || 0);
        const vehiclePercent =
          assignedCapacityKg > 0 ? (Number(route.totalWeight || 0) / assignedCapacityKg) * 100 : 0;

        const assignedDriver = planEntry.driverId ? teamMap.get(planEntry.driverId) || null : null;
        const assignedHelpers = [planEntry.helper1Id, planEntry.helper2Id]
          .filter(Boolean)
          .map((memberId) => teamMap.get(memberId))
          .filter(Boolean);

        return {
          ...route,
          planKey,
          suggestedVehicle: route.assignedVehicle || null,
          assignedVehicle: effectiveVehicle,
          assignedCapacityKg,
          vehiclePercent,
          vehicleSignal: getCapacitySignal(vehiclePercent),
          isVehicleManual: Boolean(manualVehicle),
          planEntry,
          assignedDriver,
          assignedHelpers,
        };
      });

      return {
        ...day,
        routes: nextRoutes,
      };
    });
  }, [overview.days, routePlanMap, fleetMap, teamMap]);

  const dayOptions = useMemo(() => {
    return planningDays.map((day) => ({
      key: day.dayKey,
      label: `${formatDateLabel(day.dayKey)} - ${formatWeight(day.totalWeight)} kg`,
    }));
  }, [planningDays]);

  const visibleDays = useMemo(() => {
    if (selectedDayKey === 'all') return planningDays;
    return planningDays.filter((day) => day.dayKey === selectedDayKey);
  }, [planningDays, selectedDayKey]);

  useEffect(() => {
    if (selectedDayKey !== 'all' && !planningDays.some((day) => day.dayKey === selectedDayKey)) {
      setSelectedDayKey('all');
    }
  }, [planningDays, selectedDayKey]);

  useEffect(() => {
    let mounted = true;

    const loadSuggestions = async () => {
      const overloadRoutes = visibleDays
        .flatMap((day) =>
          day.routes
            .filter((route) => route.targetPercent > 100)
            .map((route) => ({ dayKey: day.dayKey, routeName: route.routeName, routeKey: route.routeKey }))
        );

      if (overloadRoutes.length === 0) {
        if (mounted) setOverloadSuggestions({});
        return;
      }

      const entries = await Promise.all(
        overloadRoutes.map(async (item) => {
          const suggestion = await routeCapacityService
            .suggestNextValidDeliveryDate(item.routeName, item.dayKey)
            .catch(() => null);

          return [`${item.dayKey}::${item.routeKey}`, suggestion];
        })
      );

      if (mounted) {
        setOverloadSuggestions(Object.fromEntries(entries));
      }
    };

    loadSuggestions();

    return () => {
      mounted = false;
    };
  }, [visibleDays]);

  const activeFleet = useMemo(() => fleet.filter((vehicle) => vehicle.ativo), [fleet]);

  const handleVehicleCapacityChange = (vehicleId, newCapacity) => {
    const parsed = Number(newCapacity);
    setFleet((current) =>
      current.map((vehicle) => {
        if (vehicle.id !== vehicleId) return vehicle;

        return {
          ...vehicle,
          capacidadeKg: Number.isFinite(parsed) && parsed > 0 ? parsed : vehicle.capacidadeKg,
        };
      })
    );
  };

  const handleVehicleActiveToggle = (vehicleId, enabled) => {
    setFleet((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId ? { ...vehicle, ativo: Boolean(enabled) } : vehicle
      )
    );
  };

  const saveFleetConfig = () => {
    setSavingFleet(true);
    try {
      const normalized = normalizeFleet(fleet);
      localStorage.setItem(FLEET_STORAGE_KEY, JSON.stringify(normalized));
      setFleet(normalized);
      toast({
        title: 'Frota salva',
        description: 'Configuração da frota atualizada no navegador.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar frota',
        description: err?.message || 'Não foi possível persistir as alterações.',
        variant: 'destructive',
      });
    } finally {
      setSavingFleet(false);
    }
  };

  const restoreDefaultFleet = () => {
    const restored = normalizeFleet(DEFAULT_FLEET);
    setFleet(restored);
    localStorage.setItem(FLEET_STORAGE_KEY, JSON.stringify(restored));

    toast({
      title: 'Frota restaurada',
      description: 'Voltou para os 5 veículos padrão cadastrados.',
    });
  };

  const updateRoutePlanEntry = (planKey, patch) => {
    setRoutePlanMap((current) => {
      const currentEntry = sanitizePlanEntry(current?.[planKey]);
      const nextEntry = sanitizePlanEntry({ ...currentEntry, ...patch });

      if (Object.keys(nextEntry).length === 0) {
        const cloned = { ...current };
        delete cloned[planKey];
        return cloned;
      }

      return {
        ...current,
        [planKey]: nextEntry,
      };
    });
  };

  const saveRoutePlanning = () => {
    setSavingRoutePlan(true);
    try {
      const sanitized = Object.fromEntries(
        Object.entries(routePlanMap || {})
          .map(([key, value]) => [key, sanitizePlanEntry(value)])
          .filter(([, value]) => Object.keys(value).length > 0)
      );
      localStorage.setItem(FLEET_ROUTE_PLAN_STORAGE_KEY, JSON.stringify(sanitized));
      setRoutePlanMap(sanitized);
      toast({
        title: 'Planejamento salvo',
        description: 'Trocas de veículo e escala de rota foram salvas.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar planejamento',
        description: err?.message || 'Não foi possível salvar o planejamento.',
        variant: 'destructive',
      });
    } finally {
      setSavingRoutePlan(false);
    }
  };

  const clearRoutePlanning = () => {
    setRoutePlanMap({});
    localStorage.removeItem(FLEET_ROUTE_PLAN_STORAGE_KEY);
    toast({
      title: 'Planejamento limpo',
      description: 'Voltou para sugestões automáticas de veículo/equipe.',
    });
  };

  const handleRouteVehicleSelection = (planKey, value) => {
    if (value === '__AUTO__') {
      updateRoutePlanEntry(planKey, { vehicleId: '' });
      return;
    }
    updateRoutePlanEntry(planKey, { vehicleId: value });
  };

  const handleRouteDriverSelection = (planKey, value) => {
    if (value === '__NONE__') {
      updateRoutePlanEntry(planKey, { driverId: '' });
      return;
    }
    updateRoutePlanEntry(planKey, { driverId: value });
  };

  const handleRouteHelperSelection = (planKey, slot, value) => {
    const field = slot === 2 ? 'helper2Id' : 'helper1Id';
    if (value === '__NONE__') {
      updateRoutePlanEntry(planKey, { [field]: '' });
      return;
    }

    setRoutePlanMap((current) => {
      const currentEntry = sanitizePlanEntry(current?.[planKey]);
      const nextEntry = {
        ...currentEntry,
        [field]: value,
      };

      if (slot === 1 && nextEntry.helper2Id === value) nextEntry.helper2Id = '';
      if (slot === 2 && nextEntry.helper1Id === value) nextEntry.helper1Id = '';

      const sanitized = sanitizePlanEntry(nextEntry);
      if (Object.keys(sanitized).length === 0) {
        const cloned = { ...current };
        delete cloned[planKey];
        return cloned;
      }

      return {
        ...current,
        [planKey]: sanitized,
      };
    });
  };

  const saveDeliveryTeam = () => {
    setSavingTeam(true);
    try {
      const normalized = normalizeTeam(deliveryTeam);
      localStorage.setItem(DELIVERY_TEAM_STORAGE_KEY, JSON.stringify(normalized));
      setDeliveryTeam(normalized);
      toast({
        title: 'Equipe salva',
        description: 'Cadastro de motoristas/auxiliares atualizado.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar equipe',
        description: err?.message || 'Não foi possível salvar a equipe.',
        variant: 'destructive',
      });
    } finally {
      setSavingTeam(false);
    }
  };

  const addTeamMember = () => {
    const nome = String(newTeamMember.nome || '').trim();
    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome para cadastrar na equipe.',
        variant: 'destructive',
      });
      return;
    }

    const member = normalizeTeamMember({
      id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nome,
      telefone: String(newTeamMember.telefone || '').trim(),
      funcao: normalizeRole(newTeamMember.funcao),
      ativo: true,
    });

    if (!member) return;

    setDeliveryTeam((current) => [...current, member]);
    setNewTeamMember({ nome: '', telefone: '', funcao: 'MOTORISTA' });
  };

  const updateTeamMemberField = (memberId, field, value) => {
    setDeliveryTeam((current) =>
      current.map((member) =>
        member.id === memberId ? { ...member, [field]: value } : member
      )
    );
  };

  const removeTeamMember = (memberId) => {
    setDeliveryTeam((current) => current.filter((member) => member.id !== memberId));

    setRoutePlanMap((current) => {
      const next = {};
      Object.entries(current || {}).forEach(([key, value]) => {
        const entry = sanitizePlanEntry(value);
        if (entry.driverId === memberId) entry.driverId = '';
        if (entry.helper1Id === memberId) entry.helper1Id = '';
        if (entry.helper2Id === memberId) entry.helper2Id = '';
        const cleaned = sanitizePlanEntry(entry);
        if (Object.keys(cleaned).length > 0) next[key] = cleaned;
      });
      return next;
    });
  };

  const buildRouteBrief = (day, route) => {
    const dateLabel = formatDateForMessage(day.dayKey);
    const isTomorrowRoute = day.dayKey === tomorrowKey();
    const header = isTomorrowRoute ? 'ESCALA DE ENTREGA (AMANHA)' : 'ESCALA DE ENTREGA';
    const vehicleName = route.assignedVehicle?.nome || 'Sem veículo definido';
    const vehicleCapacity = Number(route.assignedCapacityKg || 0);
    const cities = Array.isArray(route.cities) && route.cities.length > 0
      ? route.cities.join(', ')
      : route.routeName;
    const driverLine = route.assignedDriver
      ? `${route.assignedDriver.nome}${route.assignedDriver.telefone ? ` (${route.assignedDriver.telefone})` : ''}`
      : 'Não definido';
    const helpersLine = route.assignedHelpers.length > 0
      ? route.assignedHelpers.map((member) => member.nome).join(', ')
      : 'Não definido';

    return [
      `◆ ${header}`,
      `• Data: ${dateLabel}`,
      `• Rota: ${route.routeName}`,
      `• Veículo: ${vehicleName}`,
      `• Capacidade veículo: ${formatWeight(vehicleCapacity)} kg`,
      `• Carga prevista: ${formatWeight(route.totalWeight)} kg (${Number(route.vehiclePercent || 0).toFixed(1)}%)`,
      `• Pedidos na rota: ${route.totalOrders}`,
      `• Cidades previstas: ${cities}`,
      `• Motorista: ${driverLine}`,
      `• Auxiliares: ${helpersLine}`,
      `• Observação: ${route.isVehicleManual ? 'Veículo definido manualmente pelo admin.' : route.assignmentReason}`,
      `• Plataforma: https://sercarne.com`,
    ].join('\n');
  };

  const copyRouteBrief = async (day, route) => {
    const message = buildRouteBrief(day, route);
    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: 'Escala copiada',
        description: `Rota ${route.routeName} copiada para envio.`,
      });
    } catch {
      window.prompt('Copie a escala abaixo:', message);
    }
  };

  const sendRouteBriefToDriverWhatsapp = (day, route) => {
    const phone = onlyDigits(route.assignedDriver?.telefone || '');
    if (!phone) {
      toast({
        title: 'Motorista sem telefone',
        description: 'Cadastre telefone do motorista para abrir WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    const text = encodeURIComponent(buildRouteBrief(day, route));
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <Helmet>
        <title>Dashboard Admin - Schlosser</title>
      </Helmet>

      <Navigation />

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="h-8 w-8 text-[#FF6B35]" />
              Painel Admin: Frota e Carga por Rota
            </h1>
            <p className="text-gray-400 mt-1">
              Usuário: {user?.usuario || user?.login || 'Admin'} • Meta operacional por rota: {ROUTE_TARGET_CAPACITY_KG}kg
            </p>
          </div>

          <Button
            onClick={fetchOrders}
            disabled={refreshing}
            className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar dados
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-gray-400 uppercase">Pedidos Comprometidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.totals.orders}</p>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-gray-400 uppercase">Carga Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatWeight(overview.totals.weight)} kg</p>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-gray-400 uppercase">Valor Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(overview.totals.value)}</p>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-gray-400 uppercase">Rotas no Planejamento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.totals.routes}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#121212] border-white/10 text-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#FF6B35]" /> Cadastro da Frota
            </CardTitle>
            <p className="text-sm text-gray-400">
              Configure capacidade e disponibilidade dos veículos. A sugestão automática usa essas capacidades.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {fleet.map((vehicle) => (
                <div key={vehicle.id} className="rounded-lg border border-white/10 bg-[#0f0f0f] p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white leading-tight">{vehicle.nome}</p>
                      <p className="text-xs text-gray-400 mt-1">{vehicle.observacao}</p>
                    </div>

                    <Badge
                      variant="outline"
                      className={vehicle.ativo ? 'border-green-600 text-green-300' : 'border-gray-700 text-gray-500'}
                    >
                      {vehicle.ativo ? 'ATIVO' : 'INATIVO'}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] uppercase text-gray-500 font-semibold">Capacidade (kg)</label>
                    <Input
                      type="number"
                      min="1"
                      value={vehicle.capacidadeKg}
                      onChange={(event) => handleVehicleCapacityChange(vehicle.id, event.target.value)}
                      className="bg-[#0a0a0a] border-white/10 text-white"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={vehicle.ativo !== false}
                      onChange={(event) => handleVehicleActiveToggle(vehicle.id, event.target.checked)}
                      className="h-4 w-4 accent-[#FF6B35]"
                    />
                    Disponível para sugestão automática
                  </label>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveFleetConfig} disabled={savingFleet} className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white">
                <Save className="h-4 w-4 mr-2" /> Salvar frota
              </Button>
              <Button onClick={restoreDefaultFleet} variant="outline" className="border-white/20 text-gray-200 hover:bg-white/10">
                <Undo2 className="h-4 w-4 mr-2" /> Restaurar padrão
              </Button>
              <Badge variant="outline" className="border-white/10 text-gray-300">
                Veículos ativos: {activeFleet.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#121212] border-white/10 text-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-[#FF6B35]" /> Equipe de Entrega
            </CardTitle>
            <p className="text-sm text-gray-400">
              Cadastre motoristas e auxiliares para escala por rota e envio de briefing diário.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input
                value={newTeamMember.nome}
                onChange={(event) => setNewTeamMember((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Nome completo"
                className="bg-[#0a0a0a] border-white/10 text-white md:col-span-2"
              />
              <Input
                value={newTeamMember.telefone}
                onChange={(event) => setNewTeamMember((current) => ({ ...current, telefone: event.target.value }))}
                placeholder="Telefone / WhatsApp"
                className="bg-[#0a0a0a] border-white/10 text-white"
              />
              <Select
                value={newTeamMember.funcao}
                onValueChange={(value) => setNewTeamMember((current) => ({ ...current, funcao: value }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10 text-white">
                  {TEAM_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={addTeamMember} className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white">
                <UserPlus className="h-4 w-4 mr-2" /> Adicionar na equipe
              </Button>
              <Button onClick={saveDeliveryTeam} disabled={savingTeam} variant="outline" className="border-white/20 text-gray-200 hover:bg-white/10">
                <Save className="h-4 w-4 mr-2" /> Salvar equipe
              </Button>
              <Badge variant="outline" className="border-white/10 text-gray-300">
                Ativos: {deliveryTeam.filter((member) => member.ativo).length}
              </Badge>
            </div>

            {deliveryTeam.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-gray-500">
                Nenhum motorista/auxiliar cadastrado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {deliveryTeam.map((member) => (
                  <div key={member.id} className="rounded-lg border border-white/10 bg-[#0f0f0f] p-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                      <Input
                        value={member.nome}
                        onChange={(event) => updateTeamMemberField(member.id, 'nome', event.target.value)}
                        className="bg-[#0a0a0a] border-white/10 text-white md:col-span-4"
                      />
                      <Input
                        value={member.telefone}
                        onChange={(event) => updateTeamMemberField(member.id, 'telefone', event.target.value)}
                        className="bg-[#0a0a0a] border-white/10 text-white md:col-span-3"
                        placeholder="Telefone"
                      />
                      <Select
                        value={member.funcao}
                        onValueChange={(value) => updateTeamMemberField(member.id, 'funcao', normalizeRole(value))}
                      >
                        <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white md:col-span-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111] border-white/10 text-white">
                          {TEAM_ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <label className="md:col-span-2 text-sm text-gray-300 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={member.ativo !== false}
                          onChange={(event) => updateTeamMemberField(member.id, 'ativo', Boolean(event.target.checked))}
                          className="h-4 w-4 accent-[#FF6B35]"
                        />
                        Ativo
                      </label>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeamMember(member.id)}
                        className="md:col-span-1 text-gray-400 hover:text-red-400 hover:bg-white/10 justify-self-end"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#121212] border-white/10 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Planejamento de Carga (Dia &gt; Rota &gt; Veículo)</CardTitle>
            <p className="text-sm text-gray-400">
              Regra de sinal: até 35% vermelho, 35%-65% amarelo, acima de 70% verde, acima de 90% destaque.
              Acima de 100% bloqueia novos pedidos para a data/rota.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <Select value={selectedDayKey} onValueChange={setSelectedDayKey}>
                  <SelectTrigger className="w-full md:w-[360px] bg-[#0a0a0a] border-white/10 text-white">
                    <SelectValue placeholder="Selecione a data" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-white/10 text-white">
                    <SelectItem value="all">Todas as datas</SelectItem>
                    {dayOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={saveRoutePlanning} disabled={savingRoutePlan} className="bg-[#FF6B35] hover:bg-[#e55a2b] text-white">
                  <Save className="h-4 w-4 mr-2" /> Salvar escala rota
                </Button>
                <Button onClick={clearRoutePlanning} variant="outline" className="border-white/20 text-gray-200 hover:bg-white/10">
                  <Undo2 className="h-4 w-4 mr-2" /> Limpar trocas manuais
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/10 text-gray-300">
                  Meta por rota: {ROUTE_TARGET_CAPACITY_KG}kg
                </Badge>
                <Badge variant="outline" className="border-white/10 text-gray-300">
                  Motoristas ativos: {activeDrivers.length}
                </Badge>
                <Badge variant="outline" className="border-white/10 text-gray-300">
                  Auxiliares ativos: {activeHelpers.length}
                </Badge>
              </div>
            </div>

            {loading ? (
              <div className="rounded-lg border border-white/10 bg-[#0f0f0f] p-6 text-center text-gray-400">
                Carregando painel de capacidade...
              </div>
            ) : visibleDays.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-gray-500">
                Nenhum pedido comprometido para os filtros atuais.
              </div>
            ) : (
              <div className="space-y-5">
                {visibleDays.map((day) => (
                  <div key={day.dayKey} className="rounded-lg border border-white/10 bg-[#0f0f0f] p-4 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 pb-3 border-b border-white/10">
                      <div>
                        <p className="text-lg font-bold text-white">{formatDateLabel(day.dayKey)}</p>
                        <p className="text-xs text-gray-400">{day.totalOrders} pedidos • {day.routes.length} rotas</p>
                      </div>

                      <div className="flex gap-3 text-sm">
                        <span className="text-gray-300">Carga: <strong className="text-white">{formatWeight(day.totalWeight)} kg</strong></span>
                        <span className="text-gray-300">Valor: <strong className="text-white">{formatMoney(day.totalValue)}</strong></span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {day.routes.map((route) => {
                        const targetSignal = route.targetSignal || getCapacitySignal(route.targetPercent);
                        const vehicleSignal = route.vehicleSignal || getCapacitySignal(route.vehiclePercent);
                        const suggestionKey = `${day.dayKey}::${route.routeKey}`;
                        const suggestion = overloadSuggestions[suggestionKey];

                        return (
                          <div key={route.routeKey} className="rounded-lg border border-white/10 bg-[#0b0b0b] p-4 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-white leading-tight">{route.routeName}</p>
                                <p className="text-xs text-gray-500 uppercase mt-1">
                                  Tipo {route.routeType} • {route.totalOrders} pedidos
                                </p>
                              </div>

                              <Badge variant="outline" className="border-white/20 text-gray-200">
                                {formatWeight(route.totalWeight)} kg
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-gray-300">
                                <span>{targetSignal.label}</span>
                                <span className={targetSignal.textClass}>{Number(route.targetPercent || 0).toFixed(1)}%</span>
                              </div>
                              <div className="h-3 bg-white/10 rounded overflow-hidden">
                                <div
                                  className={`${targetSignal.barClass} h-full transition-all duration-700 animate-pulse`}
                                  style={{ ...CAPACITY_BAR_STRIPE, width: `${Math.min(Math.max(route.targetPercent || 0, 0), 100)}%` }}
                                />
                              </div>
                            </div>

                            <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-gray-300 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p>
                                  Veículo em uso:{' '}
                                  <strong className="text-white">
                                    {route.assignedVehicle?.nome || 'Sem veículo disponível'}
                                  </strong>
                                </p>
                                <Badge variant="outline" className={route.isVehicleManual ? 'border-amber-500/50 text-amber-300' : 'border-white/20 text-gray-300'}>
                                  {route.isVehicleManual ? 'MANUAL' : 'SUGERIDO'}
                                </Badge>
                              </div>

                              <p>
                                Capacidade do veículo: <strong className="text-white">{formatWeight(route.assignedCapacityKg)} kg</strong>
                                {' '}• Ocupação veículo: <span className={vehicleSignal.textClass}>{Number(route.vehiclePercent || 0).toFixed(1)}%</span>
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                <div className="space-y-1">
                                  <label className="text-[11px] uppercase text-gray-500 font-semibold">Trocar veículo da rota</label>
                                  <Select
                                    value={route.planEntry?.vehicleId || '__AUTO__'}
                                    onValueChange={(value) => handleRouteVehicleSelection(route.planKey, value)}
                                  >
                                    <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/10 text-white">
                                      <SelectItem value="__AUTO__">
                                        Sugestão automática ({route.suggestedVehicle?.nome || 'sem sugestão'})
                                      </SelectItem>
                                      {fleet.map((vehicle) => (
                                        <SelectItem key={vehicle.id} value={vehicle.id}>
                                          {vehicle.nome} ({formatWeight(vehicle.capacidadeKg)}kg){vehicle.ativo ? '' : ' [INATIVO]'}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] uppercase text-gray-500 font-semibold">Motorista</label>
                                  <Select
                                    value={route.planEntry?.driverId || '__NONE__'}
                                    onValueChange={(value) => handleRouteDriverSelection(route.planKey, value)}
                                  >
                                    <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/10 text-white">
                                      <SelectItem value="__NONE__">Sem motorista definido</SelectItem>
                                      {allDrivers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                          {member.nome}{member.ativo ? '' : ' [INATIVO]'}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] uppercase text-gray-500 font-semibold">Auxiliar 1</label>
                                  <Select
                                    value={route.planEntry?.helper1Id || '__NONE__'}
                                    onValueChange={(value) => handleRouteHelperSelection(route.planKey, 1, value)}
                                  >
                                    <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/10 text-white">
                                      <SelectItem value="__NONE__">Sem auxiliar</SelectItem>
                                      {allHelpers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                          {member.nome}{member.ativo ? '' : ' [INATIVO]'}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] uppercase text-gray-500 font-semibold">Auxiliar 2</label>
                                  <Select
                                    value={route.planEntry?.helper2Id || '__NONE__'}
                                    onValueChange={(value) => handleRouteHelperSelection(route.planKey, 2, value)}
                                  >
                                    <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/10 text-white">
                                      <SelectItem value="__NONE__">Sem auxiliar</SelectItem>
                                      {allHelpers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                          {member.nome}{member.ativo ? '' : ' [INATIVO]'}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <p className="text-gray-400">{route.isVehicleManual ? 'Ajuste manual aplicado pelo admin.' : route.assignmentReason}</p>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyRouteBrief(day, route)}
                                  className="h-7 text-[11px] border-white/20 text-gray-200 hover:bg-white/10"
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar escala
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendRouteBriefToDriverWhatsapp(day, route)}
                                  disabled={!route.assignedDriver?.telefone}
                                  className="h-7 text-[11px] border-green-500/30 text-green-300 hover:bg-green-500/10 disabled:opacity-40"
                                >
                                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp motorista
                                </Button>
                                {route.assignedDriver?.telefone && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                                    <Phone className="h-3.5 w-3.5" /> {route.assignedDriver.telefone}
                                  </span>
                                )}
                              </div>
                            </div>

                            {Number(route.targetPercent || 0) >= 90 && Number(route.targetPercent || 0) <= 100 && (
                              <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2 text-xs text-emerald-300 flex items-center gap-2">
                                <Trophy className="h-4 w-4" />
                                Parabéns: rota acima de 90% da meta de carga.
                              </div>
                            )}

                            {route.extraTruckRequired && (
                              <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-300">
                                Cliente "{route.largestClient?.clientName}" concentra {formatWeight(route.largestClient?.weightKg)}kg
                                {' '}(&gt; {EXTRA_TRUCK_CLIENT_THRESHOLD_KG}kg). Sugerir caminhão/rota extra dedicado.
                              </div>
                            )}

                            {Number(route.targetPercent || 0) > 100 && (
                              <div className="rounded border border-red-600/40 bg-red-950/30 p-2 text-xs text-red-300 space-y-1">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Capacidade excedida: novos pedidos devem ser bloqueados para esta data/rota.</span>
                                </div>
                                <p>
                                  Carga atual: {formatWeight(route.totalWeight)}kg ({Number(route.targetPercent || 0).toFixed(1)}% da meta).
                                </p>
                                {suggestion?.dateLabel ? (
                                  <p>
                                    Sugestão automática: reagendar para <strong>{suggestion.dateLabel}</strong> (mesma rota).
                                  </p>
                                ) : (
                                  <p>
                                    Sugestão automática: calcular próxima data válida da rota (verificada no checkout).
                                  </p>
                                )}
                              </div>
                            )}

                            {route.vanSuggestionRejected && (
                              <p className="text-[11px] text-gray-500">
                                A rota com menor carga ultrapassou a capacidade da Van Ducato.
                              </p>
                            )}

                            <div className="text-[11px] text-gray-500 space-y-1">
                              <p>
                                Top cliente: {route.largestClient?.clientName || '—'} ({formatWeight(route.largestClient?.weightKg || 0)}kg)
                              </p>
                              <p>
                                Cidades previstas: {Array.isArray(route.cities) && route.cities.length > 0 ? route.cities.join(', ') : '—'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-gray-400">
              <p className="font-semibold text-gray-300 mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Bloqueio operacional ativado no checkout
              </p>
              <p>
                Se a rota ultrapassar 100% da meta ({ROUTE_TARGET_CAPACITY_KG}kg) na data escolhida, o pedido é barrado e o sistema sugere o próximo dia válido da rota.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;

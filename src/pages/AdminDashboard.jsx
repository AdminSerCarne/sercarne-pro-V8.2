import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  Truck,
  Trophy,
  Undo2,
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
  EXTRA_TRUCK_CLIENT_THRESHOLD_KG,
  FLEET_STORAGE_KEY,
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
  const [selectedDayKey, setSelectedDayKey] = useState('all');
  const [savingFleet, setSavingFleet] = useState(false);

  const [overloadSuggestions, setOverloadSuggestions] = useState({});

  const fetchOrders = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, delivery_date, route_name, total_weight, total_value, items, status, client_name, client_id, created_at')
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

  const dayOptions = useMemo(() => {
    return overview.days.map((day) => ({
      key: day.dayKey,
      label: `${formatDateLabel(day.dayKey)} - ${formatWeight(day.totalWeight)} kg`,
    }));
  }, [overview.days]);

  const visibleDays = useMemo(() => {
    if (selectedDayKey === 'all') return overview.days;
    return overview.days.filter((day) => day.dayKey === selectedDayKey);
  }, [overview.days, selectedDayKey]);

  useEffect(() => {
    if (selectedDayKey !== 'all' && !overview.days.some((day) => day.dayKey === selectedDayKey)) {
      setSelectedDayKey('all');
    }
  }, [overview.days, selectedDayKey]);

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
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Planejamento de Carga (Dia &gt; Rota &gt; Veículo)</CardTitle>
            <p className="text-sm text-gray-400">
              Regra de sinal: até 35% vermelho, 35%-65% amarelo, acima de 70% verde, acima de 90% destaque.
              Acima de 100% bloqueia novos pedidos para a data/rota.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
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

              <Badge variant="outline" className="border-white/10 text-gray-300">
                Meta por rota: {ROUTE_TARGET_CAPACITY_KG}kg
              </Badge>
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

                            <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-gray-300 space-y-1">
                              <p>
                                Veículo sugerido: <strong className="text-white">{route.assignedVehicle?.nome || 'Sem veículo disponível'}</strong>
                              </p>
                              <p>
                                Capacidade do veículo: <strong className="text-white">{formatWeight(route.assignedCapacityKg)} kg</strong>
                                {' '}• Ocupação veículo: <span className={vehicleSignal.textClass}>{Number(route.vehiclePercent || 0).toFixed(1)}%</span>
                              </p>
                              <p className="text-gray-400">{route.assignmentReason}</p>
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

                            <div className="text-[11px] text-gray-500">
                              Top cliente: {route.largestClient?.clientName || '—'} ({formatWeight(route.largestClient?.weightKg || 0)}kg)
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

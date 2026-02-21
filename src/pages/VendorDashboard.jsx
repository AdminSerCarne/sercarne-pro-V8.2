import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { ORDER_STATUS, normalizeOrderStatus } from '@/domain/orderStatus';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { calculateCommissionSummary } from '@/domain/commissionPolicy';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  CheckCircle,
  Truck,
  Clock,
  RefreshCw,
  Search,
  Printer,
  Eye,
  Check,
  X,
  Calendar,
  Filter,
  AlertCircle,
  RotateCcw,
  Route as RouteIcon,
  Undo2,
} from 'lucide-react';

import { format, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

import PrintOrderModal from '@/components/PrintOrderModal';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import WhatsAppShare from '@/components/WhatsAppShare';

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const resolveUserRole = (user) => {
  const roleRaw = user?.tipo_de_Usuario ?? user?.tipo_usuario ?? user?.role ?? '';
  const role = String(roleRaw).toLowerCase();
  if (role.includes('admin') || role.includes('gestor')) return 'admin';
  if (role.includes('vendedor') || role.includes('representante')) return 'vendor';
  return 'public';
};

const normalizeStatus = (status) => normalizeOrderStatus(status);

const statusLabel = (status) => {
  const s = normalizeStatus(status);
  if (s === ORDER_STATUS.ENVIADO) return 'Pedido Enviado';
  if (s === ORDER_STATUS.CONFIRMADO) return 'Pedido Confirmado';
  if (s === ORDER_STATUS.SAIU_PARA_ENTREGA) return 'Saiu para Entrega';
  if (s === ORDER_STATUS.ENTREGUE) return 'Pedido Entregue';
  if (s === ORDER_STATUS.CANCELADO) return 'Cancelado';
  return s || '-';
};

const parseOrderItems = (items) => {
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

const toDateKey = (rawDate) => {
  const value = String(rawDate || '').trim();
  if (!value) return 'SEM-DATA';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'SEM-DATA';
  return parsed.toISOString().slice(0, 10);
};

const formatDateKey = (dayKey) => {
  if (!dayKey || dayKey === 'SEM-DATA') return 'Sem data';
  try {
    return format(parseISO(dayKey), 'dd/MM/yyyy');
  } catch {
    return dayKey;
  }
};

const formatListWithOverflow = (items, limit = 3) => {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safe.length === 0) return '-';
  const visible = safe.slice(0, limit);
  const remaining = safe.length - visible.length;
  return remaining > 0 ? `${visible.join(', ')} +${remaining}` : visible.join(', ');
};

const normalizeDateInputToISO = (rawValue) => {
  const dateKey = toDateKey(rawValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  return dateKey;
};

const normalizeCutoffInput = (rawValue, fallback = '17:00') => {
  const str = String(rawValue || '').replace('h', '').trim();
  const match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return fallback;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const VendorDashboard = () => {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const userRole = useMemo(() => resolveUserRole(user), [user]);
  const userLevel = useMemo(() => {
    const n = Number(user?.Nivel ?? user?.nivel);
    if (Number.isFinite(n) && n > 0) return n;
    return userRole === 'admin' ? 10 : 6;
  }, [user, userRole]);
  const vendorId = useMemo(() => onlyDigits(user?.login || ''), [user]);
  const [authUid, setAuthUid] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState('todos');
  const [dateFilter, setDateFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadAuthUid = async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setAuthUid(data?.user?.id || null);
    };

    loadAuthUid();

    return () => {
      mounted = false;
    };
  }, [user]);

  // -----------------------------------------
  // Fetch
  // -----------------------------------------
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (userRole !== 'admin') {
        if (vendorId) {
          query = query.eq('vendor_id', vendorId);
        } else if (authUid) {
          query = query.eq('vendor_uid', authUid);
        } else {
          setOrders([]);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[VendorDashboard] fetchOrders error:', err);
      toast({ title: 'Erro ao carregar pedidos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [authUid, user, userRole, vendorId, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // -----------------------------------------
  // Real-time sync (mais robusto)
  // -----------------------------------------
  useEffect(() => {
    if (!user) return;
    if (userRole !== 'admin' && !vendorId && !authUid) return;

    const scopeKey = userRole === 'admin' ? 'all' : (vendorId || authUid || 'self');
    const postgresFilter = userRole === 'admin'
      ? {}
      : vendorId
      ? { filter: `vendor_id=eq.${vendorId}` }
      : authUid
      ? { filter: `vendor_uid=eq.${authUid}` }
      : {};

    const belongsToCurrentVendor = (record) => {
      if (userRole === 'admin') return true;
      if (!record) return false;

      if (vendorId) {
        return onlyDigits(record.vendor_id) === vendorId;
      }
      if (authUid) {
        return String(record.vendor_uid || '') === String(authUid);
      }
      return false;
    };

    const channel = supabase
      .channel(`vendor_dashboard_updates_v2_${scopeKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', ...postgresFilter },
        (payload) => {
          const row = payload?.new;
          const old = payload?.old;

          // DELETE
          if (payload.eventType === 'DELETE' && old?.id) {
            if (!belongsToCurrentVendor(old)) return;
            setOrders((curr) => curr.filter((o) => o.id !== old.id));
            return;
          }

          // INSERT / UPDATE
          if (!row?.id) return;
          if (!belongsToCurrentVendor(row)) return;

          setOrders((curr) => {
            const idx = curr.findIndex((o) => o.id === row.id);

            // Se não existe ainda: adiciona no topo
            if (idx === -1) return [row, ...curr];

            // Evita sobrescrever com evento atrasado:
            const existing = curr[idx];
            const existingTs = existing?.updated_at || existing?.created_at || '';
            const incomingTs = row?.updated_at || row?.created_at || '';

            // Se tiver timestamps e o incoming parecer mais velho, ignora
            if (existingTs && incomingTs && String(incomingTs) < String(existingTs)) {
              return curr;
            }

            const copy = [...curr];
            copy[idx] = row;
            return copy;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUid, user, userRole, vendorId]);

  // -----------------------------------------
  // Filters
  // -----------------------------------------
  const filteredOrders = useMemo(() => {
    let result = [...(orders || [])];

    if (statusFilter !== 'todos') {
      const sf = statusFilter.toUpperCase();
      result = result.filter((order) => normalizeStatus(order.status) === sf);
    }

    if (clientFilter) {
      const term = clientFilter.toLowerCase();
      result = result.filter((order) => {
        const client = String(order.client_name || '').toLowerCase();
        const id = String(order.id || '').toLowerCase();
        return client.includes(term) || id.includes(term);
      });
    }

    if (dateFilter !== 'all') {
      result = result.filter((order) => {
        const orderDate = parseISO(order.created_at);
        if (dateFilter === 'today') return isToday(orderDate);
        if (dateFilter === 'week') return isThisWeek(orderDate);
        if (dateFilter === 'month') return isThisMonth(orderDate);
        return true;
      });
    }

    return result;
  }, [orders, statusFilter, dateFilter, clientFilter]);

  const masterSummary = useMemo(() => {
    if (userRole !== 'admin') {
      return {
        days: [],
        totals: { orders: 0, weight: 0, value: 0, routes: 0, vendors: 0, clients: 0, products: 0 },
      };
    }

    const dayMap = new Map();
    const routeSet = new Set();
    const vendorSet = new Set();
    const clientSet = new Set();
    const productSet = new Set();

    let totalOrders = 0;
    let totalWeight = 0;
    let totalValue = 0;

    (filteredOrders || []).forEach((order) => {
      const status = normalizeStatus(order?.status);
      if (status === ORDER_STATUS.CANCELADO) return;

      const dayKey = toDateKey(order?.delivery_date || order?.created_at);
      const routeKey = String(order?.route_name || order?.delivery_city || 'SEM ROTA').trim().toUpperCase();
      const vendorKey = String(order?.vendor_name || order?.vendor_id || 'SEM VENDEDOR').trim() || 'SEM VENDEDOR';
      const clientKey = String(order?.client_name || order?.client_id || 'SEM CLIENTE').trim() || 'SEM CLIENTE';

      const parsedItems = parseOrderItems(order?.items);
      const metrics = calculateOrderMetrics(parsedItems);

      const orderWeightFromDb = Number(order?.total_weight || 0);
      const orderWeight = orderWeightFromDb > 0 ? orderWeightFromDb : Number(metrics?.totalWeight || 0);
      const orderValue = Number(order?.total_value || 0);

      let dayNode = dayMap.get(dayKey);
      if (!dayNode) {
        dayNode = {
          dayKey,
          totalOrders: 0,
          totalWeight: 0,
          totalValue: 0,
          routes: new Map(),
        };
        dayMap.set(dayKey, dayNode);
      }

      let routeNode = dayNode.routes.get(routeKey);
      if (!routeNode) {
        routeNode = {
          routeKey,
          totalOrders: 0,
          totalWeight: 0,
          totalValue: 0,
          vendors: new Set(),
          clients: new Map(),
          products: new Map(),
        };
        dayNode.routes.set(routeKey, routeNode);
      }

      dayNode.totalOrders += 1;
      dayNode.totalWeight += orderWeight;
      dayNode.totalValue += orderValue;

      routeNode.totalOrders += 1;
      routeNode.totalWeight += orderWeight;
      routeNode.totalValue += orderValue;
      routeNode.vendors.add(vendorKey);

      const clientNode = routeNode.clients.get(clientKey) || {
        name: clientKey,
        orders: 0,
        weight: 0,
        value: 0,
      };
      clientNode.orders += 1;
      clientNode.weight += orderWeight;
      clientNode.value += orderValue;
      routeNode.clients.set(clientKey, clientNode);

      routeSet.add(routeKey);
      vendorSet.add(vendorKey);
      clientSet.add(clientKey);

      (metrics?.processedItems || []).forEach((item) => {
        const productName =
          String(item?.name || item?.descricao || item?.sku || item?.codigo || 'SEM PRODUTO').trim() || 'SEM PRODUTO';
        const quantity = Number(item?.quantity || item?.quantidade || 0) || 0;
        const weight = Number(item?.estimatedWeight || item?.total_weight || 0) || 0;

        const current = routeNode.products.get(productName) || { quantity: 0, weight: 0 };
        current.quantity += quantity;
        current.weight += weight;
        routeNode.products.set(productName, current);

        productSet.add(productName);
      });

      totalOrders += 1;
      totalWeight += orderWeight;
      totalValue += orderValue;
    });

    const days = Array.from(dayMap.values())
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
      .map((day) => ({
        dayKey: day.dayKey,
        totalOrders: day.totalOrders,
        totalWeight: day.totalWeight,
        totalValue: day.totalValue,
        routes: Array.from(day.routes.values())
          .sort(
            (a, b) =>
              b.totalWeight - a.totalWeight ||
              b.totalOrders - a.totalOrders ||
              a.routeKey.localeCompare(b.routeKey, 'pt-BR')
          )
          .map((route) => {
            const vendorsList = Array.from(route.vendors).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const clientsList = Array.from(route.clients.values())
              .sort((a, b) => b.weight - a.weight || b.orders - a.orders || a.name.localeCompare(b.name, 'pt-BR'));
            const productsList = Array.from(route.products.entries())
              .sort((a, b) => b[1].weight - a[1].weight || b[1].quantity - a[1].quantity)
              .map(([name, stats]) => ({
                name,
                quantity: stats.quantity,
                weight: stats.weight,
              }));

            const productsPreview = productsList
              .slice(0, 6)
              .map((p) => `${p.name} (${p.quantity} und)`);
            const clientsNameList = clientsList.map((client) => client.name);

            return {
              routeKey: route.routeKey,
              totalOrders: route.totalOrders,
              totalWeight: route.totalWeight,
              totalValue: route.totalValue,
              vendorsCount: vendorsList.length,
              clientsCount: clientsList.length,
              productsCount: productsList.length,
              vendorsDisplay: formatListWithOverflow(vendorsList, 3),
              clientsDisplay: formatListWithOverflow(clientsNameList, 4),
              clientsList,
              productsDisplay: formatListWithOverflow(productsPreview, 3),
            };
          }),
      }));

    return {
      days,
      totals: {
        orders: totalOrders,
        weight: totalWeight,
        value: totalValue,
        routes: routeSet.size,
        vendors: vendorSet.size,
        clients: clientSet.size,
        products: productSet.size,
      },
    };
  }, [filteredOrders, userRole]);

  // -----------------------------------------
  // Helpers UI
  // -----------------------------------------
  const formatMoney = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));
  const formatWeight = (val) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val || 0));

  const getStatusBadge = (status) => {
    const s = normalizeStatus(status);
    switch (s) {
      case ORDER_STATUS.ENVIADO:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">
            Pedido Enviado
          </Badge>
        );
      case ORDER_STATUS.CONFIRMADO:
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">
            Pedido Confirmado
          </Badge>
        );
      case ORDER_STATUS.SAIU_PARA_ENTREGA:
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
            Saiu para Entrega
          </Badge>
        );
      case ORDER_STATUS.ENTREGUE:
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
            Pedido Entregue
          </Badge>
        );
      case ORDER_STATUS.CANCELADO:
        return (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20">
            Cancelado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-400">
            {status}
          </Badge>
        );
    }
  };

  const isTransitionAllowed = (fromStatus, toStatus) => {
    if (!toStatus || fromStatus === toStatus) return false;

    // Admin pode cancelar inclusive após entrega (devolução/cancelamento pós-entrega)
    if (userRole === 'admin' && fromStatus === ORDER_STATUS.ENTREGUE && toStatus === ORDER_STATUS.CANCELADO) {
      return true;
    }

    // Níveis 1-5: somente cancelar se estiver ENVIADO
    if (userRole !== 'admin' && userLevel >= 1 && userLevel <= 5) {
      return fromStatus === ORDER_STATUS.ENVIADO && toStatus === ORDER_STATUS.CANCELADO;
    }

    // Níveis 6-10/Admin: fluxo completo com rollback operacional
    const allowedMap = {
      [ORDER_STATUS.ENVIADO]: [ORDER_STATUS.CONFIRMADO, ORDER_STATUS.CANCELADO],
      [ORDER_STATUS.CONFIRMADO]: [ORDER_STATUS.ENVIADO, ORDER_STATUS.SAIU_PARA_ENTREGA, ORDER_STATUS.CANCELADO],
      [ORDER_STATUS.SAIU_PARA_ENTREGA]: [ORDER_STATUS.CONFIRMADO, ORDER_STATUS.ENTREGUE, ORDER_STATUS.CANCELADO],
      [ORDER_STATUS.ENTREGUE]: [],
      [ORDER_STATUS.CANCELADO]: [ORDER_STATUS.ENVIADO, ORDER_STATUS.CONFIRMADO],
    };

    return (allowedMap[fromStatus] || []).includes(toStatus);
  };

  // -----------------------------------------
  // ✅ Status update alinhado ao Manual V8.4
  // -----------------------------------------
  const updateOrderStatus = async (order, newStatus, options = {}) => {
    if (!order?.id) return;
    const actionKind = String(options?.actionKind || '').trim().toUpperCase();
    const isDevolution = actionKind === 'DEVOLUCAO';

    if (userRole !== 'admin') {
      if (vendorId && onlyDigits(order?.vendor_id) !== vendorId) {
        toast({ title: 'Sem permissão para este pedido', variant: 'destructive' });
        return;
      }
      if (!vendorId && authUid && String(order?.vendor_uid || '') !== String(authUid)) {
        toast({ title: 'Sem permissão para este pedido', variant: 'destructive' });
        return;
      }
    }

    const id = order.id;
    const currentStatus = normalizeStatus(order.status);
    const dbStatus = normalizeStatus(newStatus);

    if (isDevolution && userRole !== 'admin') {
      toast({
        title: 'Ação não permitida',
        description: 'Somente admin pode registrar devolução pós-entrega.',
        variant: 'destructive',
      });
      return;
    }

    if (!isTransitionAllowed(currentStatus, dbStatus)) {
      toast({
        title: 'Transição não permitida',
        description: `Nível ${userLevel} não pode alterar de "${statusLabel(currentStatus)}" para "${statusLabel(dbStatus)}".`,
        variant: 'destructive',
      });
      return;
    }

    let cancelReason = '';
    if (dbStatus === ORDER_STATUS.CANCELADO && (userRole === 'admin' || userLevel >= 6)) {
      const promptLabel = isDevolution
        ? 'Informe o motivo da devolução (retorno ao estoque):'
        : 'Informe o motivo do cancelamento:';
      cancelReason = String(window.prompt(promptLabel) || '').trim();
      if (!cancelReason) {
        toast({
          title: 'Motivo obrigatório',
          description: isDevolution
            ? 'Devolução exige motivo obrigatório.'
            : 'Cancelamentos por níveis 6-10 exigem motivo.',
          variant: 'destructive',
        });
        return;
      }
    }

    const prevOrders = [...orders];

    setProcessingId(id);

    // Optimistic
    setOrders((curr) => curr.map((o) => (o.id === id ? { ...o, status: dbStatus } : o)));

    try {
      const updatePayload = {
        status: dbStatus,
        updated_at: new Date().toISOString(), // ✅ importante pro realtime/anti-evento velho
      };

      if (dbStatus === ORDER_STATUS.CANCELADO && cancelReason) {
        const actor = user?.usuario || user?.login || 'usuario';
        const currentObs = String(order?.observations || '').trim();
        const reasonTag = isDevolution ? 'DEVOLUCAO POS-ENTREGA' : 'CANCELAMENTO';
        const reasonLine = `[${reasonTag} ${updatePayload.updated_at}] ${actor}: ${cancelReason}`;
        updatePayload.observations = currentObs ? `${currentObs}\n${reasonLine}` : reasonLine;
      }

      const { data, error } = await supabase
        .from('pedidos')
        .update(updatePayload)
        .eq('id', id)
        .select('id, status, updated_at')       // ✅ força retorno
        .single();                               // ✅ e garante 1 linha

      if (error) throw error;
      if (!data?.id) throw new Error('Update não afetou nenhuma linha (provável RLS/policy).');

      toast({
        title: isDevolution ? 'Devolução registrada!' : 'Status atualizado!',
        description: isDevolution
          ? `Pedido #${String(id).slice(0, 8).toUpperCase()} devolvido e retornado ao estoque.`
          : `Pedido #${String(id).slice(0, 8).toUpperCase()} agora está "${statusLabel(dbStatus)}"`,
        className:
          isDevolution
            ? 'bg-amber-700 text-white'
            :
          dbStatus === ORDER_STATUS.CONFIRMADO
            ? 'bg-green-800 text-white'
            : dbStatus === ORDER_STATUS.CANCELADO
            ? 'bg-red-700 text-white'
            : dbStatus === ORDER_STATUS.SAIU_PARA_ENTREGA
            ? 'bg-blue-700 text-white'
            : 'bg-yellow-600 text-white',
      });

      // Resync do banco
      await fetchOrders();

    } catch (err) {
      console.error('[VendorDashboard] update status error:', err);

      // Reverte se falhar
      setOrders(prevOrders);

      toast({
        title: 'Erro ao atualizar',
        description:
          err?.message ||
          'Não foi possível alterar o status. Verifique RLS/permissões no Supabase.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handlePrint = (order) => {
    setSelectedOrder(order);
    setIsPrintModalOpen(true);
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  const handleAdminEditLogistics = async (order) => {
    if (userRole !== 'admin') return;
    if (!order?.id) return;

    const currentRoute = String(order?.route_name || order?.delivery_city || '').trim();
    const currentDate = normalizeDateInputToISO(order?.delivery_date || order?.created_at);
    const currentCutoff = String(order?.cutoff || '17:00');

    const nextRouteRaw = window.prompt('Nova rota do pedido:', currentRoute || '');
    if (nextRouteRaw === null) return;
    const nextRoute = String(nextRouteRaw || '').trim();
    if (!nextRoute) {
      toast({
        title: 'Rota obrigatória',
        description: 'Informe a nova rota para salvar a alteração.',
        variant: 'destructive',
      });
      return;
    }

    const nextDateRaw = window.prompt('Nova data de entrega (YYYY-MM-DD):', currentDate || '');
    if (nextDateRaw === null) return;
    const nextDate = normalizeDateInputToISO(nextDateRaw);
    if (!nextDate) {
      toast({
        title: 'Data inválida',
        description: 'Use o formato YYYY-MM-DD para a data de entrega.',
        variant: 'destructive',
      });
      return;
    }

    const nextCutoffRaw = window.prompt('Novo horário de corte (HH:mm):', currentCutoff);
    if (nextCutoffRaw === null) return;
    const nextCutoff = normalizeCutoffInput(nextCutoffRaw, currentCutoff);

    const reason = String(window.prompt('Motivo da alteração (obrigatório):', '') || '').trim();
    if (!reason) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Alteração logística por admin exige motivo.',
        variant: 'destructive',
      });
      return;
    }

    const actor = user?.usuario || user?.login || 'admin';
    const nowIso = new Date().toISOString();
    const auditLine = `[AJUSTE LOGISTICA ${nowIso}] ${actor}: rota "${currentRoute || '-'}" -> "${nextRoute}", data "${currentDate || '-'}" -> "${nextDate}", corte "${currentCutoff}" -> "${nextCutoff}". Motivo: ${reason}`;
    const currentObs = String(order?.observations || '').trim();

    setProcessingId(order.id);
    try {
      const payload = {
        route_name: nextRoute,
        route_id: String(order?.route_id || nextRoute),
        delivery_date: nextDate,
        cutoff: nextCutoff,
        observations: currentObs ? `${currentObs}\n${auditLine}` : auditLine,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('pedidos')
        .update(payload)
        .eq('id', order.id)
        .select('id')
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error('Atualização não aplicada.');

      toast({
        title: 'Logística atualizada',
        description: `Pedido #${String(order.id).slice(0, 8).toUpperCase()} ajustado com sucesso.`,
      });

      await fetchOrders();
    } catch (err) {
      console.error('[VendorDashboard] admin edit logistics error:', err);
      toast({
        title: 'Erro ao editar logística',
        description: err?.message || 'Falha ao atualizar rota/data/corte do pedido.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handlePrintDayRouteClients = () => {
    if (userRole !== 'admin') return;

    if (!masterSummary.days.length) {
      toast({
        title: 'Sem dados para impressão',
        description: 'Não há dados no painel master com os filtros atuais.',
      });
      return;
    }

    const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');

    const daysHtml = masterSummary.days
      .map((day) => {
        const routesHtml = day.routes
          .map((route) => {
            const clientsRows = (route.clientsList || [])
              .map((client) => {
                return `
                  <tr>
                    <td>${escapeHtml(client.name)}</td>
                    <td class="right">${Number(client.orders || 0)}</td>
                    <td class="right">${formatWeight(client.weight)} kg</td>
                    <td class="right">${formatMoney(client.value)}</td>
                  </tr>
                `;
              })
              .join('');

            return `
              <section class="route-block">
                <div class="route-header">
                  <h4>${escapeHtml(route.routeKey)}</h4>
                  <div class="route-meta">
                    ${route.totalOrders} pedidos | ${formatWeight(route.totalWeight)} kg | ${formatMoney(route.totalValue)}
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th class="right">Pedidos</th>
                      <th class="right">KG</th>
                      <th class="right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${clientsRows || '<tr><td colspan="4">Sem clientes nesta rota.</td></tr>'}
                  </tbody>
                </table>
              </section>
            `;
          })
          .join('');

        return `
          <section class="day-block">
            <div class="day-header">
              <h3>${escapeHtml(formatDateKey(day.dayKey))}</h3>
              <div class="day-meta">
                ${day.totalOrders} pedidos | ${formatWeight(day.totalWeight)} kg | ${formatMoney(day.totalValue)}
              </div>
            </div>
            ${routesHtml}
          </section>
        `;
      })
      .join('');

    const reportHtml = `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório Dia > Rota > Clientes</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1 { margin: 0 0 6px; font-size: 20px; }
          .subtitle { margin: 0 0 20px; color: #555; font-size: 12px; }
          .summary { margin-bottom: 14px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; }
          .day-block { margin-bottom: 18px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
          .day-header { background: #f6f6f6; padding: 10px 12px; border-bottom: 1px solid #ddd; }
          .day-header h3 { margin: 0 0 4px; font-size: 16px; }
          .day-meta { font-size: 12px; color: #444; }
          .route-block { padding: 10px 12px 14px; border-bottom: 1px dashed #ddd; }
          .route-block:last-child { border-bottom: 0; }
          .route-header { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; align-items: baseline; }
          .route-header h4 { margin: 0; font-size: 14px; }
          .route-meta { font-size: 12px; color: #444; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e5e5e5; padding: 6px 8px; text-align: left; }
          th { background: #fafafa; }
          .right { text-align: right; white-space: nowrap; }
          @media print {
            body { margin: 8mm; }
            .day-block { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>Relatório Operacional: Dia > Rota > Clientes</h1>
        <p class="subtitle">Gerado em ${escapeHtml(generatedAt)} | Status: ${escapeHtml(statusFilter)} | Período: ${escapeHtml(dateFilter)}</p>

        <div class="summary">
          <strong>Totais:</strong>
          ${masterSummary.totals.orders} pedidos |
          ${formatWeight(masterSummary.totals.weight)} kg |
          ${formatMoney(masterSummary.totals.value)} |
          ${masterSummary.totals.routes} rotas |
          ${masterSummary.totals.clients} clientes
        </div>

        ${daysHtml}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      toast({
        title: 'Pop-up bloqueado',
        description: 'Libere pop-up no navegador para imprimir o relatório.',
        variant: 'destructive',
      });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // -----------------------------------------
  // Stats
  // -----------------------------------------
  const totalOrders = orders.length;
  const totalPendentes = orders.filter((o) => normalizeStatus(o.status) === ORDER_STATUS.ENVIADO).length;
  const totalVendido = orders.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0);
  const commissionSummary = useMemo(
    () => calculateCommissionSummary(filteredOrders, { userLevel }),
    [filteredOrders, userLevel]
  );
  const commissionByOrderId = useMemo(() => {
    const map = new Map();
    commissionSummary.rows.forEach((row) => {
      map.set(String(row.orderId), row);
    });
    return map;
  }, [commissionSummary.rows]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <Helmet>
        <title>Dashboard Vendas - Schlosser</title>
      </Helmet>
      <Navigation />
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Truck className="h-8 w-8 text-[#FF6B35]" />
              Gestão de Pedidos
            </h1>
            <p className="text-gray-400 mt-1">
              {userRole === 'admin'
                ? 'Visualização administrativa de todos os pedidos.'
                : 'Gerencie, imprima e acompanhe os seus pedidos em tempo real.'}
            </p>
          </div>

          <Button
            onClick={fetchOrders}
            disabled={loading}
            className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total de Pedidos</CardTitle>
              <Clock className="h-4 w-4 text-[#FF6B35]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Pedidos Enviados</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{totalPendentes}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Vendido (Mês)</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{formatMoney(totalVendido)}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Previsão Comissão</CardTitle>
              <CheckCircle className="h-4 w-4 text-[#FF6B35]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#FF6B35]">{formatMoney(commissionSummary.totals.previewTotal)}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Elegível (Entregues)</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">
                {formatMoney(commissionSummary.totals.deliveredEligibleTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#121212] px-4 py-3 text-xs text-gray-400">
          <p>
            Previsão de comissão baseada na política comercial. Pagamento real depende de faturamento e recebimento (Cláusulas 3 e 12).
            Pipeline atual: <strong className="text-gray-200">{formatMoney(commissionSummary.totals.pipelineTotal)}</strong>.
          </p>
          {(commissionSummary.warnings.zeroRateCount > 0 || commissionSummary.warnings.inferredTableCount > 0) && (
            <p className="mt-1 text-amber-300">
              Atenção: {commissionSummary.warnings.zeroRateCount} pedidos sem taxa configurada e {commissionSummary.warnings.inferredTableCount} com tabela inferida.
            </p>
          )}
        </div>

        {userRole === 'admin' && (
          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <CardTitle className="text-lg">
                  Painel Master: Dia &gt; Rota &gt; KG Carga &gt; Vendedores &gt; Clientes &gt; Produtos
                </CardTitle>
                <Button
                  onClick={handlePrintDayRouteClients}
                  className="bg-[#FF6B35] hover:bg-[#e95f2d] text-white"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir Dia &gt; Rota &gt; Clientes
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Resumo operacional por data de entrega. Considera somente pedidos não cancelados e respeita os filtros ativos.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="rounded-md border border-white/10 bg-[#0f0f0f] p-3">
                  <p className="text-[11px] text-gray-400 uppercase">Pedidos</p>
                  <p className="text-lg font-bold">{masterSummary.totals.orders}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-[#0f0f0f] p-3">
                  <p className="text-[11px] text-gray-400 uppercase">KG Carga</p>
                  <p className="text-lg font-bold">{formatWeight(masterSummary.totals.weight)} kg</p>
                </div>
                <div className="rounded-md border border-white/10 bg-[#0f0f0f] p-3">
                  <p className="text-[11px] text-gray-400 uppercase">Valor</p>
                  <p className="text-lg font-bold">{formatMoney(masterSummary.totals.value)}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-[#0f0f0f] p-3">
                  <p className="text-[11px] text-gray-400 uppercase">Rotas</p>
                  <p className="text-lg font-bold">{masterSummary.totals.routes}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-[#0f0f0f] p-3">
                  <p className="text-[11px] text-gray-400 uppercase">Vendedores</p>
                  <p className="text-lg font-bold">{masterSummary.totals.vendors}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-[#0f0f0f] p-3">
                  <p className="text-[11px] text-gray-400 uppercase">Clientes</p>
                  <p className="text-lg font-bold">{masterSummary.totals.clients}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-[#0f0f0f] p-3">
                  <p className="text-[11px] text-gray-400 uppercase">Produtos</p>
                  <p className="text-lg font-bold">{masterSummary.totals.products}</p>
                </div>
              </div>

              {masterSummary.days.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/10 p-4 text-sm text-gray-500">
                  Sem dados para o painel master com os filtros atuais.
                </div>
              ) : (
                <div className="space-y-3">
                  {masterSummary.days.map((day) => (
                    <details key={day.dayKey} className="rounded-md border border-white/10 bg-[#0f0f0f]">
                      <summary className="cursor-pointer list-none px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1 border-b border-white/10">
                        <span className="font-semibold text-white">{formatDateKey(day.dayKey)}</span>
                        <span className="text-sm text-gray-300">
                          {day.routes.length} rotas • {day.totalOrders} pedidos • {formatWeight(day.totalWeight)} kg
                        </span>
                      </summary>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-white/5 text-gray-400 uppercase">
                            <tr>
                              <th className="px-4 py-3">Rota</th>
                              <th className="px-4 py-3 text-right">Pedidos</th>
                              <th className="px-4 py-3 text-right">KG Carga</th>
                              <th className="px-4 py-3 text-right">Valor</th>
                              <th className="px-4 py-3">Vendedores</th>
                              <th className="px-4 py-3">Clientes</th>
                              <th className="px-4 py-3">Produtos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {day.routes.map((route) => (
                              <tr key={`${day.dayKey}-${route.routeKey}`} className="hover:bg-white/5">
                                <td className="px-4 py-3 font-semibold text-white">{route.routeKey}</td>
                                <td className="px-4 py-3 text-right">{route.totalOrders}</td>
                                <td className="px-4 py-3 text-right">{formatWeight(route.totalWeight)} kg</td>
                                <td className="px-4 py-3 text-right">{formatMoney(route.totalValue)}</td>
                                <td className="px-4 py-3 text-gray-300">{route.vendorsDisplay}</td>
                                <td className="px-4 py-3 text-gray-300">{route.clientsDisplay}</td>
                                <td className="px-4 py-3 text-gray-300">{route.productsDisplay}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="bg-[#121212] p-4 rounded-lg border border-white/10 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar por cliente ou ID..."
                className="pl-9 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 focus:border-[#FF6B35]"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-white/10 text-white">
                <Filter className="w-4 h-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value={ORDER_STATUS.ENVIADO}>Pedido Enviado</SelectItem>
                <SelectItem value={ORDER_STATUS.CONFIRMADO}>Pedido Confirmado</SelectItem>
                <SelectItem value={ORDER_STATUS.SAIU_PARA_ENTREGA}>Saiu para Entrega</SelectItem>
                <SelectItem value={ORDER_STATUS.ENTREGUE}>Pedido Entregue</SelectItem>
                <SelectItem value={ORDER_STATUS.CANCELADO}>Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[170px] bg-[#0a0a0a] border-white/10 text-white">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                <SelectItem value="all">Todas as Datas</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-[#121212] rounded-lg border border-white/10 overflow-hidden shadow-xl">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-gray-400 uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">ID Pedido</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right">Valor Total</th>
                  <th className="px-6 py-4 text-right">Comissão Prev.</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => {
                    const statusUpper = normalizeStatus(order.status);
                    const isBusy = processingId === order.id;
                    const commissionRow = commissionByOrderId.get(String(order.id));
                    const tableLabel = commissionRow?.table || 'TB?';

                    return (
                      <tr key={order.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono text-gray-300">
                          #{String(order.id).slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 font-medium text-white">{order.client_name}</td>
                        <td className="px-6 py-4 text-gray-400">
                          {order.created_at ? format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm') : '--'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[#FF6B35]">
                          {formatMoney(order.total_value)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-[#FF6B35]">{formatMoney(commissionRow?.previewCommission || 0)}</div>
                          <div className="text-[10px] text-gray-500">
                            {tableLabel}
                            {commissionRow?.tableSource === 'inferred' ? ' (inferida)' : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">{getStatusBadge(order.status)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(order)}
                              className="text-gray-400 hover:text-white hover:bg-white/10"
                              title="Ver Detalhes"
                            >
                              <Eye size={18} />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrint(order)}
                              className="text-gray-400 hover:text-[#FF6B35] hover:bg-[#FF6B35]/10"
                              title="Imprimir"
                            >
                              <Printer size={18} />
                            </Button>

                            <WhatsAppShare
                              order={order}
                              className="h-9 w-9 p-0 text-gray-400 hover:text-green-500 hover:bg-green-500/10 rounded-md transition-colors flex items-center justify-center"
                            />

                            {userRole === 'admin' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy}
                                onClick={() => handleAdminEditLogistics(order)}
                                className="text-gray-400 hover:text-orange-300 hover:bg-white/10"
                                title="Editar rota/data/corte (Admin)"
                              >
                                <RouteIcon size={18} />
                              </Button>
                            )}

                            {/* CONFIRMAR */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={
                                isBusy ||
                                statusUpper === ORDER_STATUS.CONFIRMADO ||
                                statusUpper === ORDER_STATUS.SAIU_PARA_ENTREGA ||
                                statusUpper === ORDER_STATUS.ENTREGUE
                              }
                              onClick={() => updateOrderStatus(order, ORDER_STATUS.CONFIRMADO)}
                              className="text-gray-400 hover:text-green-500 hover:bg-white/10 disabled:opacity-30"
                              title="Marcar como Pedido Confirmado"
                            >
                              {isBusy && statusUpper !== ORDER_STATUS.CONFIRMADO ? (
                                <RefreshCw className="animate-spin w-4 h-4" />
                              ) : (
                                <Check size={18} />
                              )}
                            </Button>

                            {/* SAIU PARA ENTREGA */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isBusy || statusUpper === ORDER_STATUS.SAIU_PARA_ENTREGA || statusUpper === ORDER_STATUS.ENTREGUE}
                              onClick={() => updateOrderStatus(order, ORDER_STATUS.SAIU_PARA_ENTREGA)}
                              className="text-gray-400 hover:text-blue-400 hover:bg-white/10 disabled:opacity-30"
                              title="Marcar como Saiu para Entrega"
                            >
                              <Truck size={18} />
                            </Button>

                            {/* ENTREGUE */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isBusy || statusUpper === ORDER_STATUS.ENTREGUE}
                              onClick={() => updateOrderStatus(order, ORDER_STATUS.ENTREGUE)}
                              className="text-gray-400 hover:text-emerald-500 hover:bg-white/10 disabled:opacity-30"
                              title="Marcar como Pedido Entregue"
                            >
                              <CheckCircle size={18} />
                            </Button>

                            {/* VOLTAR PARA ENVIADO */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isBusy || statusUpper === ORDER_STATUS.ENVIADO}
                              onClick={() => updateOrderStatus(order, ORDER_STATUS.ENVIADO)}
                              className="text-gray-400 hover:text-yellow-500 hover:bg-white/10 disabled:opacity-30"
                              title="Voltar para Pedido Enviado"
                            >
                              <AlertCircle size={18} />
                            </Button>

                            {/* CANCELAR / REATIVAR */}
                            {statusUpper === ORDER_STATUS.CANCELADO ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy}
                                onClick={() => updateOrderStatus(order, ORDER_STATUS.CONFIRMADO)}
                                className="text-gray-400 hover:text-green-500 hover:bg-white/10"
                                title="Reativar (volta a Pedido Confirmado)"
                              >
                                <RotateCcw size={18} />
                              </Button>
                            ) : (
                              <>
                                {userRole === 'admin' && statusUpper === ORDER_STATUS.ENTREGUE && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isBusy}
                                    onClick={() =>
                                      updateOrderStatus(order, ORDER_STATUS.CANCELADO, { actionKind: 'DEVOLUCAO' })
                                    }
                                    className="text-gray-400 hover:text-amber-300 hover:bg-white/10"
                                    title="Registrar devolução (retorna ao estoque)"
                                  >
                                    <Undo2 size={18} />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isBusy || (statusUpper === ORDER_STATUS.ENTREGUE && userRole !== 'admin')}
                                  onClick={() => updateOrderStatus(order, ORDER_STATUS.CANCELADO)}
                                  className="text-gray-400 hover:text-red-400 hover:bg-white/10"
                                  title={
                                    statusUpper === ORDER_STATUS.ENTREGUE
                                      ? 'Cancelar pós-entrega (Admin)'
                                      : 'Cancelar (devolve estoque)'
                                  }
                                >
                                  <X size={18} />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      {loading ? 'Carregando pedidos...' : 'Nenhum pedido encontrado com os filtros selecionados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile list (se quiser, eu te mando também completo) */}
        </div>
      </div>

      <PrintOrderModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        order={selectedOrder}
      />

      <OrderDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
};

export default VendorDashboard;

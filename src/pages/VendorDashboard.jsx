import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
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
  RotateCcw
} from 'lucide-react';

import { format, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

import PrintOrderModal from '@/components/PrintOrderModal';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import WhatsAppShare from '@/components/WhatsAppShare';

const VendorDashboard = () => {
  console.log("[VendorDashboard] COMPONENTE RENDERIZOU");
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState('todos');
  const [dateFilter, setDateFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // -----------------------------------------
  // Fetch
  // -----------------------------------------
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[VendorDashboard] fetchOrders error:', err);
      toast({ title: 'Erro ao carregar pedidos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // -----------------------------------------
  // Real-time sync (mais robusto)
  // -----------------------------------------
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('vendor_dashboard_updates_v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        (payload) => {
          const row = payload?.new;
          const old = payload?.old;

          // DELETE
          if (payload.eventType === 'DELETE' && old?.id) {
            setOrders((curr) => curr.filter((o) => o.id !== old.id));
            return;
          }

          // INSERT / UPDATE
          if (!row?.id) return;

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
  }, [user]);

  // -----------------------------------------
  // Filters
  // -----------------------------------------
  const filteredOrders = useMemo(() => {
    let result = [...(orders || [])];

    if (statusFilter !== 'todos') {
      const sf = statusFilter.toUpperCase();
      result = result.filter((order) => String(order.status || '').toUpperCase() === sf);
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

  // -----------------------------------------
  // Helpers UI
  // -----------------------------------------
  const formatMoney = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));

  const getStatusBadge = (status) => {
    const s = String(status || 'PENDENTE').toUpperCase();
    switch (s) {
      case 'PENDENTE':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">
            Pendente
          </Badge>
        );
      case 'CONFIRMADO':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">
            Confirmado
          </Badge>
        );
      case 'ENTREGUE':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
            Entregue
          </Badge>
        );
      case 'CANCELADO':
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

  // -----------------------------------------
  // ✅ Status update (sem “toggle” perigoso)
  // -----------------------------------------
  const updateOrderStatus = async (order, newStatus) => {
  if (!order?.id) return;

  const id = order.id;
  const prevOrders = [...orders];

  setProcessingId(id);

  // Optimistic
  setOrders((curr) => curr.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));

  try {
    const { data, error } = await supabase
      .from('pedidos')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(), // ✅ importante pro realtime/anti-evento velho
      })
      .eq('id', id)
      .select('id, status, updated_at')       // ✅ força retorno
      .single();                               // ✅ e garante 1 linha

    if (error) throw error;
    if (!data?.id) throw new Error('Update não afetou nenhuma linha (provável RLS/policy).');

    toast({
      title: 'Status atualizado!',
      description: `Pedido #${String(id).slice(0, 8).toUpperCase()} agora está ${newStatus}`,
      className:
        newStatus === 'CONFIRMADO'
          ? 'bg-green-800 text-white'
          : newStatus === 'CANCELADO'
          ? 'bg-red-700 text-white'
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

  // -----------------------------------------
  // Stats
  // -----------------------------------------
  const totalOrders = orders.length;
  const totalPendentes = orders.filter((o) => String(o.status || '').toUpperCase() === 'PENDENTE').length;
  const totalVendido = orders.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0);

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
            <p className="text-gray-400 mt-1">Gerencie, imprima e acompanhe os pedidos em tempo real.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <CardTitle className="text-sm font-medium text-gray-400">Pendentes</CardTitle>
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
        </div>

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
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
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
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => {
                    const statusUpper = String(order.status || '').toUpperCase();
                    const isBusy = processingId === order.id;

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

                            {/* CONFIRMAR */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isBusy || statusUpper === 'CONFIRMADO'}
                              onClick={() => updateOrderStatus(order, 'CONFIRMADO')}
                              className="text-gray-400 hover:text-green-500 hover:bg-white/10 disabled:opacity-30"
                              title="Confirmar (entra no comprometido)"
                            >
                              {isBusy && statusUpper !== 'CONFIRMADO' ? (
                                <RefreshCw className="animate-spin w-4 h-4" />
                              ) : (
                                <Check size={18} />
                              )}
                            </Button>

                            {/* VOLTAR PRA PENDENTE */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isBusy || statusUpper === 'PENDENTE'}
                              onClick={() => updateOrderStatus(order, 'PENDENTE')}
                              className="text-gray-400 hover:text-yellow-500 hover:bg-white/10 disabled:opacity-30"
                              title="Voltar para PENDENTE"
                            >
                              <AlertCircle size={18} />
                            </Button>

                            {/* CANCELAR / REATIVAR */}
                            {statusUpper === 'CANCELADO' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy}
                                onClick={() => updateOrderStatus(order, 'CONFIRMADO')}
                                className="text-gray-400 hover:text-green-500 hover:bg-white/10"
                                title="Reativar (volta a CONFIRMADO)"
                              >
                                <RotateCcw size={18} />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isBusy}
                                onClick={() => updateOrderStatus(order, 'CANCELADO')}
                                className="text-gray-400 hover:text-red-400 hover:bg-white/10"
                                title="Cancelar (devolve estoque)"
                              >
                                <X size={18} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
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

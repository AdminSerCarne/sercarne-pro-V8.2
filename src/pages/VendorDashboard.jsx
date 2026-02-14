import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
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
  AlertCircle
} from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PrintOrderModal from '@/components/PrintOrderModal';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import WhatsAppShare from '@/components/WhatsAppShare';
import { useToast } from '@/components/ui/use-toast';

const VendorDashboard = () => {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState('todos');
  const [dateFilter, setDateFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchOrders();

    // Real-time updates (sem conflito com update manual)
    const channel = supabase
      .channel('dashboard_updates_vendor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        if (payload?.new?.id && payload.new.id !== processingId) {
          setOrders((current) => {
            const exists = current.find((o) => o.id === payload.new.id);
            if (exists) {
              return current.map((o) => (o.id === payload.new.id ? payload.new : o));
            }
            return [payload.new, ...current];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // não incluir processingId aqui pra não re-subscrever

  useEffect(() => {
    let result = [...orders];

    // status
    if (statusFilter !== 'todos') {
      result = result.filter((order) => (order.status || 'PENDENTE').toLowerCase() === statusFilter.toLowerCase());
    }

    // busca
    if (clientFilter) {
      const term = clientFilter.toLowerCase();
      result = result.filter((order) =>
        (order.client_name && order.client_name.toLowerCase().includes(term)) ||
        (order.id && order.id.toLowerCase().includes(term))
      );
    }

    // data
    if (dateFilter !== 'all') {
      result = result.filter((order) => {
        const orderDate = parseISO(order.created_at);
        if (dateFilter === 'today') return isToday(orderDate);
        if (dateFilter === 'week') return isThisWeek(orderDate);
        if (dateFilter === 'month') return isThisMonth(orderDate);
        return true;
      });
    }

    setFilteredOrders(result);
  }, [orders, statusFilter, dateFilter, clientFilter]);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast({ title: 'Erro ao carregar pedidos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Regra oficial:
  // CONFIRMADO -> CANCELADO (retorna estoque)
  // CANCELADO/PENDENTE -> CONFIRMADO (reativa / confirma)
  const handleStatusChange = async (order) => {
    const current = (order.status || 'PENDENTE').toUpperCase();
    const newStatus = current === 'CONFIRMADO' ? 'CANCELADO' : 'CONFIRMADO';

    setProcessingId(order.id);

    // optimistic
    const previousOrders = [...orders];
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o)));

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'Status atualizado!',
        description: `Pedido #${order.id.slice(0, 8)} agora está ${newStatus}`,
        className: newStatus === 'CONFIRMADO' ? 'bg-green-800 text-white' : 'bg-red-700 text-white'
      });
    } catch (error) {
      console.error('Error updating status:', error);
      setOrders(previousOrders);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive'
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

  const formatMoney = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));

  const getStatusBadge = (status) => {
    const s = (status || 'PENDENTE').toUpperCase();
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
      case 'CANCELADO':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">
            Cancelado
          </Badge>
        );
      case 'ENTREGUE':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
            Entregue
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-400">
            {s}
          </Badge>
        );
    }
  };

  const getActionTitle = (status) => {
    const s = (status || 'PENDENTE').toUpperCase();
    return s === 'CONFIRMADO' ? 'Cancelar pedido (retorna estoque)' : 'Confirmar / Reativar';
  };

  const getActionIcon = (status) => {
    const s = (status || 'PENDENTE').toUpperCase();
    return s === 'CONFIRMADO' ? <X size={18} /> : <Check size={18} />;
  };

  const totalMonthValue = orders.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0);
  const pendingCount = orders.filter((o) => (o.status || 'PENDENTE').toUpperCase() === 'PENDENTE').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <Helmet>
        <title>Dashboard Vendas - Schlosser</title>
      </Helmet>

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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total de Pedidos</CardTitle>
              <Clock className="h-4 w-4 text-[#FF6B35]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Pendentes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#121212] border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Vendido (Mês)</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{formatMoney(totalMonthValue)}</div>
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
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-white/10 text-white">
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
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-300">
                        #{String(order.id).slice(0, 8).toUpperCase()}
                      </td>

                      <td className="px-6 py-4 font-medium text-white">
                        {order.client_name || 'Cliente'}
                      </td>

                      <td className="px-6 py-4 text-gray-400">
                        {order.created_at
                          ? format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </td>

                      <td className="px-6 py-4 text-right font-bold text-[#FF6B35]">
                        {formatMoney(order.total_value)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>

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

                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={processingId === order.id}
                            onClick={() => handleStatusChange(order)}
                            className={`
                              ${(order.status || 'PENDENTE').toUpperCase() === 'CONFIRMADO'
                                ? 'text-green-500 hover:text-red-500'
                                : 'text-gray-400 hover:text-green-500'}
                              hover:bg-white/10
                            `}
                            title={getActionTitle(order.status)}
                          >
                            {processingId === order.id ? (
                              <RefreshCw className="animate-spin w-4 h-4" />
                            ) : (
                              getActionIcon(order.status)
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
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

          {/* Mobile (lista) — simples, mantendo as mesmas ações */}
          <div className="lg:hidden divide-y divide-white/10">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <div key={order.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-mono text-gray-300">
                        #{String(order.id).slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-base font-semibold text-white">
                        {order.client_name || 'Cliente'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {order.created_at
                          ? format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(order.status)}
                      <div className="text-sm font-bold text-[#FF6B35]">
                        {formatMoney(order.total_value)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-white/10 bg-black/20 hover:bg-white/5 text-white"
                      onClick={() => handleViewDetails(order)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Detalhes
                    </Button>

                    <Button
                      variant="outline"
                      className="flex-1 border-white/10 bg-black/20 hover:bg-white/5 text-white"
                      onClick={() => handlePrint(order)}
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <WhatsAppShare
                      order={order}
                      className="flex-1 h-10 px-3 text-gray-300 hover:text-green-500 hover:bg-green-500/10 rounded-md border border-white/10 transition-colors flex items-center justify-center"
                    />
                    <Button
                      className="flex-1 h-10"
                      disabled={processingId === order.id}
                      onClick={() => handleStatusChange(order)}
                      title={getActionTitle(order.status)}
                    >
                      {processingId === order.id ? (
                        <RefreshCw className="animate-spin w-4 h-4 mr-2" />
                      ) : (
                        <>
                          {(order.status || 'PENDENTE').toUpperCase() === 'CONFIRMADO' ? (
                            <X className="w-4 h-4 mr-2" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                        </>
                      )}
                      {(order.status || 'PENDENTE').toUpperCase() === 'CONFIRMADO' ? 'Cancelar' : 'Confirmar'}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center text-gray-500">
                {loading ? 'Carregando pedidos...' : 'Nenhum pedido encontrado com os filtros selecionados.'}
              </div>
            )}
          </div>
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

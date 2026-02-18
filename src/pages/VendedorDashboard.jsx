
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Truck, Clock, RefreshCw, AlertCircle, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PrintOrderModal from '@/components/PrintOrderModal';
import WhatsAppShare from '@/components/WhatsAppShare';
import Navigation from '@/components/Navigation';

const VendedorDashboard = () => {
  const { user } = useSupabaseAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch from new 'pedidos' table
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (order) => {
    setSelectedOrder(order);
    setIsPrintModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const s = status ? status.toUpperCase() : 'UNKNOWN';
    switch(s) {
      case 'PENDENTE': return <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">Pendente</Badge>;
      case 'CONFIRMADO': return <Badge variant="outline" className="text-blue-600 border-blue-600 bg-blue-50">Confirmado</Badge>;
      case 'ENTREGUE': return <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">Entregue</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const pendingCount = orders.filter(r => r.status === 'PENDENTE').length;
  const totalCount = orders.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Helmet>
        <title>Dashboard Vendedor - Sistema Schlosser</title>
      </Helmet>
      <Navigation />
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel do Vendedor</h1>
          <p className="text-gray-500">Gestão de pedidos e reservas</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{pendingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido (Mês)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
               {formatMoney(orders.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Rota/Entrega</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Itens</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {format(new Date(order.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                        {order.client_name}
                        <div className="text-xs text-gray-400 font-normal">{order.client_cnpj}</div>
                    </td>
                    <td className="px-4 py-3">
                        <div className="text-xs font-bold">{order.route_name}</div>
                        <div className="text-xs text-gray-500">
                            {format(new Date(order.delivery_date), 'dd/MM/yyyy')}
                        </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                        {formatMoney(order.total_value)}
                    </td>
                    <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="bg-gray-100">
                            {order.items ? order.items.length : 0}
                        </Badge>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-3 flex gap-2 justify-center items-center">
                       <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handlePrint(order)}
                          title="Imprimir Pedido"
                       >
                         <Printer size={18} />
                       </Button>
                       <WhatsAppShare order={order} />
                    </td>
                  </tr>
                ))}
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">Nenhum pedido encontrado</td>
                  </tr>
                )}
                {loading && (
                    <tr>
                        <td colSpan="7" className="text-center py-8">
                            <div className="flex justify-center items-center gap-2 text-gray-400">
                                <RefreshCw className="animate-spin w-4 h-4" /> Carregando pedidos...
                            </div>
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PrintOrderModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
};

export default VendedorDashboard;

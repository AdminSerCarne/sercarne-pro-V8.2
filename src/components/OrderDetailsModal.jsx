import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Package, User, Calendar, MapPin } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ORDER_STATUS, normalizeOrderStatus } from '@/domain/orderStatus';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';

const OrderDetailsModal = ({ isOpen, onClose, order }) => {
  const { processedItems, totalValue: computedTotalValue } = useMemo(
    () => calculateOrderMetrics(order?.items),
    [order?.items]
  );

  if (!order) return null;
  const normalizedStatus = normalizeOrderStatus(order.status);
  const statusText =
    normalizedStatus === ORDER_STATUS.ENVIADO ? 'PEDIDO ENVIADO' :
    normalizedStatus === ORDER_STATUS.CONFIRMADO ? 'PEDIDO CONFIRMADO' :
    normalizedStatus === ORDER_STATUS.SAIU_PARA_ENTREGA ? 'SEU PEDIDO SAIU PARA ENTREGA' :
    normalizedStatus === ORDER_STATUS.ENTREGUE ? 'PEDIDO ENTREGUE' :
    normalizedStatus === ORDER_STATUS.CANCELADO ? 'CANCELADO' :
    normalizedStatus;
  
  const formatMoney = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));

  const formatCpfCnpj = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
  
    if (digits.length === 11) {
      // CPF: 000.000.000-00
      return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
  
    if (digits.length === 14) {
      // CNPJ: 00.000.000/0000-00
      return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
  
    return value || '';
  };
    
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#121212] border border-white/10 text-white shadow-2xl">
        <DialogHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    Pedido #{order.id.slice(0, 8).toUpperCase()}
                </DialogTitle>
                <DialogDescription className="text-gray-400 flex items-center gap-2">
                    <Calendar size={14} />
                    Criado em: {format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm')}
                </DialogDescription>
            </div>
            <Badge variant="outline" className={`
                ${normalizedStatus === ORDER_STATUS.CONFIRMADO || normalizedStatus === ORDER_STATUS.SAIU_PARA_ENTREGA || normalizedStatus === ORDER_STATUS.ENTREGUE
                  ? 'text-green-500 border-green-500 bg-green-500/10'
                  : normalizedStatus === ORDER_STATUS.CANCELADO
                  ? 'text-red-500 border-red-500 bg-red-500/10'
                  : 'text-yellow-500 border-yellow-500 bg-yellow-500/10'}
            `}>
                {statusText}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
                <div className="bg-[#1a1a1a] p-4 rounded-lg border border-white/5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <User size={14} className="text-[#FF6B35]"/> Cliente
                    </h3>
                    <p className="font-bold text-lg">{order.client_name}</p>
                    {(() => {
                        const docDigits = String(order?.client_cnpj || '').replace(/\D/g, '');
                        const label = docDigits.length === 11 ? 'CPF' : 'CNPJ';
                        const formatted = formatCpfCnpj(docDigits);
                      
                        return (
                          <p className="text-gray-500 text-sm font-mono mt-1">
                            {label}: {formatted || 'N/A'}
                          </p>
                        );
                      })()}
                </div>
                
                <div className="bg-[#1a1a1a] p-4 rounded-lg border border-white/5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <MapPin size={14} className="text-[#FF6B35]"/> Entrega
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-gray-400">Data Agendada:</span>
                            <span className="font-medium text-white">
                                {order.delivery_date ? format(parseISO(order.delivery_date), 'dd/MM/yyyy') : 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-gray-400">Rota:</span>
                            <span className="font-medium text-white">{order.route_name || 'Padrão'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Corte:</span>
                            <span className="font-medium text-white">{order.cutoff || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-lg border border-white/5 flex flex-col h-full overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest p-4 border-b border-white/5 flex items-center gap-2 bg-[#222]">
                    <Package size={14} className="text-[#FF6B35]"/> Itens ({processedItems.length || 0})
                </h3>
                <ScrollArea className="flex-1 max-h-[300px]">
                    <div className="divide-y divide-white/5">
                        {processedItems.map((item, idx) => (
                            <div key={idx} className="p-3 hover:bg-white/5 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-sm text-white line-clamp-2 w-3/4">{item.name || item.descricao}</span>
                                    <span className="font-bold text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                        {item.quantity || 0} {item.unitType || 'UND'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>Cód: {item.sku || item.codigo || '-'}</span>
                                    <span className="text-[#FF6B35] font-medium">{formatMoney(item.estimatedValue)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-4 bg-[#222] border-t border-white/5">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-300">VALOR TOTAL</span>
                        <span className="font-bold text-xl text-[#FF6B35]">{formatMoney(order.total_value || computedTotalValue)}</span>
                    </div>
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsModal;

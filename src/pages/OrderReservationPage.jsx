import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, CheckCircle, Package, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import { schlosserApi } from '@/services/schlosserApi';

const OrderReservationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const savedOrders = JSON.parse(localStorage.getItem('schlosser_client_orders') || '[]');
    const found = savedOrders.find(o => o.id === id);
    if (found) {
      setOrder(found);
    } else {
      navigate('/cliente');
    }
  }, [id, navigate]);

  const handleWhatsApp = () => {
    if (!order) return;
    
    let message = `*NOVO PEDIDO #${order.id}*\n`;
    message += `Data: ${new Date(order.date).toLocaleString('pt-BR')}\n`;
    message += `Entrega: *${new Date(order.deliveryDate).toLocaleDateString('pt-BR')}*\n\n`;
    message += `*ITENS DO PEDIDO:*\n`;
    
    let grandTotal = 0;

    order.items.forEach(item => {
        const calc = schlosserApi.calculateLineItem(item.product, item.quantity);
        grandTotal += calc.total;
        
        message += `--------------------------------\n`;
        message += `*${item.product.sku}* - ${item.product.descricao}\n`;
        message += `${calc.displayString}\n`;
    });

    const fmtMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    
    message += `--------------------------------\n`;
    message += `\n*TOTAL GERAL: ${fmtMoney(grandTotal)}*`;

    const encoded = encodeURIComponent(message);
    const phone = "5555999082024";
    const url = `https://wa.me/${phone}?text=${encoded}`;
    
    window.open(url, '_blank');
  };

  if (!order) return null;

  const calculateTotal = () => {
    return order.items.reduce((acc, item) => {
        return acc + schlosserApi.calculateLineItem(item.product, item.quantity).total;
    }, 0);
  };
  
  const total = calculateTotal();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />
      
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/cliente')}
          className="mb-6 pl-0 hover:bg-transparent hover:text-[#FF8C42]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Catálogo
        </Button>

        <div className="bg-white rounded-xl shadow-xl border border-green-200 overflow-hidden">
           {/* Header */}
           <div className="bg-gradient-to-b from-green-50 to-white p-8 text-center border-b border-green-100">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                 <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-green-800 mb-2">Pedido Reservado!</h1>
              <div className="inline-flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full text-green-800 text-sm font-medium">
                  <CalendarCheck className="w-4 h-4" />
                  Entrega confirmada: {new Date(order.deliveryDate).toLocaleDateString()}
              </div>
              <p className="text-gray-500 mt-4 max-w-md mx-auto">
                 Os itens foram temporariamente reservados. Envie para o WhatsApp para confirmar o faturamento e logística.
              </p>
           </div>

           {/* Order Details */}
           <div className="p-6 md:p-8">
              <div className="space-y-4">
                 {order.items.map((item, idx) => {
                    const calc = schlosserApi.calculateLineItem(item.product, item.quantity);
                    return (
                        <div key={idx} className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 items-center">
                           {item.product.imagem ? (
                               <img src={item.product.imagem} className="w-16 h-16 object-contain bg-white rounded border border-gray-200 p-1" />
                           ) : (
                               <div className="w-16 h-16 bg-white rounded border border-gray-200 flex items-center justify-center">
                                   <Package className="w-6 h-6 text-gray-300" />
                               </div>
                           )}
                           <div className="flex-1">
                               <p className="font-bold text-gray-800 text-sm">{item.product.descricao}</p>
                               <div className="flex flex-wrap gap-2 mt-1">
                                  <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">Ref: {item.product.sku}</span>
                                  <span className="text-xs font-mono text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 font-bold">
                                      {item.quantity} {item.product.sku >= 410000 ? 'CX' : 'UND'}
                                  </span>
                               </div>
                           </div>
                           <div className="text-right">
                               <span className="block font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calc.total)}</span>
                           </div>
                        </div>
                    );
                 })}
              </div>

              {/* Footer / Total */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-end mb-6">
                      <span className="text-gray-500 font-medium">Total do Pedido</span>
                      <span className="text-4xl font-bold text-[#FF8C42]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                      </span>
                  </div>

                  <Button 
                    onClick={handleWhatsApp} 
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-xl shadow-lg hover:shadow-xl transition-all rounded-xl"
                  >
                    <MessageCircle className="w-6 h-6 mr-3" /> 
                    Confirmar no WhatsApp
                  </Button>
                  
                  <p className="text-center text-xs text-gray-400 mt-4">
                    Ao clicar, o pedido será enviado para a central de vendas.
                  </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default OrderReservationPage;
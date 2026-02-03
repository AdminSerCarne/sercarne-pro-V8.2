import React, { useState, useEffect } from 'react';
import { AlertTriangle, CalendarCheck, Loader2, CheckCircle2, ArrowRight, Wrench } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { getStockBreakdown, getFutureStockAvailability } from '@/utils/stockValidator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const CartStockValidator = ({ client, selectedDate, onDateSelect }) => {
  const { cartItems, updateItemQuantity } = useCart();
  const [stockStatus, setStockStatus] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);
  const { toast } = useToast();

  const formatDate = (d) => d ? format(new Date(d), "dd/MM/yyyy", { locale: ptBR }) : '';

  useEffect(() => {
    let isMounted = true;

    const validateCart = async () => {
       if (!selectedDate || cartItems.length === 0) {
           if (isMounted) setHasErrors(false);
           return;
       }
       
       if (isMounted) setIsValidating(true);
       
       const { processedItems } = calculateOrderMetrics(cartItems);
       const statuses = {};
       let foundError = false;

       for (const item of processedItems) {
           const neededQty = item.quantity;
           const dateStr = new Date(selectedDate).toISOString().split('T')[0];

           // Use new breakdown function
           const breakdown = await getStockBreakdown(item.codigo, dateStr);
           
           const hasStock = breakdown.available >= neededQty;
           
           let suggestion = null;
           if (!hasStock) {
               const futureOptions = await getFutureStockAvailability(item.codigo, neededQty);
               if (futureOptions.length > 0) {
                   suggestion = futureOptions[0];
               }
               foundError = true;
           }
           
           statuses[item.codigo] = {
               hasStock,
               breakdown,
               needed: neededQty,
               suggestion
           };
       }

       if (isMounted) {
           setStockStatus(statuses);
           setHasErrors(foundError);
           setIsValidating(false);
       }
    };

    const timeoutId = setTimeout(validateCart, 500);
    return () => {
        clearTimeout(timeoutId);
        isMounted = false;
    };
  }, [cartItems, selectedDate]);

  const handleFixCart = () => {
      let fixes = 0;
      Object.entries(stockStatus).forEach(([codigo, status]) => {
          if (!status.hasStock) {
              const maxAvailable = status.breakdown.available;
              if (maxAvailable > 0) {
                  updateItemQuantity(codigo, maxAvailable);
                  fixes++;
              }
          }
      });
      
      if (fixes > 0) {
          toast({
              title: "Carrinho Ajustado",
              description: `${fixes} itens foram ajustados para a quantidade máxima disponível.`,
          });
      } else {
           toast({
              title: "Atenção",
              description: "Alguns itens estão sem estoque nenhum. Remova-os ou troque a data.",
              variant: "destructive"
          });
      }
  };

  if (!selectedDate || cartItems.length === 0) return null;

  return (
    <div className="space-y-4">
       {/* Global Status Banner */}
       {isValidating ? (
           <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
               <Loader2 className="w-4 h-4 animate-spin" />
               Validando disponibilidade de estoque...
           </div>
       ) : hasErrors ? (
           <div className="p-3 bg-red-50 border border-red-200 rounded-lg animate-in fade-in">
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-red-800 font-bold mb-1">
                       <AlertTriangle className="w-5 h-5" />
                       <span>Atenção: Estoque Insuficiente</span>
                   </div>
                   <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 text-red-700 border-red-300 hover:bg-red-100 bg-white"
                        onClick={handleFixCart}
                   >
                       <Wrench className="w-3 h-3 mr-1" /> Ajustar Qtds
                   </Button>
               </div>
               <p className="text-xs text-red-700 mt-1">Alguns itens não possuem estoque suficiente para {formatDate(selectedDate)}.</p>
           </div>
       ) : (
           <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 animate-in fade-in">
               <CheckCircle2 className="w-5 h-5" />
               <div>
                   <p className="font-bold text-sm">Estoque Garantido</p>
                   <p className="text-xs">Todos os itens disponíveis para entrega em {formatDate(selectedDate)}.</p>
               </div>
           </div>
       )}

       {/* Detailed Item List */}
       <div className="space-y-2">
           {cartItems.map(item => {
               const status = stockStatus[item.codigo];
               if (!status) return null; // Loading state handled globally

               const { breakdown, hasStock, needed, suggestion } = status;

               return (
                   <div key={item.codigo} className={`border rounded-lg p-3 text-sm ${hasStock ? 'bg-white border-gray-100' : 'bg-red-50 border-red-200 shadow-sm'}`}>
                       <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-gray-800 line-clamp-1">{item.descricao}</span>
                           <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${hasStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                               {hasStock ? 'OK' : 'FALTA'}
                           </span>
                       </div>
                       
                       {/* Calculation Breakdown */}
                       <div className="text-[10px] text-gray-500 font-mono mt-1 bg-black/5 p-1.5 rounded inline-block">
                           <span title="Estoque Físico">Base: {breakdown.base}</span>
                           <span className="mx-1 text-gray-300">|</span>
                           <span title="Entradas Previstas" className="text-blue-600">+ Entradas: {breakdown.entradas}</span>
                           <span className="mx-1 text-gray-300">|</span>
                           <span title="Pedidos Confirmados" className="text-orange-600">- Pedidos: {breakdown.pedidos}</span>
                           <span className="mx-1 text-gray-400">=</span>
                           <strong className={hasStock ? "text-green-700" : "text-red-700"}>
                               {breakdown.available} Disp.
                           </strong>
                       </div>

                       {/* Error State: Show Suggestion */}
                       {!hasStock && (
                           <div className="mt-2 pt-2 border-t border-red-200/50">
                               <p className="text-xs text-red-600 mb-1">
                                   Você pediu <strong>{needed}</strong>, mas só temos <strong>{breakdown.available}</strong>.
                               </p>
                               
                               {suggestion ? (
                                   <div className="flex items-center justify-between bg-white/60 p-2 rounded border border-green-200 mt-1">
                                       <div className="text-xs text-green-800">
                                            <span className="font-bold">Disponível em:</span> {formatDate(suggestion.date)}
                                       </div>
                                       <Button 
                                            size="sm" 
                                            className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-1"
                                            onClick={() => onDateSelect(suggestion.date)}
                                       >
                                           Trocar Data <ArrowRight className="w-3 h-3" />
                                       </Button>
                                   </div>
                               ) : (
                                   <p className="text-[10px] text-gray-500 italic">Sem previsão futura para esta quantidade.</p>
                               )}
                           </div>
                       )}
                   </div>
               );
           })}
       </div>
    </div>
  );
};

export default CartStockValidator;
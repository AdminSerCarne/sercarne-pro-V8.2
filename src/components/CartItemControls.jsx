
import React, { useState } from 'react';
import { Trash2, Plus, Minus, Scale, CalendarCheck, AlertTriangle, Loader2, RefreshCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { validateAndSuggestAlternativeDate } from '@/utils/stockValidator';

const CartItemControls = ({ 
    item, 
    onUpdateQuantity, 
    onRemove, 
    deliveryDate,
    validationStatus 
}) => {
  const { processedItems } = calculateOrderMetrics([item]);
  const metrics = processedItems[0];
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const maxAvailable = validationStatus ? validationStatus.available : 9999;
  const isOverLimit = item.quantidade > maxAvailable;
  
  // Task 4: Validate before update
  const handleUpdate = async (newQty) => {
      if (newQty < 1) return; 
      setUpdating(true);
      
      try {
          if (newQty > item.quantidade) {
              const targetDate = deliveryDate || new Date();
              const validation = await validateAndSuggestAlternativeDate(item.codigo, newQty, targetDate);
              
              if (!validation.isValid) {
                  const b = validation.breakdown;
                  // Specific error message
                  const errorDesc = `Estoque insuficiente para esta data.\nDisp: ${validation.availableQty} UND`;
                  
                  toast({
                      title: "Quantidade Indisponível",
                      description: errorDesc,
                      variant: "destructive",
                      duration: 3000
                  });
                  return; // Block update
              }
          }
          await onUpdateQuantity(item.codigo, newQty);
      } catch (error) {
          console.error("Error updating cart item:", error);
      } finally {
          setUpdating(false);
      }
  };

  const [checkingAlternative, setCheckingAlternative] = useState(false);
  const handleSuggestAlternative = async () => {
      setCheckingAlternative(true);
      try {
          const targetDate = deliveryDate || new Date();
          const validation = await validateAndSuggestAlternativeDate(item.codigo, item.quantidade, targetDate);
          
          if (validation.suggestedDate) {
              toast({
                  title: "Data Sugerida Encontrada",
                  description: `Estoque disponível a partir de ${format(parseISO(validation.suggestedDate), 'dd/MM/yyyy')}`,
                  className: "bg-green-600 text-white border-green-700"
              });
          } else {
             toast({
                  title: "Sem datas próximas",
                  description: "Não encontramos estoque suficiente nos próximos 30 dias.",
                  variant: "destructive"
              }); 
          }
      } finally {
          setCheckingAlternative(false);
      }
  };

  return (
    <div className={`flex flex-col gap-3 py-4 border-b border-gray-100 last:border-0 relative w-full group transition-colors duration-300 ${isOverLimit ? 'bg-red-50/40 p-2 rounded-lg border-red-100' : ''}`}>
      <div className="flex gap-3">
          <div className="w-16 h-16 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-200 p-1 relative overflow-hidden">
             <img 
                src={item.imagem || 'https://via.placeholder.com/100?text=Img'} 
                alt={item.descricao} 
                className="w-full h-full object-contain mix-blend-multiply transition-transform group-hover:scale-105" 
             />
          </div>
          <div className="flex-1 min-w-0">
             <div className="flex justify-between items-start gap-2">
                 <div className="flex-1 min-w-0 pr-2">
                    <p className="text-[10px] text-gray-400 font-mono leading-none mb-1">SKU: {item.codigo}</p>
                    <h4 className="font-bold text-gray-800 text-sm line-clamp-2 leading-tight break-words">{item.descricao}</h4>
                 </div>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                    onClick={() => onRemove(item.codigo)}
                 >
                    <Trash2 className="w-4 h-4" />
                 </Button>
             </div>
             
             <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                <CalendarCheck className="w-3 h-3 text-gray-400" />
                <span>
                    {deliveryDate ? format(new Date(deliveryDate), "dd/MM/yyyy", { locale: ptBR }) : 'Selecione uma data'}
                </span>
                {/* Stock Status Indicator */}
                {!isOverLimit && validationStatus && (
                    <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1 rounded ml-1">
                        Disponível: {validationStatus.available} UND
                    </span>
                )}
             </div>
          </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
          <div className="flex flex-col gap-1 text-xs text-gray-500 min-w-[120px]">
              <div className="flex items-center gap-1" title="Peso Total Estimado">
                  <Scale size={10} /> 
                  <span className="font-medium text-gray-700">{metrics.formattedWeight} kg</span>
              </div>
              <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">{metrics.formattedValue}</span>
              </div>
          </div>

          <div className="flex items-center bg-white rounded-md border border-gray-200 h-8 shadow-sm">
            <button 
              onClick={() => handleUpdate(item.quantidade - 1)}
              disabled={updating || item.quantidade <= 1}
              className="px-2 hover:bg-gray-50 rounded-l-md h-full transition-colors text-gray-600 border-r border-gray-100 disabled:opacity-50"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="w-10 text-center h-full flex items-center justify-center bg-white relative">
               {updating ? <Loader2 className="w-3 h-3 animate-spin text-orange-500" /> : <span className={`font-bold text-sm ${isOverLimit ? 'text-red-600' : 'text-gray-800'}`}>{item.quantidade}</span>}
            </div>
            <button 
              onClick={() => handleUpdate(item.quantidade + 1)}
              disabled={updating}
              className="px-2 hover:bg-gray-50 rounded-r-md h-full transition-colors text-gray-600 border-l border-gray-100 disabled:opacity-50 disabled:bg-gray-50"
            >
              <Plus className="w-3 h-3" />
            </button>
         </div>
      </div>

      {isOverLimit && (
           <div className="flex flex-col gap-2 text-xs text-red-600 bg-white border border-red-200 p-2 rounded-md w-full animate-in slide-in-from-top-1 mt-1 shadow-sm">
               <div className="flex items-start gap-2">
                   <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                   <div className="flex-1">
                       <p className="font-bold">Estoque insuficiente para esta data</p>
                       <p className="opacity-90 leading-tight mt-0.5">
                           Disponível: <strong>{maxAvailable} UND</strong>. Solicitado: <strong>{item.quantidade} UND</strong>.
                       </p>
                   </div>
               </div>
               
               <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-7 text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={handleSuggestAlternative}
                    disabled={checkingAlternative}
                >
                    {checkingAlternative ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>}
                    Sugerir data alternativa
               </Button>
           </div>
      )}
    </div>
  );
};

export default CartItemControls;

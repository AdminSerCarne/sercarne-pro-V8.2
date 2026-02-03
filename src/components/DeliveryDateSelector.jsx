
import React, { useState, useEffect } from 'react';
import { format, addDays, getDay, isAfter, startOfDay, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Truck, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { schlosserApi } from '@/services/schlosserApi';

const DeliveryDateSelector = ({ 
  cartItem, // { sku, quantity_unit } 
  route, // { dias_entrega, corte_ate, descricao_grupo_rota... }
  selectedDate, 
  onDateSelect, 
  className
}) => {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestedDate, setSuggestedDate] = useState(null);

  useEffect(() => {
    if (!route || !cartItem) {
        setLoading(false);
        return;
    }

    const calculateDates = async () => {
        setLoading(true);
        const quantityNeeded = cartItem.quantidade || cartItem.quantity || cartItem.quantity_unit || 1;
        const productCode = cartItem.codigo || cartItem.sku;
        
        console.log(`[DeliveryDateSelector] Processing SKU: ${productCode}, Qty needed: ${quantityNeeded}`);

        try {
            const today = new Date();
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();
            
            // Parse cutoff time (e.g. "17:30")
            const [cutoffHour, cutoffMinute] = (route.corte_ate || "17:00").split(':').map(Number);
            const cutoffTime = `${cutoffHour}:${cutoffMinute < 10 ? '0'+cutoffMinute : cutoffMinute}`;
            
            const isCutoffPassed = currentHour > cutoffHour || (currentHour === cutoffHour && currentMinute >= cutoffMinute);
            
            console.log(`[DeliveryDateSelector] Current time: ${today.toLocaleTimeString()}, Cutoff: ${cutoffTime}, Can order today? ${!isCutoffPassed}`);

            // Map days string "SEG, TER, SEX" to numbers
            const daysMap = {
                'DOM': 0, 'SEG': 1, 'TER': 2, 'QUA': 3, 'QUI': 4, 'SEX': 5, 'SAB': 6
            };
            
            const validDayNumbers = [];
            const dayStr = (route.dias_entrega || "").toUpperCase();
            
            Object.keys(daysMap).forEach(key => {
                if (dayStr.includes(key)) validDayNumbers.push(daysMap[key]);
            });

            if (validDayNumbers.length === 0 && (dayStr.includes('DIARIO') || dayStr.includes('DIÁRIO'))) {
                 [1,2,3,4,5].forEach(d => validDayNumbers.push(d));
            }

            // Generate next potential dates
            const potentialDates = [];
            let foundCount = 0;
            // Scan next 30 days
            for (let i = 0; i < 30; i++) {
                const d = addDays(today, i);
                const dayOfWeek = getDay(d);
                
                // Skip today if cutoff passed for today
                if (i === 0 && isCutoffPassed) {
                    console.log(`[DeliveryDateSelector] Skipping today ${format(d, 'dd/MM')} due to cutoff.`);
                    continue;
                }

                // Check if valid delivery day
                if (validDayNumbers.includes(dayOfWeek)) {
                     potentialDates.push(d);
                     foundCount++;
                     // Limit max 4 dates in selector
                     if (foundCount >= 4) break; 
                }
            }
            
            // Now calculate stock for each potential date
            const calculatedDates = [];
            let firstGreenDate = null;

            for (const date of potentialDates) {
                const formattedDate = format(date, 'dd/MM/yyyy');
                const result = await schlosserApi.calculateAvailableStock(productCode, date);
                const isSufficient = result.availableStock >= quantityNeeded;
                const status = isSufficient ? 'green' : 'red';
                
                console.log(`[DeliveryDateSelector] Date: ${formattedDate}, Available stock: ${result.availableStock}, Status: ${status}`);

                const dateObj = {
                    date: date,
                    dayName: format(date, 'EEEE', { locale: ptBR }),
                    formattedDate: format(date, 'dd/MM'),
                    fullDateStr: format(date, 'yyyy-MM-dd'),
                    availableStock: result.availableStock,
                    isSufficient: isSufficient,
                    status: status
                };

                calculatedDates.push(dateObj);

                if (isSufficient && !firstGreenDate) {
                    firstGreenDate = dateObj;
                }
            }
            
            if (firstGreenDate) {
                console.log(`[DeliveryDateSelector] First green date found: ${firstGreenDate.formattedDate}`);
            } else {
                console.log(`[DeliveryDateSelector] No green date found in upcoming options.`);
            }

            setDates(calculatedDates);
            
            // Auto-select logic if nothing selected
            if (!selectedDate && firstGreenDate) {
                setSuggestedDate(firstGreenDate);
                onDateSelect(firstGreenDate.date);
            } else if (firstGreenDate) {
                setSuggestedDate(firstGreenDate);
            }

        } catch (error) {
            console.error("Error calc dates:", error);
        } finally {
            setLoading(false);
        }
    };

    calculateDates();
  }, [route, cartItem]); 

  const handleSelect = (dateObj) => {
     onDateSelect(dateObj.date);
  };

  if (!route) return null;

  if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-4 border border-white/10 rounded-lg bg-white/5 mt-2">
            <Loader2 className="animate-spin text-[#FF6B35] w-5 h-5 mb-2" />
            <span className="text-xs text-gray-400">Verificando estoque nas próximas datas...</span>
        </div>
      );
  }

  return (
    <div className={cn("space-y-2 mt-3", className)}>
        <div className="flex items-center justify-between">
            <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Data de Entrega</label>
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-white/10 text-gray-400 gap-1">
                <Clock size={8} /> Corte: {route.corte_ate || '17:00'}
            </Badge>
        </div>
        
        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
            {dates.map((dateObj, idx) => {
                const isSelected = selectedDate && isSameDay(new Date(selectedDate), dateObj.date);
                const isSuggested = suggestedDate && isSameDay(suggestedDate.date, dateObj.date);
                
                // Styling logic
                let containerClass = "bg-white/5 border-white/10 text-gray-400";
                let icon = null;
                
                if (dateObj.isSufficient) {
                     if (isSelected) {
                         containerClass = "bg-[#FF6B35] border-[#FF6B35] text-white shadow-md";
                         icon = <CheckCircle2 size={14} className="text-white" />;
                     } else if (isSuggested) {
                         containerClass = "bg-[#FF6B35]/20 border-[#FF6B35]/50 text-[#FF6B35]";
                         icon = <CheckCircle2 size={14} />;
                     } else {
                         containerClass = "bg-green-900/10 border-green-500/20 text-green-400 hover:bg-green-900/20";
                         icon = <CheckCircle2 size={14} />;
                     }
                } else {
                    containerClass = "bg-red-950/20 border-red-900/30 text-red-500/60 opacity-80";
                    icon = <XCircle size={14} />;
                }

                return (
                    <TooltipProvider key={idx}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleSelect(dateObj)}
                                    className={cn(
                                        "relative flex items-center justify-between p-3 rounded-md border transition-all w-full text-left shrink-0",
                                        containerClass
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold leading-none mb-0.5">
                                                {dateObj.dayName.split('-')[0]}
                                            </span>
                                            <span className="text-sm font-bold">
                                                {dateObj.formattedDate}
                                            </span>
                                        </div>
                                        
                                        {isSuggested && !isSelected && (
                                            <Badge className="bg-[#FF6B35] text-white text-[9px] h-4 px-1.5 hover:bg-[#FF6B35]">
                                                Sugerida
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-medium">
                                                {dateObj.isSufficient ? "Estoque:" : "Disponível:"} 
                                                <strong className="ml-1 text-sm">{dateObj.availableStock}</strong>
                                            </span>
                                            {icon}
                                        </div>
                                    </div>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-gray-900 border-gray-700 text-white text-xs">
                                <p>Estoque disponível nesta data: {dateObj.availableStock}</p>
                                {!dateObj.isSufficient && <p className="text-red-300">Quantidade insuficiente para seu pedido.</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
            
            {dates.length === 0 && (
                <div className="p-3 border border-dashed border-gray-700 rounded text-center text-xs text-gray-500">
                    Nenhuma data de entrega disponível próxima.
                </div>
            )}
        </div>
    </div>
  );
};

export default DeliveryDateSelector;

import React, { useState, useEffect, useMemo } from 'react';
import { format, addDays, getDay, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { schlosserApi } from '@/services/schlosserApi';

const DeliveryDateSelector = ({
  cartItem, // pode ser null (quando carrinho vazio)
  route, // { dias_entrega, corte_ate, descricao_grupo_rota... }
  selectedDate,
  onDateSelect,
  className
}) => {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestedDate, setSuggestedDate] = useState(null);

  // --- Helpers ---
  const safeCutoff = useMemo(() => {
    const raw = (route?.corte_ate || '17:00').toString().trim();
    if (!raw.includes(':')) return '17:00';
    const [h, m] = raw.split(':').map(n => parseInt(n, 10));
    const hh = Number.isFinite(h) ? h : 17;
    const mm = Number.isFinite(m) ? m : 0;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }, [route?.corte_ate]);

  const getValidDeliveryDays = (diasEntregaRaw) => {
    const daysMap = {
      'DOM': 0, 'SEG': 1, 'TER': 2, 'QUA': 3, 'QUI': 4, 'SEX': 5, 'SAB': 6
    };

    const validDayNumbers = [];
    const dayStr = (diasEntregaRaw || '').toUpperCase();

    Object.keys(daysMap).forEach(key => {
      if (dayStr.includes(key)) validDayNumbers.push(daysMap[key]);
    });

    // DIARIO / DIÁRIO: dias úteis
    if (validDayNumbers.length === 0 && (dayStr.includes('DIARIO') || dayStr.includes('DIÁRIO'))) {
      [1, 2, 3, 4, 5].forEach(d => validDayNumbers.push(d));
    }

    return validDayNumbers;
  };

  // Normaliza selectedDate para Date (aceita Date, yyyy-mm-dd, ISO)
  const normalizeSelectedDate = (d) => {
    if (!d) return null;
    if (d instanceof Date && !isNaN(d.getTime())) return d;

    const s = String(d).trim();
    if (!s) return null;

    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseISO(s);

    // ISO com T
    if (s.includes('T')) return parseISO(s);

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
  };

  useEffect(() => {
    let isMounted = true;

    const calculateDates = async () => {
      if (!route) {
        if (isMounted) {
          setDates([]);
          setSuggestedDate(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const today = new Date();
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();

        const [cutoffHour, cutoffMinute] = safeCutoff.split(':').map(Number);
        const isCutoffPassed =
          currentHour > cutoffHour || (currentHour === cutoffHour && currentMinute >= cutoffMinute);

        const validDayNumbers = getValidDeliveryDays(route?.dias_entrega);

        // Se rota não tiver dias, não tem o que exibir
        if (!validDayNumbers || validDayNumbers.length === 0) {
          if (isMounted) {
            setDates([]);
            setSuggestedDate(null);
            setLoading(false);
          }
          return;
        }

        // Pega SKU/QTD se existir item (modo inteligente)
        const quantityNeeded = Number(
          cartItem?.quantidade ?? cartItem?.quantity ?? cartItem?.quantity_unit ?? 1
        );
        const productCode = String(cartItem?.codigo ?? cartItem?.sku ?? '').trim();
        const hasProductContext = Boolean(productCode);

        // Próximas datas possíveis (até 4)
        const potentialDates = [];
        let foundCount = 0;

        for (let i = 0; i < 30; i++) {
          const d = addDays(today, i);
          const dayOfWeek = getDay(d);

          // pula hoje se cutoff já passou
          if (i === 0 && isCutoffPassed) continue;

          if (validDayNumbers.includes(dayOfWeek)) {
            potentialDates.push(d);
            foundCount++;
            if (foundCount >= 4) break;
          }
        }

        const calculatedDates = [];
        let firstGreenDate = null;

        // MODO A: com produto → calcula estoque e pinta
        if (hasProductContext) {
          for (const date of potentialDates) {
            const result = await schlosserApi.calculateAvailableStock(productCode, date);
            const available = Number(result?.availableStock ?? 0);
            const isSufficient = available >= quantityNeeded;

            const dateObj = {
              date,
              dayName: format(date, 'EEEE', { locale: ptBR }),
              formattedDate: format(date, 'dd/MM'),
              fullDateStr: format(date, 'yyyy-MM-dd'),
              availableStock: available,
              isSufficient,
              status: isSufficient ? 'green' : 'red'
            };

            calculatedDates.push(dateObj);

            if (isSufficient && !firstGreenDate) firstGreenDate = dateObj;
          }
        } else {
          // MODO B: sem produto → lista datas neutras, selecionáveis
          for (const date of potentialDates) {
            calculatedDates.push({
              date,
              dayName: format(date, 'EEEE', { locale: ptBR }),
              formattedDate: format(date, 'dd/MM'),
              fullDateStr: format(date, 'yyyy-MM-dd'),
              availableStock: null,
              isSufficient: true, // neutro: não bloqueia seleção
              status: 'neutral'
            });
          }
        }

        if (!isMounted) return;

        setDates(calculatedDates);

        // Auto-sugestão:
        // - com produto: sugere primeira data verde
        // - sem produto: sugere primeira data da lista
        const normalizedSelected = normalizeSelectedDate(selectedDate);

        if (!normalizedSelected) {
          const suggestion = hasProductContext ? firstGreenDate : (calculatedDates[0] || null);
          setSuggestedDate(suggestion);

          // auto seleciona só se tiver sugestão
          if (suggestion?.date) onDateSelect(suggestion.date);
        } else {
          // mantém sugestão informativa
          const suggestion = hasProductContext ? firstGreenDate : (calculatedDates[0] || null);
          setSuggestedDate(suggestion);
        }

      } catch (error) {
        console.error('[DeliveryDateSelector] Error calc dates:', error);
        if (isMounted) {
          setDates([]);
          setSuggestedDate(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    calculateDates();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, cartItem, safeCutoff]);

  const handleSelect = (dateObj) => {
    if (!dateObj?.date) return;
    onDateSelect(dateObj.date);
  };

  if (!route) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-4 border border-white/10 rounded-lg bg-white/5 mt-2">
        <Loader2 className="animate-spin text-[#FF6B35] w-5 h-5 mb-2" />
        <span className="text-xs text-gray-400">Verificando próximas datas...</span>
      </div>
    );
  }

  const normalizedSelected = normalizeSelectedDate(selectedDate);

  return (
    <div className={cn("space-y-2 mt-3", className)}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Data de Entrega</label>
        <Badge variant="outline" className="text-[9px] h-4 px-1 border-white/10 text-gray-400 gap-1">
          <Clock size={8} /> Corte: {safeCutoff}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
        {dates.map((dateObj, idx) => {
          const isSelected = normalizedSelected ? isSameDay(normalizedSelected, dateObj.date) : false;
          const isSuggested = suggestedDate?.date ? isSameDay(suggestedDate.date, dateObj.date) : false;

          const hasStock = typeof dateObj.availableStock === 'number';

          // Styling
          let containerClass = "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10";
          let icon = null;

          if (dateObj.status === 'neutral') {
            // sem produto: neutro
            if (isSelected) {
              containerClass = "bg-[#FF6B35] border-[#FF6B35] text-white shadow-md";
              icon = <CheckCircle2 size={14} className="text-white" />;
            } else if (isSuggested) {
              containerClass = "bg-[#FF6B35]/20 border-[#FF6B35]/50 text-[#FF6B35]";
              icon = <CheckCircle2 size={14} />;
            } else {
              containerClass = "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10";
              icon = <CheckCircle2 size={14} className="text-gray-400" />;
            }
          } else if (dateObj.isSufficient) {
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
                          {String(dateObj.dayName || '').split('-')[0]}
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
                          {hasStock ? (dateObj.isSufficient ? "Estoque:" : "Disponível:") : "Estoque:"}
                          <strong className="ml-1 text-sm">
                            {hasStock ? dateObj.availableStock : '—'}
                          </strong>
                        </span>
                        {icon}
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>

                <TooltipContent side="left" className="bg-gray-900 border-gray-700 text-white text-xs">
                  {typeof dateObj.availableStock === 'number' ? (
                    <>
                      <p>Estoque disponível nesta data: {dateObj.availableStock}</p>
                      {!dateObj.isSufficient && <p className="text-red-300">Quantidade insuficiente para seu pedido.</p>}
                    </>
                  ) : (
                    <p>Selecione a data de entrega para continuar.</p>
                  )}
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

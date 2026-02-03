import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { CalendarClock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const StockSuggestionModal = ({ 
  isOpen, 
  onClose, 
  suggestionData, 
  onAcceptSuggestion 
}) => {
  if (!suggestionData) return null;

  const { product, requestedQty, selectedDate, availableAtDate, nextDate, availableAtNext } = suggestionData;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Data indefinida';
    try {
        const [y, m, d] = dateStr.split('-');
        const date = new Date(y, m - 1, d);
        return format(date, "d 'de' MMMM", { locale: ptBR });
    } catch (e) {
        return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Estoque Insuficiente
          </DialogTitle>
          <DialogDescription>
             Não há estoque suficiente de <strong>{product?.descricao}</strong> para a data selecionada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
           {/* Current Blocked State */}
           <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-red-100 pb-2">
                 <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Solicitado</span>
                 <span className="text-red-700 font-bold">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Qtd. Desejada:</span>
                  <span className="font-bold text-gray-900">{requestedQty} UND</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Disponível:</span>
                  <span className="font-bold text-red-600">{availableAtDate} UND</span>
              </div>
              <div className="mt-1 text-xs text-red-600 italic bg-white/60 p-2 rounded">
                 "Você solicitou {requestedQty}, mas só temos {availableAtDate} disponíveis para esta data."
              </div>
           </div>

           {/* Suggestion State */}
           {nextDate ? (
               <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col gap-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-green-200 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                      RECOMENDADO
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                      <div className="bg-green-100 p-1.5 rounded-full text-green-600">
                          <CalendarClock className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Sugestão Automática</span>
                  </div>
                  
                  <div className="text-sm text-gray-700">
                      Entrega completa disponível em:
                  </div>
                  <div className="text-lg font-bold text-green-700 flex items-center gap-2">
                      {formatDate(nextDate)}
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  
                  <div className="mt-2 text-xs text-green-800 bg-white/60 p-2 rounded flex justify-between">
                     <span>Estoque projetado:</span>
                     <span className="font-bold">{availableAtNext} UND</span>
                  </div>
               </div>
           ) : (
               <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm text-orange-800">
                   <div className="font-bold mb-1 flex items-center gap-2">
                       <AlertCircle className="w-4 h-4" /> Sem previsão
                   </div>
                   Não encontramos nenhuma data futura com estoque suficiente para {requestedQty} unidades. Tente reduzir a quantidade.
               </div>
           )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto text-gray-500 hover:text-gray-700">
            Cancelar
          </Button>
          {nextDate && (
             <Button 
                onClick={() => onAcceptSuggestion(nextDate)} 
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-100 transition-all hover:scale-[1.02]"
             >
                Aceitar sugestão
                <ArrowRight className="w-4 h-4 ml-2" />
             </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StockSuggestionModal;
import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import PrintOrder from './PrintOrder';

const PrintOrderModal = ({ isOpen, onClose, order }) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[210mm] w-full p-0 gap-0 bg-white text-black overflow-hidden h-[90vh] flex flex-col sm:rounded-lg">
        {/* Modal Header - Hide on print */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 print:hidden">
            <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Printer size={20} className="text-gray-600"/> Visualização de Impressão
            </h2>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                    <X className="w-4 h-4 mr-2" /> Fechar
                </Button>
                <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Printer className="w-4 h-4 mr-2" /> Imprimir
                </Button>
            </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4 md:p-8 print:p-0 print:overflow-visible">
             <div id="print-area" className="bg-white shadow-lg mx-auto print:shadow-none print:m-0">
              <PrintOrder order={order} />
            </div>
        </div>
        
        {/* CSS for printing */}
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }
        
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              height: auto !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
        
            /* Esconde tudo e mostra apenas a área de impressão */
            body * {
              visibility: hidden !important;
            }
            #print-area, #print-area * {
              visibility: visible !important;
            }
        
            /* Neutraliza Radix/Shadcn Dialog (fixed + transform) durante impressão */
            [data-radix-portal],
            [role="dialog"] {
              position: static !important;
              inset: auto !important;
              transform: none !important;
              width: auto !important;
              height: auto !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }
        
            /* Garante que nada fique “travado” em 90vh/overflow */
            .overflow-auto {
              overflow: visible !important;
            }
        
            /* Opcional: remove sombras que podem “quebrar” layout no print */
            .shadow-lg {
              box-shadow: none !important;
            }
        
            /* Header do modal não imprime */
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default PrintOrderModal;

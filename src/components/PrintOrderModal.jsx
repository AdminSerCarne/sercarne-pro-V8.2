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
             <div className="bg-white shadow-lg mx-auto print:shadow-none print:m-0">
                 <PrintOrder order={order} />
             </div>
        </div>
        
        {/* CSS for printing */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print\\:hidden {
                display: none !important;
            }
            /* Target the modal content specifically */
            [role="dialog"] {
              visibility: visible;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              background: white;
            }
            [role="dialog"] * {
              visibility: visible;
            }
            /* Hide the scrollbar logic and backgrounds during print */
            .overflow-auto {
                overflow: visible !important;
                background: white !important;
                padding: 0 !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default PrintOrderModal;
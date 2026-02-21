import React, { useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import PrintOrder from './PrintOrder';

const PrintOrderModal = ({ isOpen, onClose, order }) => {
  if (!order) return null;
  const printRef = useRef(null);
  const handlePrint = async () => {
    if (!printRef.current) return;
  
    // Cria um iframe “invisível” só para impressão (evita bugs do modal/portal)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.setAttribute('aria-hidden', 'true');
  
    document.body.appendChild(iframe);
  
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
  
    // Copia todos os <link> e <style> do HEAD (para manter Tailwind/estilos)
    const headHtml = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');
  
    const contentHtml = printRef.current.innerHTML;
  
    doc.open();
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          ${headHtml}
          <style>
            @page { size: A4; margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `);
    doc.close();
  
    // Aguarda CSS + fontes + imagens carregarem antes de imprimir
    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      return;
    }
    
    const waitForImages = () => {
      const imgs = Array.from(win.document.images || []);
      if (imgs.length === 0) return Promise.resolve();
    
      return Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          });
        })
      );
    };
    
    const waitForFonts = async () => {
      try {
        // nem todo navegador suporta, por isso o try
        if (win.document.fonts && win.document.fonts.ready) {
          await win.document.fonts.ready;
        }
      } catch (e) {
        // ignora
      }
    };
    
    // dá tempo para os <link rel="stylesheet"> aplicarem layout
    await new Promise((r) => setTimeout(r, 150));
    await waitForFonts();
    await waitForImages();
    
    // 2 frames para garantir reflow final
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    
    win.focus();
    win.print();
    
    // Remove depois de abrir a impressão
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 800);  
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
                <Button
                  size="sm"
                  onClick={onClose}
                  className="border border-black bg-black text-white hover:bg-gray-700 hover:border-black"
                >
                  <X className="w-4 h-4 mr-2 text-white" /> Fechar
                </Button>
                <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Printer className="w-4 h-4 mr-2" /> Imprimir
                </Button>
            </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4 md:p-8 print:p-0 print:overflow-visible">
             <div
                id="print-area"
                ref={printRef}
                className="bg-white shadow-lg mx-auto print:shadow-none print:m-0"
              >
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
        
            /* Neutraliza Radix/Shadcn Dialog (fixed + transform) durante impressão */
            [role="dialog"] {
              display: block !important;
              position: static !important;
              inset: auto !important;
              transform: none !important;
              width: auto !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
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

            .bg-gray-100 {
              background: #fff !important;
            }
            
            .p-4, .md\:p-8 {
              padding: 0 !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default PrintOrderModal;

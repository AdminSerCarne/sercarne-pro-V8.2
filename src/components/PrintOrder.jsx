
import React, { useMemo } from 'react';
import { Building2, Truck, Calendar, MapPin, User, Weight, DollarSign, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';

/**
 * Updated PrintOrder with specific Schlosser contact info and layout
 */
const PrintOrder = ({ order }) => {
  const { processedItems, totalWeight: computedWeight, totalValue: computedValue } = useMemo(
    () => calculateOrderMetrics(order?.items),
    [order?.items]
  );

  if (!order) return null;

  const LOGO_URL = "https://horizons-cdn.hostinger.com/f5e592ff-4b11-4a06-90fa-42f9bf225481/e979c9ad073c28cd8ccd3102f1dd9c56.jpg";
  const formatMoney = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));
  const formatDate = (date) => date ? format(new Date(date), 'dd/MM/yyyy') : '-';
  const formatDateTime = (date) => date ? format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-';

  return (
    <div className="bg-white text-black p-8 font-sans max-w-[210mm] mx-auto min-h-[297mm] relative flex flex-col">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-black">
        <div className="flex items-center gap-6">
           {/* Logo Image */}
           <div className="h-20 w-32 flex items-center justify-start overflow-hidden">
             <img src={LOGO_URL} alt="Schlosser" className="h-full object-contain object-left" />
           </div>
           <div>
             <h1 className="text-2xl font-bold uppercase tracking-wider font-serif">Schlosser</h1>
             <p className="text-sm font-semibold uppercase tracking-wide text-gray-800">Frigorífico da Carne Gaúcha</p>
             <div className="text-[10px] text-gray-500 mt-1 leading-tight">
               Estrada Municipal RS 342, KM20, nº 101<br/>
               Zona Rural, Horizontina - RS | CEP: 98920-000<br/>
               CISPOA 951 / SISBI Nacional
             </div>
           </div>
        </div>
        <div className="text-right">
          <div className="bg-black text-white px-3 py-1 mb-2 inline-block">
            <p className="font-mono font-bold text-xl">#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <p className="text-xs text-gray-500 uppercase">Data de Emissão</p>
          <p className="font-bold text-sm">{formatDateTime(order.created_at)}</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        
        {/* Client Info */}
        <div className="border border-gray-300 rounded p-4 bg-gray-50">
          <h3 className="text-xs font-bold uppercase border-b border-gray-200 pb-2 mb-3 flex items-center gap-2 text-red-900">
             <Building2 size={14} /> Dados do Cliente
          </h3>
          <p className="font-bold text-lg leading-tight mb-1">{order.client_name}</p>
          <p className="text-sm text-gray-700 font-mono">CNPJ: {order.client_cnpj || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
             <User size={12} /> Representante: {order.vendor_name || order.vendor_id}
          </p>
        </div>

        {/* Logistics */}
        <div className="border border-gray-300 rounded p-4 bg-gray-50">
          <h3 className="text-xs font-bold uppercase border-b border-gray-200 pb-2 mb-3 flex items-center gap-2 text-red-900">
             <Truck size={14} /> Logística e Entrega
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
             <div>
                <p className="text-[10px] uppercase text-gray-500">Data de Entrega</p>
                <p className="font-bold text-sm flex items-center gap-1"><Calendar size={12}/> {formatDate(order.delivery_date)}</p>
             </div>
             <div>
                <p className="text-[10px] uppercase text-gray-500">Horário Corte</p>
                <p className="font-bold text-sm">{order.cutoff || '-'}</p>
             </div>
             <div className="col-span-2 pt-1 border-t border-gray-200 mt-1">
                <p className="text-[10px] uppercase text-gray-500">Rota / Destino</p>
                <p className="font-bold text-sm flex items-center gap-1"><MapPin size={12}/> {order.route_name} - {order.delivery_city}</p>
             </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8 flex-grow">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black bg-gray-100">
              <th className="text-left py-2 px-2 font-bold w-[70px] text-xs uppercase">Cód.</th>
              <th className="text-left py-2 px-2 font-bold text-xs uppercase">Produto</th>
              <th className="text-center py-2 px-2 font-bold w-[70px] text-xs uppercase">Qtd.</th>
              <th className="text-right py-2 px-2 font-bold w-[100px] text-xs uppercase">R$ Unit.</th>
              <th className="text-right py-2 px-2 font-bold w-[100px] text-xs uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {processedItems.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-2 px-2 font-mono text-xs text-gray-600">{item.sku || item.codigo || '-'}</td>
                <td className="py-2 px-2">
                  <span className="font-bold text-sm block text-gray-800">{item.name || item.descricao || '-'}</span>
                  {Number(item.estimatedWeight || 0) > 0 && (
                    <span className="text-[10px] text-gray-500">Peso aprox: {Number(item.estimatedWeight || 0).toFixed(2)}kg</span>
                  )}
                </td>
                <td className="py-2 px-2 text-center">
                    <span className="font-bold text-sm">{Number(item.quantity || 0)}</span>
                    <span className="text-[10px] uppercase ml-1 text-gray-500">{item.unitType || 'UND'}</span>
                </td>
                <td className="py-2 px-2 text-right text-sm">
                  {formatMoney(Number(item.unitPrice || item.pricePerKg || 0))}
                  <span className="text-[10px] text-gray-500 ml-1">/{String(item.priceBasis || 'KG').toLowerCase()}</span>
                </td>
                <td className="py-2 px-2 text-right font-bold text-sm">{formatMoney(Number(item.estimatedValue || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & Obs */}
      <div className="flex gap-6 pt-2 border-t-2 border-black mb-8">
        <div className="flex-1">
           <h3 className="text-xs font-bold uppercase mb-1 text-gray-500">Observações do Pedido</h3>
           <div className="p-3 border border-gray-300 rounded min-h-[60px] text-sm italic bg-gray-50 text-gray-700">
              {order.observations || 'Nenhuma observação registrada.'}
           </div>
        </div>
        <div className="w-[240px] space-y-2 bg-gray-50 p-4 rounded border border-gray-200">
            <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="flex items-center gap-2 text-xs uppercase font-bold text-gray-600"><Weight size={12}/> Peso Total Estimado</span>
                <span className="font-mono font-bold text-sm">{Number(order.total_weight || computedWeight || 0).toFixed(2)} kg</span>
            </div>
            <div className="flex justify-between pt-2 items-center">
                <span className="flex items-center gap-2 font-bold text-sm uppercase"><DollarSign size={14}/> VALOR TOTAL</span>
                <span className="font-bold text-xl">{formatMoney(order.total_value || computedValue || 0)}</span>
            </div>
        </div>
      </div>

      {/* Print Footer - Task 4 */}
      <div className="mt-auto pt-6 border-t-2 border-gray-800">
         <div className="flex justify-between items-end">
            <div className="text-[10px] text-gray-600 space-y-1">
               <p className="font-bold uppercase">Schlosser - Frigorífico da Carne Gaúcha</p>
               <p className="flex items-center gap-2"><MapPin size={10}/> Estrada Municipal RS 342, KM20, nº 101, Zona Rural, Horizontina - RS</p>
               <p className="flex items-center gap-2"><Phone size={10}/> +55 (55) 9-9651-7131 <span className="mx-2">|</span> <Mail size={10}/> contato@frigorificoschlosser.com.br</p>
            </div>
            <div className="text-right">
                <p className="text-[10px] text-gray-400">Documento gerado eletronicamente</p>
                <p className="text-[10px] font-bold text-gray-800 mt-1">CISPOA 951 / SISBI Nacional</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default PrintOrder;

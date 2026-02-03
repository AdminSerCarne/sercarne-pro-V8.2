import React from 'react';
import { Trash2, Plus, Minus, Scale } from 'lucide-react';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';

const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
  const { processedItems } = calculateOrderMetrics([item]);
  const metrics = processedItems?.[0] || {};

  const pricePerKg = Number(metrics.pricePerKg ?? item.price ?? 0);
  const pesoMedio = Number(item.peso ?? item.pesoMedio ?? 0);

  const formatMoney = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 border-b border-gray-100 last:border-0">
      {/* Image */}
      <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200">
        <img
          src={item.imagem || 'https://via.placeholder.com/100?text=Img'}
          alt={item.descricao}
          className="w-full h-full object-contain mix-blend-multiply p-1"
        />
      </div>

      {/* Info */}
      <div className="flex-grow min-w-0 w-full">
        <div className="flex justify-between items-start">
          <div className="pr-4">
            <p className="text-[10px] text-gray-400 font-mono mb-0.5">SKU: {item.codigo}</p>
            <h4 className="font-bold text-gray-800 text-sm sm:text-base line-clamp-2 leading-snug">
              {item.descricao}
            </h4>
          </div>

          <button
            onClick={() => onRemove(item.codigo)}
            className="text-gray-400 hover:text-red-500 p-1 -mt-1 -mr-1 sm:hidden"
            title="Remover"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Details */}
        <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
          <span
            className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100"
            title="Preço por KG"
          >
            <span className="font-medium text-gray-600">{formatMoney(pricePerKg)}</span>
            <span className="text-gray-400 font-bold">/kg</span>
          </span>

          <span
            className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100"
            title="Peso médio unitário"
          >
            <Scale size={10} /> Médio: {pesoMedio.toFixed(3)}kg
          </span>
        </div>

        <div className="mt-1 text-xs font-mono text-gray-400">
          {(Number(metrics.estimatedWeight || 0)).toFixed(2)} kg (Est.) × {formatMoney(pricePerKg)}
        </div>
      </div>

      {/* Quantity Controls & Price */}
      <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
        <div className="flex items-center bg-white rounded-lg border border-gray-200 h-8 w-full sm:w-auto shadow-sm">
          <button
            onClick={() => onUpdateQuantity(item.codigo, item.quantidade - 1)}
            className="px-2 hover:bg-gray-50 rounded-l-lg h-full transition-colors text-gray-600 border-r border-gray-100"
            title="Diminuir"
          >
            <Minus className="w-3 h-3" />
          </button>

          <div className="w-12 text-center h-full flex flex-col justify-center bg-gray-50/50">
            <span className="font-bold text-xs text-gray-800 leading-none">{item.quantidade}</span>
            <span className="text-[8px] text-gray-400 font-bold uppercase leading-none">
              {metrics.unitType || item.unitType || 'UND'}
            </span>
          </div>

          <button
            onClick={() => onUpdateQuantity(item.codigo, item.quantidade + 1)}
            className="px-2 hover:bg-gray-50 rounded-r-lg h-full transition-colors text-gray-600 border-l border-gray-100"
            title="Aumentar"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full justify-between sm:justify-end">
          <div className="flex flex-col items-end">
            <span className="font-bold text-gray-900 text-sm sm:text-base">
              {metrics.formattedValue || formatMoney(metrics.estimatedValue || 0)}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              ~ {metrics.formattedWeight || (Number(metrics.estimatedWeight || 0)).toFixed(2)} kg
            </span>
          </div>

          <button
            onClick={() => onRemove(item.codigo)}
            className="hidden sm:block text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
            title="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartItem;

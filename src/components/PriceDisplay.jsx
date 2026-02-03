import React from 'react';
import { schlosserApi } from '@/services/schlosserApi';

const PriceDisplay = ({ product, role }) => {
  const price = schlosserApi.calculatePrice(product, role);
  // const tableName = schlosserApi.getEffectiveTable(product, role); // Optional display

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);

  return (
    <div className="flex flex-col">
      <span className="text-xl font-bold text-[#FF8C42]">
        {formattedPrice}
      </span>
      {/* Optional: Show table source for transparency 
      <span className="text-xs text-gray-400">
        via {tableName}
      </span>
      */}
    </div>
  );
};

export default PriceDisplay;
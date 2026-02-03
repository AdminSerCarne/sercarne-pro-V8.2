import React from 'react';

const EstoqueDisplay = ({ stockToday, stockFuture, reserved = 0, confirmed = 0 }) => {
  // Calculate available stock
  // Logic: Today + Future - Reserved - Confirmed
  const stockT = parseInt(stockToday) || 0;
  const stockF = parseInt(stockFuture) || 0;
  
  const available = Math.max(0, stockT + stockF - reserved - confirmed);
  
  let colorClass = 'bg-green-100 text-green-800';
  let label = 'Disponível';

  if (available <= 0) {
    colorClass = 'bg-gray-100 text-gray-500';
    label = 'Esgotado';
  } else if (available < 5) {
    colorClass = 'bg-red-100 text-red-800';
    label = 'Crítico';
  } else if (available < 20) {
    colorClass = 'bg-yellow-100 text-yellow-800';
    label = 'Baixo';
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorClass}`}>
        {available} un.
      </span>
      {available <= 0 && <span className="text-xs text-red-500 font-medium">Fora de estoque</span>}
    </div>
  );
};

export default EstoqueDisplay;
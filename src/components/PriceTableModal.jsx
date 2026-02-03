import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validators } from '@/utils/validators';

const PriceTableModal = ({ isOpen, onClose, onSave, client }) => {
  const [selectedTable, setSelectedTable] = useState(client?.tabela_atual?.toString() || '0');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validators.tabela(selectedTable);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    await onSave(parseInt(selectedTable));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-dark)' }}>
            Definir Tabela de Preços
          </h2>
          <button onClick={onClose} className="hover:bg-gray-100 p-1 rounded">
            <X className="w-6 h-6" style={{ color: 'var(--text-light)' }} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm" style={{ color: 'var(--text-light)' }}>
            Cliente: <span className="font-medium" style={{ color: 'var(--text-dark)' }}>{client?.nome}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dark)' }}>
              Tabela de Preços
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-light)' }} />
              <select
                value={selectedTable}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg input-focus text-gray-900"
                style={{ borderColor: error ? 'var(--error)' : 'var(--border-color)' }}
              >
                <option value="0">Tabela 0</option>
                <option value="1">Tabela 1</option>
                <option value="2">Tabela 2</option>
                <option value="3">Tabela 3</option>
                <option value="4">Tabela 4</option>
                <option value="5">Tabela 5</option>
              </select>
            </div>
            {error && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{error}</p>}
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs" style={{ color: 'var(--text-light)' }}>
              Esta tabela determinará os preços que o cliente verá ao fazer pedidos.
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 orange-button">
              Salvar
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PriceTableModal;
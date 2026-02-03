
import { useState, useEffect } from 'react';
import { readSheetData } from '@/services/googleSheetsService';

export const useEntradasEstoque = (codigoProduto) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If no code is provided, we can't fetch specific entries
    if (!codigoProduto) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const fetchEntries = async () => {
      try {
        setLoading(true);
        // Fetch from 'ENTRADAS_ESTOQUE' sheet
        const rows = await readSheetData('ENTRADAS_ESTOQUE');
        
        if (!rows || rows.length < 2) {
          setEntries([]);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Normalize code for comparison
        const targetCode = String(codigoProduto).trim();

        const validEntries = rows.slice(1).map(row => {
          // Expecting Columns: A=Data (0), B=Codigo (1), C=Qtd (2)
          const dateStr = row[0]?.trim();
          const code = row[1]?.toString().trim();
          const qtdStr = row[2]?.toString().replace(/[^\d]/g, ''); // Extract numbers only
          const qtd = parseInt(qtdStr);

          if (!dateStr || !code || isNaN(qtd)) return null;

          // Parse Date (Handling common formats from Sheets)
          let entryDate;
          if (dateStr.includes('/')) {
             // DD/MM/YYYY
             const [d, m, y] = dateStr.split('/').map(Number);
             entryDate = new Date(y, m - 1, d);
          } else if (dateStr.includes('-')) {
             // YYYY-MM-DD
             const [y, m, d] = dateStr.split('-').map(Number);
             entryDate = new Date(y, m - 1, d);
          } else {
             return null;
          }

          if (isNaN(entryDate.getTime())) return null;

          return {
            dateObj: entryDate,
            data: entryDate.toLocaleDateString('pt-BR'), // Returns DD/MM/YYYY
            codigo: code,
            quantidade: qtd
          };
        }).filter(item => {
           // Filter by code and future dates
           return item && 
                  item.codigo === targetCode && 
                  item.dateObj >= today;
        }).sort((a, b) => a.dateObj - b.dateObj);

        // Return simplified structure for UI
        setEntries(validEntries.map(item => ({
          data: item.data, // "DD/MM/YYYY"
          quantidade: item.quantidade
        })));

      } catch (err) {
        console.error('Error fetching future stock entries:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [codigoProduto]);

  return { entries, loading, error };
};

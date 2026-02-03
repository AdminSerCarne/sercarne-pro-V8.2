
import { useState, useEffect, useCallback } from 'react';
import { readSheetData } from '@/services/googleSheetsService';
import { subDays, startOfDay, setHours, setMinutes, setSeconds, isBefore, isSameDay, addDays } from 'date-fns';

const normalizeText = (text) => {
  return text
    ? text.toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
    : "";
};

const DAY_MAP = {
  'domingo': 0, 'dom': 0,
  'segunda': 1, 'seg': 1,
  'terca': 2, 'ter': 2, 'terça': 2,
  'quarta': 3, 'qua': 3,
  'quinta': 4, 'qui': 4,
  'sexta': 5, 'sex': 5,
  'sabado': 6, 'sab': 6, 'sábado': 6
};

export const useRotas = () => {
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRotas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await readSheetData('Rotas Dias De Entrega');
      
      if (!rows || rows.length < 2) {
          console.warn('Rotas sheet empty or not found');
          setRotas([]);
          return;
      }

      const parsedRoutes = rows.slice(1).map((row, index) => {
          const routeName = row[0]?.trim();
          if (!routeName) return null;

          // Parse Days
          const daysStr = normalizeText(row[2]);
          const deliveryDays = [];
          
          Object.entries(DAY_MAP).forEach(([key, val]) => {
              if (daysStr.includes(key)) {
                  if (!deliveryDays.includes(val)) deliveryDays.push(val);
              }
          });
          
          if (deliveryDays.length === 0 && row[2]) {
             const nums = row[2].replace(/\D/g, '').split('');
             nums.forEach(n => {
                 const dayNum = parseInt(n);
                 if (!isNaN(dayNum) && !deliveryDays.includes(dayNum)) deliveryDays.push(dayNum);
             });
          }

          return {
              id: `route-${index}`, 
              routeName: routeName,
              city: row[1]?.trim(),
              deliveryDays: deliveryDays.sort(),
              cutoffTime: row[3]?.trim() || '17:00', // Default Cutoff
              sysmoGroup: row[4]?.trim(),
              ibgeCode: row[5]?.trim(),
              normalizedCity: normalizeText(row[1])
          };
      }).filter(Boolean);

      setRotas(parsedRoutes);
    } catch (err) {
      console.error("Error loading routes", err);
      setError("Erro ao carregar rotas de entrega.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
      fetchRotas();
  }, [fetchRotas]);

  /**
   * Validates if a delivery date is valid based on cutoff rules.
   * Rule: To deliver on day X, order must be placed before (X-1) at CutoffTime.
   */
  const isDateValidForRoute = (deliveryDate, cutoffTimeStr = '17:00') => {
      if (!deliveryDate) return false;
      
      const [cutoffHour, cutoffMinute] = cutoffTimeStr.split(':').map(Number);
      
      // Calculate Deadline: Day X-1 at Cutoff Time
      // We use startOfDay to ensure we are working from the beginning of the delivery date
      let deadline = subDays(startOfDay(deliveryDate), 1);
      
      // Set the cutoff time on the deadline day
      deadline = setHours(deadline, !isNaN(cutoffHour) ? cutoffHour : 17);
      deadline = setMinutes(deadline, !isNaN(cutoffMinute) ? cutoffMinute : 0);
      deadline = setSeconds(deadline, 0);

      const now = new Date();
      
      // If strictly before deadline, it's valid.
      // If now >= deadline, this delivery date is missed.
      return isBefore(now, deadline);
  };

  /**
   * Finds the best matching route for a client
   */
  const getRouteForClient = (client) => {
      if (!client || !rotas.length) return null;

      const clientCity = normalizeText(client.municipio || client.cidade || client.city || client.cidade_id);
      
      if (clientCity) {
        const cityMatch = rotas.find(r => r.normalizedCity === clientCity);
        if (cityMatch) return cityMatch;
      }

      const sysmoValue = client.grupo_sysmo || client.sysmo || client.sysmoGroup;
      if (sysmoValue) {
           const sysmoStr = String(sysmoValue).trim();
           const sysmoMatch = rotas.find(r => r.sysmoGroup === sysmoStr);
           if (sysmoMatch) return sysmoMatch;
      }
      
      return null;
  };

  return {
      rotas,
      loading,
      error,
      refetch: fetchRotas,
      getRouteForClient,
      isDateValidForRoute
  };
};

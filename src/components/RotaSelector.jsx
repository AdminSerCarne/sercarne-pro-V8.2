
import React, { useState, useEffect } from 'react';
import { schlosserApi } from '@/services/schlosserApi';
import { normalizeCity } from '@/utils/normalizeCity';
import { Truck, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

const RotaSelector = ({ city, onRouteSelect, selectedRoute, className }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchRoutes = async () => {
      if (!city) {
          setRoutes([]);
          return;
      }
      
      setLoading(true);
      setError('');
      
      try {
        const allRoutes = await schlosserApi.getRoutes();
        const normalizedCity = normalizeCity(city);
        
        const matchedRoutes = allRoutes.filter(r => 
          r.municipio && normalizeCity(r.municipio) === normalizedCity
        );

        if (isMounted) {
            setRoutes(matchedRoutes);
            // Auto-select if only one route found and none currently selected (or different one)
            if (matchedRoutes.length > 0) {
                 const currentSelectedId = selectedRoute?.descricao_grupo_rota;
                 const firstMatchId = matchedRoutes[0].descricao_grupo_rota;
                 
                 // If only 1 match, select it. If multiple, user must pick (or we pick first).
                 // Default to first for now as multi-route cities are rare/edge case.
                 if (matchedRoutes.length === 1 && currentSelectedId !== firstMatchId) {
                     onRouteSelect(matchedRoutes[0]);
                 }
                 // If we have matches but nothing selected, select first
                 else if (!selectedRoute) {
                     onRouteSelect(matchedRoutes[0]);
                 }
            } else {
                setError(`Nenhuma rota encontrada para ${city}`);
                onRouteSelect(null);
            }
        }
      } catch (err) {
        console.error("Error fetching routes:", err);
        if (isMounted) setError("Erro ao carregar rotas.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRoutes();
    
    return () => { isMounted = false; };
  }, [city]);

  if (!city) return null;

  if (loading) {
      return (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
              <Loader2 className="animate-spin h-3 w-3" />
              <span>Verificando rotas...</span>
          </div>
      );
  }

  if (error || routes.length === 0) {
      return (
        <div className="flex items-start gap-2 p-3 bg-red-900/10 border border-red-500/20 rounded-md text-red-200 mt-2">
           <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
           <p className="text-xs">{error || "Rota não disponível para esta cidade."}</p>
        </div>
      );
  }

  // If only one route, we just show it as informational (it was auto-selected)
  // If multiple, we could show a selector. For now, assume single route per city dominates.
  const activeRoute = selectedRoute || routes[0];

  return (
    <div className={cn("space-y-1 mt-2", className)}>
        <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Rota de Entrega</label>
        <div className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-white/20 rounded-md text-white">
             <div className="flex items-center gap-3">
                 <div className="bg-[#FF6B35]/20 p-1.5 rounded text-[#FF6B35]">
                     <Truck size={16} />
                 </div>
                 <div className="flex flex-col">
                     <span className="font-bold text-sm leading-tight">{activeRoute.descricao_grupo_rota}</span>
                     <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <MapPin size={10} /> {activeRoute.municipio}
                     </span>
                 </div>
             </div>
        </div>
    </div>
  );
};

export default RotaSelector;

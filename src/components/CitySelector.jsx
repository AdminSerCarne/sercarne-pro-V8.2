
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Loader2, CalendarClock } from 'lucide-react';
import { schlosserApi } from '@/services/schlosserApi';

const CitySelector = ({ selectedCity, onSelectCity, disabled }) => {
  const [cities, setCities] = useState([]);
  const [routesMap, setRoutesMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch routes to determine available cities and route info
        const routes = await schlosserApi.getRoutes();
        
        if (isMounted) {
            if (routes && routes.length > 0) {
               const rMap = {};
               const cityList = [];
               
               routes.forEach(r => {
                   if (r.municipio) {
                       if (!rMap[r.municipio]) {
                           cityList.push(r.municipio);
                           rMap[r.municipio] = r;
                       }
                   }
               });
               
               setRoutesMap(rMap);
               setCities(cityList.sort((a,b) => a.localeCompare(b)));
            } else {
                // Fallback to getCities if no routes found (legacy support)
                const c = await schlosserApi.getCities();
                setCities(c.map(x => x.nome));
            }
        }
      } catch (err) {
        console.error("Failed to load cities/routes", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  const getRouteInfo = (cityName) => {
      const route = routesMap[cityName];
      if (!route) return null;
      // Helper to shorten route names if needed
      return `${route.dias_entrega || 'Sob consulta'} (Até ${route.corte_ate})`;
  };

  return (
    <div className="space-y-1">
        <label className="text-xs text-gray-400 font-bold uppercase ml-1">Cidade de Entrega</label>
        <Select 
            value={selectedCity} 
            onValueChange={onSelectCity}
            disabled={disabled || loading}
        >
            <SelectTrigger className="w-full bg-[#1a1a1a] border-white/20 text-white h-10">
                <div className="flex items-center gap-2 overflow-hidden">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0"/> : <MapPin className="h-4 w-4 text-[#FF6B35] shrink-0" />}
                    <SelectValue placeholder="Selecione sua cidade" />
                </div>
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/20 text-white max-h-[250px]">
                {cities.length > 0 ? (
                    cities.map((city) => {
                        const routeInfo = getRouteInfo(city);
                        return (
                            <SelectItem key={city} value={city} className="focus:bg-[#FF6B35]/20 focus:text-white cursor-pointer py-2">
                                <div className="flex flex-col text-left">
                                    <span className="font-medium">{city}</span>
                                    {routeInfo && (
                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                            <CalendarClock size={10} /> {routeInfo}
                                        </span>
                                    )}
                                </div>
                            </SelectItem>
                        );
                    })
                ) : (
                    !loading && (
                        <div className="p-2 text-xs text-gray-500 text-center">Nenhuma cidade disponível</div>
                    )
                )}
            </SelectContent>
        </Select>
    </div>
  );
};

export default CitySelector;

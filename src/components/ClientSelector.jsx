
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, Check, X, Store, Building, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { schlosserApi } from '@/services/schlosserApi';
import { cn } from "@/lib/utils";

const ClientSelector = ({ selectedClient, onSelect, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Pre-load clients when component mounts to ensure data is ready when user clicks
    loadClients();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  const loadClients = async () => {
    if (clients.length > 0) return; // Already loaded
    setLoading(true);
    try {
      const data = await schlosserApi.getClients();
      setClients(data || []);
    } catch (e) {
      console.error("Error loading clients", e);
    } finally {
      setLoading(false);
    }
  };

  const formatCpfCnpj = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
  
    if (digits.length === 11) {
      return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
  
    if (digits.length === 14) {
      return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
  
    return value || '';
  };
  // Helpers para normalizar texto (remove acentos) e documento (só dígitos)
  const normalizeText = (v) =>
    String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  
  const getClientName = (c) =>
    c?.nomeFantasia ||
    c?.nome_fantasia ||
    c?.nome ||
    c?.cliente ||
    '';
  
  const getClientRazao = (c) =>
    c?.razaoSocial ||
    c?.razao_social ||
    '';
  
  const getClientCity = (c) =>
    c?.municipio ||
    c?.cidade ||
    c?.city ||
    '';
  
  const getClientDoc = (c) => {
    const raw =
      c?.cnpj ||
      c?.cpf ||
      c?.['cnpj/cpf'] ||
      c?.['CNPJ/CPF'] ||
      c?.cnpj_cpf ||
      c?.documento ||
      c?.razaoSocial || ''; // (no seu caso, às vezes o doc vem aqui)
    return String(raw).replace(/\D/g, '');
  };
  
  const filteredClients = clients
    .filter((client) => {
      const q = normalizeText(searchTerm);
  
      // se não digitou nada, mostra a lista (limitada)
      if (!q) return true;
  
      const name = normalizeText(getClientName(client));
      const razao = normalizeText(getClientRazao(client));
      const city = normalizeText(getClientCity(client));
  
      const docDigits = getClientDoc(client);
      const qDigits = q.replace(/\D/g, ''); // se o usuário digitou números
  
      const matchName = name.includes(q);
      const matchRazao = razao.includes(q);
      const matchCity = city.includes(q);
      const matchDoc = qDigits ? docDigits.includes(qDigits) : false;
  
      return matchName || matchRazao || matchCity || matchDoc;
    })
    .slice(0, 50);

  const handleClientSelect = (client) => {
      onSelect(client);
      setIsOpen(false);
      setSearchTerm("");
  };

  const handleClearClient = (e) => {
      e.stopPropagation();
      onSelect(null);
  };

  // Helper to safely get city for display
  const getCity = (c) => c.municipio || c.cidade || c.city || "";

  return (
    <div ref={containerRef} className={cn("w-full relative", className)}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
            "w-full justify-between h-auto min-h-[50px] py-2 px-3 bg-white border-2 hover:bg-orange-50/30 transition-all relative z-10",
            selectedClient ? "border-green-200" : "border-dashed border-orange-200"
        )}
      >
        {selectedClient ? (
           <div className="flex items-start gap-3 w-full overflow-hidden text-left">
              <div className="bg-green-100 p-2 rounded-md text-green-700 shrink-0">
                  <Store size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                  <span className="font-bold text-gray-800 truncate text-sm">{selectedClient.nomeFantasia || selectedClient.razaoSocial}</span>
                  <span className="text-[11px] text-gray-500 flex items-center gap-2">
                     <span>{selectedClient.cnpj}</span>
                     {getCity(selectedClient) && (
                         <>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span className="flex items-center gap-1">
                                <MapPin size={10} /> {getCity(selectedClient)}
                            </span>
                         </>
                     )}
                  </span>
              </div>
           </div>
        ) : (
          <div className="flex items-center text-gray-400 w-full py-1">
              <div className="bg-gray-100 p-2 rounded-md mr-3 text-gray-400">
                 <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                  <span className="font-medium text-gray-600 text-sm">Selecionar Cliente</span>
                  <span className="text-[10px] text-gray-400">Busque por nome, CNPJ ou cidade</span>
              </div>
          </div>
        )}
        <Search className="ml-2 h-4 w-4 shrink-0 opacity-30 text-gray-500" />
      </Button>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 z-[50] shadow-2xl border border-gray-700 bg-[#1a1a1a] text-gray-100 rounded-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center border-b border-gray-700 px-3 py-2 bg-[#1a1a1a]">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500 h-8 w-full border-none focus:ring-0"
              placeholder="Digite nome, CNPJ ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-orange-500 ml-2" />}
          </div>
          
          <div className="max-h-[300px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
             {filteredClients.length === 0 && !loading && (
                 <div className="py-8 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                     <Building className="w-8 h-8 opacity-20" />
                     <p>Nenhum cliente encontrado.</p>
                 </div>
             )}
             console.log('searchTerm=', searchTerm, 'filtered=', filteredClients.length, 'total=', clients.length);
             {filteredClients.map((client) => (
                <div
                  key={`${client.cnpj}-${client.id || Math.random()}`}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none transition-colors mb-1 last:mb-0 group",
                    selectedClient?.cnpj === client.cnpj 
                        ? "bg-orange-900/40 text-orange-100 border border-orange-800/50" 
                        : "hover:bg-[#2a2a2a] hover:text-orange-400 text-gray-300 border border-transparent"
                  )}
                  onClick={() => handleClientSelect(client)}
                >
                  <div className="flex flex-col w-full gap-0.5">
                      <span className="font-semibold truncate text-sm group-hover:text-[#FF8C42] transition-colors duration-200">
                        {client.nomeFantasia || client.razaoSocial}
                      </span>
                      <div className="flex justify-between text-[11px] text-gray-500 items-center">
                          {(() => {
                            const doc = getClientDoc(client);
                            const formatted = formatCpfCnpj(doc);
                            const label = doc.length === 11 ? 'CPF' : 'CNPJ';
                          
                            return (
                              <span className="font-mono opacity-80">
                                {formatted ? `${label}: ${formatted}` : '—'}
                              </span>
                            );
                          })()}
                          {getCity(client) && (
                              <span className={cn(
                                  "px-1.5 rounded text-[10px] font-bold border flex items-center gap-1",
                                  selectedClient?.cnpj === client.cnpj 
                                    ? "bg-orange-900/60 text-orange-200 border-orange-800"
                                    : "bg-gray-800 text-gray-400 border-gray-700 group-hover:border-orange-500/30"
                              )}>
                                  <MapPin size={8} />
                                  {getCity(client)}
                              </span>
                          )}
                      </div>
                  </div>
                  {selectedClient?.cnpj === client.cnpj && (
                     <Check className="ml-2 h-4 w-4 text-orange-500 shrink-0" />
                  )}
                </div>
             ))}
          </div>
        </div>
      )}
      
      {selectedClient && (
          <div className="mt-1 flex justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearClient}
                className="text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 h-5 px-2 font-medium"
              >
                  <X className="w-3 h-3 mr-1" /> Remover cliente
              </Button>
          </div>
      )}
    </div>
  );
};

export default ClientSelector;

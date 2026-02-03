
import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

const FilterBar = ({ brands = [], species = [], packagingTypes = [], selectedFilters, onFilterChange }) => {
  // Skeleton component for future integration
  // Currently just renders the structure based on props
  
  return (
    <div className="w-full space-y-4 bg-[#121212] p-4 rounded-lg border border-white/10">
      <h3 className="font-serif font-bold text-white mb-2">Filtros</h3>
      
      <Accordion type="multiple" defaultValue={["marca", "especie"]} className="w-full">
        
        {/* Brand Filter */}
        <AccordionItem value="marca" className="border-white/10">
          <AccordionTrigger className="text-gray-200 hover:text-white hover:no-underline">Marca</AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-40 w-full pr-4">
              <div className="space-y-2">
                {brands.map((brand) => (
                  <div key={brand} className="flex items-center space-x-2">
                    <Checkbox id={`brand-${brand}`} />
                    <Label htmlFor={`brand-${brand}`} className="text-sm text-gray-400 font-normal cursor-pointer hover:text-white">
                      {brand || 'Sem Marca'}
                    </Label>
                  </div>
                ))}
                {brands.length === 0 && <p className="text-xs text-gray-500">Nenhuma marca disponível</p>}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        {/* Species Filter */}
        <AccordionItem value="especie" className="border-white/10">
          <AccordionTrigger className="text-gray-200 hover:text-white hover:no-underline">Espécie</AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-40 w-full pr-4">
              <div className="space-y-2">
                {species.map((specie) => (
                  <div key={specie} className="flex items-center space-x-2">
                    <Checkbox id={`specie-${specie}`} />
                    <Label htmlFor={`specie-${specie}`} className="text-sm text-gray-400 font-normal cursor-pointer hover:text-white">
                      {specie || 'Outros'}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
        
        {/* Packaging Filter */}
        <AccordionItem value="embalagem" className="border-white/10 border-b-0">
          <AccordionTrigger className="text-gray-200 hover:text-white hover:no-underline">Embalagem</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
                {packagingTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox id={`pack-${type}`} />
                    <Label htmlFor={`pack-${type}`} className="text-sm text-gray-400 font-normal cursor-pointer hover:text-white">
                      {type}
                    </Label>
                  </div>
                ))}
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
};

export default FilterBar;

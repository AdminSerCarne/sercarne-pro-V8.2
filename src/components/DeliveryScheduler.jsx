import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar'; // Assuming this exists or we use standard input
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addHours, isAfter, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DeliveryScheduler = ({ isOpen, onClose, onConfirm }) => {
  const [date, setDate] = useState(null);
  const [timeSlot, setTimeSlot] = useState('');
  
  const minDate = addHours(new Date(), 2);

  const handleConfirm = () => {
    if (date && timeSlot) {
      onConfirm({ date, timeSlot });
      onClose();
    }
  };

  // Simplified logic for valid dates (e.g., allow starting tomorrow for safety or 2h from now)
  const isDateDisabled = (day) => {
    return day < new Date().setHours(0,0,0,0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Entrega</DialogTitle>
          <DialogDescription>Selecione a data e o período preferencial.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Data de Entrega</label>
            <input 
              type="date" 
              className="w-full p-2 border rounded-md"
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Período</label>
            <Select onValueChange={setTimeSlot}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um horário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="08:00-12:00">Manhã (08:00 - 12:00)</SelectItem>
                <SelectItem value="14:00-18:00">Tarde (14:00 - 18:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!date || !timeSlot} className="bg-[#FF8C42] text-white">
            Confirmar Agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryScheduler;
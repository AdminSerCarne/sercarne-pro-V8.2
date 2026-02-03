
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';

const WhatsAppShare = ({ order, variant = "ghost", size = "sm", className, label }) => {
  if (!order) return null;

  const handleShare = () => {
    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (date) => date ? format(new Date(date), 'dd/MM/yyyy') : 'N/A';

    // Recalculate metrics to ensure accuracy and correct formatting
    // If order.items exists, we process them.
    const { processedItems, totalWeight, totalValue } = calculateOrderMetrics(order.items || []);

    const itemsListText = processedItems.map(item => {
      // Format: "• PRODUCT NAME\n  Qtd: X UNIT | Peso Médio/Peça: Xkg | Peso Estimado: Xkg | Preço: R$ X/kg | Subtotal: R$ X"
      return `• ${item.name.toUpperCase()}\n  Qtd: ${item.quantity} ${item.unitType} | Peso Médio: ${item.averageWeight.toFixed(3)}kg | Peso Est.: ${item.estimatedWeight.toFixed(2)}kg | Preço: ${formatMoney(item.pricePerKg)}/kg | Subtotal: ${formatMoney(item.estimatedValue)}`;
    }).join('\n\n');

    // Construct the message with symbols instead of emojis
    const lines = [
      `◆ PEDIDO SCHLOSSER`,
      `• Pedido: #${(order.id || 'NOVO').slice(0, 8).toUpperCase()}`,
      `--------------------------------`,
      `◆ DADOS DO CLIENTE`,
      `• Cliente: ${order.client_name || order.client?.nomeFantasia || 'N/A'}`,
      `• CNPJ: ${order.client_cnpj || order.client?.cnpj || 'N/A'}`,
      `• Entrega: ${formatDate(order.delivery_date)}`,
      `• Rota: ${order.route_name || 'Rota Padrao'}`,
      `• Corte: ${order.cutoff || '17:30h'}`,
      `--------------------------------`,
      `◆ ITENS`,
      itemsListText,
      `--------------------------------`,
      `◆ RESUMO`,
      `• Total Itens: ${processedItems.length}`,
      `• Peso Total Est.: ${totalWeight.toFixed(2)} kg`,
      `• Valor Total Est.: ${formatMoney(totalValue)}`,
      `--------------------------------`,
      `*Peso e valor aproximados. Valores finais na NF.`,
      `◆ Status: ${order.status || 'PENDENTE'}`
    ];

    const message = lines.join('\n');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleShare}
      className={className || "h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"}
      title="Compartilhar no WhatsApp"
    >
      <MessageCircle size={18} className={label ? "mr-2" : ""} />
      {label && label}
    </Button>
  );
};

export default WhatsAppShare;

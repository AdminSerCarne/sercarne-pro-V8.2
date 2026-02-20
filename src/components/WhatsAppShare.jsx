// src/components/WhatsAppShare.jsx
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { ORDER_STATUS, normalizeOrderStatus } from '@/domain/orderStatus';
import { normalizeUnitType } from '@/domain/unitType';

const WhatsAppShare = ({ order, variant = "ghost", size = "sm", className, label }) => {
  if (!order) return null;
  const PLATFORM_URL = 'https://sercarne.com';

  const handleShare = () => {
    const formatMoney = (val) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));

    const formatDate = (date) => {
      if (!date) return 'N/A';

      // Evita bug de timezone (ex.: "2026-02-18" virar dia anterior)
      // Preferimos parseISO quando vier string ISO.
      if (typeof date === 'string') {
        try {
          const d = parseISO(date);
          if (isValid(d)) return format(d, 'dd/MM/yyyy', { locale: ptBR });
        } catch (_) {
          // fallback abaixo
        }
      }

      const d2 = new Date(date);
      return isValid(d2) ? format(d2, 'dd/MM/yyyy', { locale: ptBR }) : 'N/A';
    };

    // ---- 1) Parse seguro do order.items (pode vir array, pode vir string JSON) ----
    const parseItemsSafe = (raw) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;

      // Vem do Supabase como string: "[{\"sku\":\"400010\",...}]"
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('WhatsAppShare: failed to JSON.parse(order.items)', e);
          return [];
        }
      }

      // Qualquer outro formato inesperado
      return [];
    };

    const n = (v) => {
      // aceita number e string "25,38"
      if (v === undefined || v === null || v === '') return 0;
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      if (typeof v === 'string') {
        const normalized = v.replace(/\./g, '').replace(',', '.'); // pt-BR safe-ish
        const num = Number(normalized);
        return Number.isFinite(num) ? num : 0;
      }
      const num = Number(v);
      return Number.isFinite(num) ? num : 0;
    };

    const pick = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');

    // ---- 2) Normaliza campos (porque o item pode vir com pesoMedio / averageWeight / etc) ----
    const normalizeItemsForMetrics = (items) => {
      return items.map((it) => {
        const quantity = n(pick(it.quantity, it.quantidade, it.quantity_unit, 0)) || 0;
        const unitType = normalizeUnitType(pick(it.unitType, it.unit_type, 'UND'));

        const averageWeight = n(pick(it.averageWeight, it.pesoMedio, it.estimatedWeight, it.total_weight, 0));
        const pricePerKg = n(pick(it.pricePerKg, it.price_per_kg, 0));
        const priceBasis = String(pick(it.priceBasis, it.price_basis, unitType === 'PCT' ? 'PCT' : 'KG')).toUpperCase();

        // Alguns fluxos salvam "name" ou "descricao"
        const name = pick(it.name, it.descricao, 'ITEM');

        const fallbackWeight = averageWeight * (quantity || 1);
        const fallbackValue = priceBasis === 'PCT'
          ? pricePerKg * (quantity || 1)
          : averageWeight * pricePerKg * (quantity || 1);

        // Mantém o máximo de compatibilidade com calculateOrderMetrics
        return {
          ...it,
          name,
          quantity,
          unitType,
          averageWeight,
          pricePerKg,
          priceBasis,

          // campos opcionais, se existirem
          estimatedWeight: n(pick(it.estimatedWeight, it.total_weight, it.quantity_kg, fallbackWeight)),
          estimatedValue: n(pick(it.estimatedValue, it.total_value, it.total, fallbackValue)),
        };
      });
    };

    const rawItems = parseItemsSafe(order.items);
    const normalizedItems = normalizeItemsForMetrics(rawItems);
    const statusText = normalizeOrderStatus(order.status || ORDER_STATUS.ENVIADO);

    // ---- 3) Recalcula métricas com itens já OK ----
    const { processedItems, totalWeight, totalValue } = calculateOrderMetrics(normalizedItems);

    const itemsListText = processedItems.map(item => {
      const qty = n(item.quantity);
      const unit = item.unitType || 'UND';
      const avgW = n(item.averageWeight);
      const estW = n(item.estimatedWeight);
      const pKg = n(item.pricePerKg);
      const basis = String(item.priceBasis || (normalizeUnitType(unit, 'UND') === 'PCT' ? 'PCT' : 'KG')).toUpperCase();
      const sub = n(item.estimatedValue);

      return `* ${String(item.name || 'ITEM').toUpperCase()}
  Qtd: ${qty} ${unit} | Peso Médio: ${avgW.toFixed(3)}kg | Peso Est.: ${estW.toFixed(2)}kg | Preço: ${formatMoney(pKg)}/${basis.toLowerCase()} | Subtotal: ${formatMoney(sub)}`;
    }).join('\n\n');

    // Vendedor (só mostra se existir)
    const vendorLine =
      (order.vendor_name || order.vendor_id)
        ? `• Vendedor: ${order.vendor_name || ''}${order.vendor_name && order.vendor_id ? ' - ' : ''}${order.vendor_id || ''}`.trim()
        : null;

    const lines = [
      `Olá! Obrigado pela preferência na Schlosser.`,
      `Segue o resumo comercial do seu pedido:`,
      ``,
      `◆ PEDIDO SCHLOSSER`,
      `* Pedido: #${(order.id || 'NOVO').slice(0, 8).toUpperCase()}`,
      `--------------------------------`,
      `◆ DADOS DO CLIENTE`,
      `* Cliente: ${order.client_name || order.client?.nomeFantasia || 'N/A'}`,
      `* CNPJ: ${order.client_cnpj || order.client?.cnpj || 'N/A'}`,
      ...(vendorLine ? [vendorLine] : []),
      `* Entrega: ${formatDate(order.delivery_date)}`,
      `* Rota: ${order.route_name || 'Rota Padrão'}`,
      `* Corte: ${order.cutoff || '17:30h'}`,
      `--------------------------------`,
      `◆ ITENS`,
      itemsListText || '* (sem itens)',
      `--------------------------------`,
      `◆ RESUMO`,
      `* Total Itens: ${processedItems.length}`,
      `* Peso Total Est.: ${n(totalWeight).toFixed(2)} kg`,
      `* Valor Total Est.: ${formatMoney(totalValue)}`,
      `--------------------------------`,
      `*Peso e valor aproximados. Valores finais na NF.`,
      `◆ Status: ${statusText}`,
      ``,
      `Estamos à disposição para ajustes e novos pedidos.`,
      `Acesse a plataforma oficial: ${PLATFORM_URL}`
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

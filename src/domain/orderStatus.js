export const ORDER_STATUS = Object.freeze({
  ENVIADO: 'PEDIDO ENVIADO',
  CONFIRMADO: 'PEDIDO CONFIRMADO',
  SAIU_PARA_ENTREGA: 'SEU PEDIDO SAIU PARA ENTREGA',
  ENTREGUE: 'PEDIDO ENTREGUE',
  CANCELADO: 'CANCELADO',
});

const LEGACY_TO_OFFICIAL = Object.freeze({
  PENDENTE: ORDER_STATUS.ENVIADO,
  ENVIADO: ORDER_STATUS.ENVIADO,
  CONFIRMADO: ORDER_STATUS.CONFIRMADO,
  'EM ROTA': ORDER_STATUS.SAIU_PARA_ENTREGA,
  'SAIU PARA ENTREGA': ORDER_STATUS.SAIU_PARA_ENTREGA,
});

export const normalizeOrderStatus = (status) => {
  const raw = String(status || '').trim().toUpperCase();
  if (!raw) return ORDER_STATUS.ENVIADO;
  return LEGACY_TO_OFFICIAL[raw] || raw;
};

export const isCommittedStatus = (status) => {
  const normalized = normalizeOrderStatus(status);
  return (
    normalized === ORDER_STATUS.ENVIADO ||
    normalized === ORDER_STATUS.CONFIRMADO ||
    normalized === ORDER_STATUS.SAIU_PARA_ENTREGA
  );
};


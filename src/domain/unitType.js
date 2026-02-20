const UNIT_ALIASES = Object.freeze({
  UND: 'UND',
  UN: 'UND',
  UNID: 'UND',
  UNIDADE: 'UND',
  CX: 'CX',
  CAIXA: 'CX',
  CAIXAS: 'CX',
  PCT: 'PCT',
  PACOTE: 'PCT',
  PACOTES: 'PCT',
  KG: 'KG',
  KGS: 'KG',
  KILO: 'KG',
  KILOGRAMA: 'KG',
  KILOGRAMAS: 'KG',
});

// Exceções operacionais aprovadas (enquanto coluna AC não vier padronizada em 100% dos itens)
const UNIT_CODE_OVERRIDES = Object.freeze({
  '497320': 'PCT',
});

export const normalizeUnitType = (value, fallback = 'UND') => {
  const normalizedFallback = String(fallback || 'UND').trim().toUpperCase() || 'UND';
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  if (!raw) return normalizedFallback;
  return UNIT_ALIASES[raw] || raw;
};

const detectByDescription = (description) => {
  const text = String(description || '').toUpperCase();
  if (!text) return '';
  if (text.includes('PCT') || text.includes('PACOTE')) return 'PCT';
  if (text.includes('CX') || text.includes('CAIXA')) return 'CX';
  if (text.includes(' KG')) return 'KG';
  return '';
};

export const resolveProductUnitType = (product, fallback = 'UND') => {
  const code = String(product?.codigo ?? product?.sku ?? '').trim();
  const override = UNIT_CODE_OVERRIDES[code];
  if (override) return override;

  const explicitRaw =
    product?.unitType ??
    product?.tipoVenda ??
    product?.unidade_estoque ??
    product?.unit_type ??
    product?.unidade ??
    product?.unit;

  const explicitRawStr = String(explicitRaw ?? '').trim();
  const explicitNormalized = explicitRawStr ? normalizeUnitType(explicitRawStr, fallback) : '';

  const byDescription = detectByDescription(
    [product?.descricao, product?.descricao_complementar, product?.name, product?.nome]
      .filter(Boolean)
      .join(' ')
  );

  if (byDescription && (!explicitNormalized || explicitNormalized === 'UND')) {
    return byDescription;
  }

  if (explicitNormalized) return explicitNormalized;

  const numericCode = Number(code);
  if (!Number.isNaN(numericCode) && numericCode >= 410000) return 'CX';

  return normalizeUnitType(fallback, 'UND');
};

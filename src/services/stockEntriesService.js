import { supabase } from '@/lib/customSupabaseClient';

const SYNC_ENDPOINT_KEYS = Object.freeze([
  'VITE_STOCK_ENTRY_SYNC_ENDPOINT',
  'VITE_STOCK_ENTRY_SYNC_WEBHOOK',
  'VITE_ENTRADAS_ESTOQUE_SYNC_ENDPOINT',
  'VITE_ENTRADAS_ESTOQUE_WEBHOOK',
]);

const resolveSyncEndpoint = () => {
  for (const key of SYNC_ENDPOINT_KEYS) {
    const value = String(import.meta.env?.[key] || '').trim();
    if (value) return value;
  }
  return '';
};

const normalizeIsoDate = (value) => {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return '';
};

const normalizeEntryPayload = (entryLike) => {
  const entry = entryLike && typeof entryLike === 'object' ? entryLike : {};
  const data_entrada = normalizeIsoDate(entry.data_entrada);
  const codigo = String(entry.codigo || '').trim();
  const qtdNum = Number(entry.qtd_und);
  const qtd_und = Number.isFinite(qtdNum) ? Math.round(qtdNum) : 0;
  const obs = String(entry.obs || '').trim();

  return { data_entrada, codigo, qtd_und, obs };
};

export const stockEntriesService = {
  getSyncEndpoint() {
    return resolveSyncEndpoint();
  },

  hasSyncEndpoint() {
    return Boolean(resolveSyncEndpoint());
  },

  async createViaSheetSync(entryLike) {
    const endpoint = resolveSyncEndpoint();
    if (!endpoint) {
      throw new Error(
        'Endpoint do Apps Script não configurado. Defina VITE_STOCK_ENTRY_SYNC_ENDPOINT na Vercel.'
      );
    }

    const entry = normalizeEntryPayload(entryLike);
    if (!entry.data_entrada || !entry.codigo || entry.qtd_und <= 0) {
      throw new Error('Dados inválidos para lançamento de entrada.');
    }

    const body = {
      action: 'upsert_entrada_estoque',
      source: 'sercarne-admin',
      sheet: 'ENTRADAS_ESTOQUE',
      upsert_key: ['codigo', 'data_entrada'],
      ...entry,
      entry,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const rawText = await response.text().catch(() => '');
    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      throw new Error(`Falha no Apps Script (${response.status}): ${rawText || response.statusText}`);
    }

    if (parsed && parsed.success === false) {
      throw new Error(String(parsed.error || parsed.message || 'Apps Script retornou falha.'));
    }

    return {
      success: true,
      entry,
      response: parsed,
      raw: rawText,
    };
  },

  async listRecentFromSupabase(limit = 40) {
    const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 200) : 40;

    const { data, error } = await supabase
      .from('entradas_estoque')
      .select('id, codigo, data_entrada, qtd_und, obs, created_at')
      .order('data_entrada', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(error.message || 'Erro ao consultar entradas_estoque.');
    }

    return Array.isArray(data) ? data : [];
  },
};

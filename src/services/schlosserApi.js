import { supabase } from '@/lib/customSupabaseClient';
import { schlosserRules } from '@/domain/schlosserRules';
import { ORDER_STATUS, normalizeOrderStatus } from '@/domain/orderStatus';
import { resolveProductUnitType } from '@/domain/unitType';
import { normalizeCity } from '@/utils/normalizeCity';
import { getStockBreakdown } from '@/utils/stockValidator';
import { toISODateLocal } from '@/utils/dateUtils';

const SPREADSHEET_ID = '12wPGal_n7PKYFGz9W__bXgK4mly2NbrEEGwTrIDCzcI';
const SHEET_NAME = '2026 Base Catalogo Precifica V2';
const CLIENTS_SHEET_NAME = 'Relacao Clientes Sysmo';
const ROUTES_SHEET_NAME = 'Rotas Dias De Entrega';
const CITIES_SHEET_NAME = 'Cidades';

const CACHE_PREFIX = 'schlosser_cache_v30_';
const CACHE_DURATION = 5 * 60 * 1000;
const CLIENTS_CACHE_KEY = 'schlosser_clients_v3';
const ROUTES_CACHE_KEY = 'schlosser_routes_v4_norm';
const CITIES_CACHE_KEY = 'schlosser_cities_v2';

// ✅ Manual: status que COMPROMETEM estoque (com compat legado para histórico)
const COMMITTED_STATUSES = [
  ORDER_STATUS.ENVIADO,
  ORDER_STATUS.CONFIRMADO,
  ORDER_STATUS.SAIU_PARA_ENTREGA,
  'PENDENTE',
  'ENVIADO',
  'CONFIRMADO',
  'SAIU PARA ENTREGA',
];

const onlyISODate = (d) => {
  return toISODateLocal(d);
};

const formatMoneyBRL = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

export const schlosserApi = {
  _getCache(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) return data;
      localStorage.removeItem(key);
    } catch (e) {
      try { localStorage.removeItem(key); } catch {}
    }
    return null;
  },

  _setCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (e) {}
  },

  _parseGvizResponse(text) {
    try {
      const startIndex = text.indexOf('({');
      const endIndex = text.lastIndexOf('})');

      if (startIndex === -1 || endIndex === -1) {
        const jsonString = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
        return this._extractRows(JSON.parse(jsonString));
      }

      const jsonString = text.substring(startIndex + 1, endIndex + 1);
      const json = JSON.parse(jsonString);
      return this._extractRows(json);
    } catch (e) {
      console.error('[API] Error parsing Gviz response', e);
      return [];
    }
  },

  _extractRows(json) {
    if (!json || json.status !== 'ok' || !json.table || !json.table.rows) return [];
    return json.table.rows.map(row => {
      const c = row.c;
      return c.map(cell => (cell ? (cell.v !== null ? cell.v : '') : ''));
    });
  },

  _processImageUrl(img) {
    if (!img) return '';
    const strImg = String(img);

    if (strImg.startsWith('http')) {
      if (strImg.includes('drive.google.com')) {
        return `https://images.weserv.nl/?url=${encodeURIComponent(strImg)}`;
      }
      return strImg;
    }

    const match = strImg.match(/\/d\/([a-zA-Z0-9-_]+)/) || strImg.match(/id=([a-zA-Z0-9-_]+)/);
    if (match) {
      const driveUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
      return `https://images.weserv.nl/?url=${encodeURIComponent(driveUrl)}`;
    }
    return '';
  },

  getEffectiveTable(product, userOrRole = null, totalUND = 1) {
    const prices = product?.prices || {};

    let user = userOrRole;
    if (typeof userOrRole === 'string') {
      const normalized = userOrRole.toLowerCase();
      user = normalized === 'public' ? null : { role: normalized };
    }

    const safeTotalUND = Number.isFinite(Number(totalUND)) && Number(totalUND) > 0 ? Number(totalUND) : 1;
    return schlosserRules.getTabelaAplicada(safeTotalUND, user, prices).tabName;
  },

  calculatePrice(product, userOrRole = null, totalUND = 1) {
    const prices = product?.prices || {};

    let user = userOrRole;
    if (typeof userOrRole === 'string') {
      const normalized = userOrRole.toLowerCase();
      user = normalized === 'public' ? null : { role: normalized };
    }

    const safeTotalUND = Number.isFinite(Number(totalUND)) && Number(totalUND) > 0 ? Number(totalUND) : 1;
    const { price } = schlosserRules.getTabelaAplicada(safeTotalUND, user, prices);
    return Number(price || 0);
  },

  calculateLineItem(product, quantity, userOrRole = null, totalUND = null) {
    const qty = Math.max(0, Number(quantity || 0));
    const undForTable = Number.isFinite(Number(totalUND)) && Number(totalUND) > 0 ? Number(totalUND) : Math.max(1, qty);
    const unitPrice = this.calculatePrice(product, userOrRole, undForTable);

    const weightPerUnit = Number(product?.pesoMedio ?? product?.peso ?? 0) || 0;
    const unitType = resolveProductUnitType(product, 'UND');
    const priceBasis = unitType === 'PCT' ? 'PCT' : 'KG';
    const effectiveWeightPerUnit =
      unitType === 'CX' ? 10 :
      unitType === 'KG' ? 1 :
      weightPerUnit;

    const totalWeight = qty * effectiveWeightPerUnit;
    const total = priceBasis === 'PCT' ? (qty * unitPrice) : (totalWeight * unitPrice);

    const displayString =
      priceBasis === 'PCT'
        ? `${qty} ${unitType} x ${formatMoneyBRL(unitPrice)}/pct = ${formatMoneyBRL(total)}`
        : unitType === 'KG'
        ? `${qty} KG x ${formatMoneyBRL(unitPrice)}/kg = ${formatMoneyBRL(total)}`
        : `${qty} ${unitType} x ${effectiveWeightPerUnit.toFixed(3)}kg x ${formatMoneyBRL(unitPrice)}/kg = ${formatMoneyBRL(total)}`;

    return {
      quantity: qty,
      unitType,
      priceBasis,
      weightPerUnit: effectiveWeightPerUnit,
      pricePerKg: unitPrice, // compat legado
      unitPrice,
      totalWeight,
      total,
      displayString,
    };
  },

  async saveOrderToSheets(orderData, vendorName) {
    const endpoint =
      import.meta.env.VITE_ORDER_SYNC_ENDPOINT ||
      import.meta.env.VITE_ORDER_SYNC_WEBHOOK ||
      '';

    // Integração opcional: sem endpoint configurado, só ignora.
    if (!endpoint) {
      return { success: false, skipped: true, reason: 'missing-endpoint' };
    }

    const payload = {
      ...orderData,
      vendor_name: vendorName || orderData?.vendor_name || '',
      source: 'sercarne-web',
      synced_at: new Date().toISOString(),
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Falha no sync externo (${res.status}): ${errText || res.statusText}`);
    }

    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    return { success: true, payload: body };
  },

  async confirmOrder(orderId, token) {
    if (!orderId) throw new Error('Pedido inválido.');
    if (!token) throw new Error('Link de confirmação inválido ou expirado.');

    const { data: order, error } = await supabase
      .from('pedidos')
      .select('id, items, total_value, status')
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw new Error(`Erro ao localizar pedido: ${error.message}`);
    if (!order) throw new Error('Pedido não encontrado.');

    const currentStatus = normalizeOrderStatus(order.status);
    const alreadyConfirmed = currentStatus === ORDER_STATUS.CONFIRMADO;

    if (!alreadyConfirmed) {
      const { error: updateErr } = await supabase
        .from('pedidos')
        .update({ status: ORDER_STATUS.CONFIRMADO, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateErr) throw new Error(`Erro ao confirmar pedido: ${updateErr.message}`);
    }

    let items = order.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }

    return {
      order: {
        id: order.id,
        items: Array.isArray(items) ? items : [],
        total: Number(order.total_value || 0),
      },
    };
  },

  async getOrders(role, userKey, filters = {}) {
    let query = supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });

    const normalizedRole = String(role || 'public').toLowerCase();
    const isAdmin = normalizedRole === 'admin';
    const vendorKey = onlyDigits(userKey);

    if (!isAdmin) {
      if (!vendorKey) return [];
      query = query.eq('vendor_id', vendorKey);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.fromDate) {
      query = query.gte('delivery_date', filters.fromDate);
    }

    if (filters?.toDate) {
      query = query.lte('delivery_date', filters.toDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async createOrder(roleOrPayload, userKey, orderData) {
    // Compatibilidade:
    // 1) createOrder(role, userKey, orderData)
    // 2) createOrder(legacyPayload)
    const calledWithLegacyPayload =
      roleOrPayload &&
      typeof roleOrPayload === 'object' &&
      !Array.isArray(roleOrPayload) &&
      orderData === undefined;

    if (calledWithLegacyPayload) {
      const legacy = roleOrPayload;
      const normalizedRole = String(legacy?.role || 'public').toLowerCase();
      const clientData = legacy?.clientData || {};
      const vendorKey = onlyDigits(legacy?.vendor_id || legacy?.userKey || userKey);
      const deliveryDate = onlyISODate(legacy?.deliveryDate || legacy?.delivery_date);
      const legacyItems = Array.isArray(legacy?.items) ? legacy.items : [];

      const items = legacyItems.map((entry) => {
        if (entry?.product) {
          const product = entry.product;
          const quantity = Number(entry.quantity ?? entry.quantidade ?? 1);
          const calc = this.calculateLineItem(product, quantity, normalizedRole);

          return {
            sku: product?.sku || product?.codigo,
            codigo: product?.codigo || product?.sku,
            name: product?.descricao || product?.name || 'Produto',
            quantity_unit: quantity,
            quantity,
            quantity_kg: calc.totalWeight,
            price_per_kg: calc.pricePerKg,
            unit_price: calc.unitPrice,
            price_basis: calc.priceBasis,
            total: calc.total,
          };
        }

        return entry;
      });

      const payload = {
        vendor_id: normalizedRole === 'public' ? 'WEBSITE' : (vendorKey || 'VENDOR'),
        vendor_name: legacy?.vendor_name || (normalizedRole === 'public' ? 'Cliente Site' : 'Vendedor'),
        client_id: String(clientData?.cnpj || clientData?.id || legacy?.client_id || 'GUEST'),
        client_name: clientData?.nomeFantasia || clientData?.razaoSocial || legacy?.client_name || 'Cliente',
        client_cnpj: String(clientData?.cnpj || legacy?.client_cnpj || 'N/A').replace(/\D/g, ''),
        route_id: legacy?.route_id || legacy?.route_code || null,
        route_name: legacy?.route_name || clientData?.municipio || clientData?.cidade || 'ROTA_SITE',
        delivery_date: deliveryDate,
        delivery_city: clientData?.municipio || clientData?.cidade || legacy?.delivery_city || null,
        cutoff: legacy?.cutoff || '17:00',
        items,
        total_value: Number(legacy?.total || legacy?.total_value || 0),
        total_weight: Number(legacy?.total_weight || 0),
        observations: legacy?.observations || '',
        status: normalizeOrderStatus(legacy?.status || ORDER_STATUS.ENVIADO),
      };

      const id = await this.saveOrderToSupabase(payload);
      return { success: true, id };
    }

    const normalizedRole = String(roleOrPayload || 'public').toLowerCase();
    const input = orderData || {};
    const vendorKey = onlyDigits(input?.vendor_id || userKey);

    const payload = {
      ...input,
      vendor_id:
        normalizedRole === 'public'
          ? 'WEBSITE'
          : normalizedRole === 'admin'
          ? (input?.vendor_id || vendorKey || 'ADMIN')
          : (vendorKey || input?.vendor_id || 'VENDOR'),
      status: normalizeOrderStatus(input?.status || ORDER_STATUS.ENVIADO),
    };

    const id = await this.saveOrderToSupabase(payload);
    return { success: true, id };
  },

  async cancelOrder(orderId) {
    const { error } = await supabase
      .from('pedidos')
      .update({ status: ORDER_STATUS.CANCELADO, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) throw error;
    return { success: true };
  },

  async getProducts(role) {
    // ✅ BUMP do cache pra não ficar preso no antigo
    const cacheKey = `${CACHE_PREFIX}products_v8_4_1_pct_unit_fix_images_AE_AF_BE_BF_BG_BH_brand_AG_AH_AI`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    /**
     * ✅ Colunas usadas (SHEETS):
     * D  = Código produto
     * I  = Peso médio
     * V,W,X,Y,Z,AA = Tabelas (TAB0, TAB5, TAB4, TAB1, TAB2, TAB3)
     *
     * AE = 1ª foto limpa
     * AF = 1ª foto bruta (fallback)
     * BE = 2ª foto limpa
     * BF = 2ª foto bruta (fallback)
     * BG = 3ª foto limpa
     * BH = 3ª foto bruta (fallback)
     *
     * AG = marca limpa
     * AH = marca bruta (fallback)
     * AI = Código + Nome marca
     *
     * AK/AL/E = descrições
     * AC = tipoVenda
     * AX = visível
     */

    // ⚠️ range até BH é obrigatório
    const query =
      'SELECT D, I, V, W, X, Y, Z, AA, AE, BE, BG, AF, BF, BH, AG, AH, AI, AK, AL, AC, E, AX WHERE D > 0';

    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      SHEET_NAME
    )}&range=A9:BH&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

      const text = await res.text();
      const rows = this._parseGvizResponse(text);

      if (!Array.isArray(rows) || rows.length === 0) {
        console.warn('[API] No products found or invalid data format');
        return [];
      }

      const parseNum = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;

        let str = String(val).trim();
        if (str === '') return 0;

        str = str.replace('R$', '').trim();
        if (str.includes(',') && str.includes('.')) {
          str = str.replace(/\./g, '').replace(',', '.');
        } else if (str.includes(',')) {
          str = str.replace(',', '.');
        }

        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };

      const cleanStr = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        if (['#N/A', '#N/A!', '#REF!', '#VALUE!', '#NAME?', 'N/A'].includes(s)) return '';
        return s;
      };

      const products = rows
        .map((row, idx) => {
          const sku = row[0];
          if (!sku || isNaN(Number(sku)) || Number(sku) < 400000) return null;

          const prices = {
            TAB0: parseNum(row[2]),
            TAB5: parseNum(row[3]),
            TAB4: parseNum(row[4]),
            TAB1: parseNum(row[5]),
            TAB2: parseNum(row[6]),
            TAB3: parseNum(row[7]),
          };

          const weight = parseNum(row[1]);

          // --- IMAGENS (Manual: AE/AF, BE/BF, BG/BH) ---
          const img1 = cleanStr(row[8]);   // AE
          const img2 = cleanStr(row[9]);   // BE
          const img3 = cleanStr(row[10]);  // BG

          const raw1 = cleanStr(row[11]);  // AF
          const raw2 = cleanStr(row[12]);  // BF
          const raw3 = cleanStr(row[13]);  // BH

          const imagesRaw = [
            img1 || raw1,
            img2 || raw2,
            img3 || raw3,
          ].filter(Boolean);

          const images = imagesRaw.map((u) => this._processImageUrl(u)).filter(Boolean);

          // imagem principal (compatibilidade)
          let primaryImg = imagesRaw[0] || '';
          let isBrandImage = false;

          // --- MARCA (AG limpa, AH bruta fallback) + nome (AI) ---
          const brandClean = cleanStr(row[14]); // AG
          const brandRaw = cleanStr(row[15]);   // AH
          const brandName = cleanStr(row[16]);  // AI

          const brandToUse = brandClean || brandRaw || '';
          const brandImage = brandToUse ? this._processImageUrl(brandToUse) : '';

          if (!primaryImg && brandToUse) {
            primaryImg = brandToUse;
            isBrandImage = true;
          }

          const descAK = cleanStr(row[17]); // AK
          const descAL = cleanStr(row[18]); // AL
          const descE = cleanStr(row[20]);  // E

          const desc = descAK || descAL || descE || 'Produto sem descrição';

          let descComplementar = descAL;
          if (desc === descAL) descComplementar = '';

          const tipoVenda = resolveProductUnitType({
            codigo: sku,
            tipoVenda: row[19], // AC
            descricao: desc,
            descricao_complementar: descComplementar,
          }, 'UND');

          // AX = visível
          const axValue = row[21];
          let isVisible = false;
          if (axValue === true) {
            isVisible = true;
          } else if (typeof axValue === 'string') {
            const up = axValue.toUpperCase().trim();
            if (up === 'TRUE' || up === 'VERDADEIRO') isVisible = true;
          }

          const processedPrimary = primaryImg ? this._processImageUrl(primaryImg) : '';

          return {
            id: `${sku}-${idx}`,
            codigo: sku,
            sku: sku,
            descricao: desc,
            descricao_complementar: descComplementar,
            descricaoTecnica: descComplementar,
            peso: parseFloat(weight),
            pesoMedio: parseFloat(weight),
            prices,

            // compat
            imagem: processedPrimary,
            isBrandImage,

            // novo
            images,
            brandImage,
            brandName,

            tipoVenda,
            visivel: isVisible,
            ax_raw: axValue,
          };
        })
        .filter(Boolean);

      this._setCache(cacheKey, products);
      return products;
    } catch (e) {
      console.error('[API] Products fetch error', e);
      return [];
    }
  },

  async getCities() {
    try {
      const routes = await this.getRoutes();
      if (routes && routes.length > 0) {
        const uniqueCities = [...new Set(routes.map(r => r.municipio).filter(Boolean))];
        return uniqueCities
          .map(c => ({ nome: c, ativo: true }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
      }
    } catch (e) {
      console.warn('Using fallback city list logic due to route fetch error', e);
    }

    const cached = this._getCache(CITIES_CACHE_KEY);
    if (cached) return cached;

    const query = 'SELECT A';
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      CITIES_SHEET_NAME
    )}&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

      const text = await res.text();
      const rows = this._parseGvizResponse(text);

      if (!Array.isArray(rows) || rows.length === 0) return [];

      const cities = rows
        .map(row => {
          const name = row[0];
          if (!name || typeof name !== 'string' || name.toLowerCase() === 'cidade') return null;
          return { nome: normalizeCity(name), ativo: true };
        })
        .filter(Boolean)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      this._setCache(CITIES_CACHE_KEY, cities);
      return cities;
    } catch (e) {
      console.error('[API] Cities fetch error', e);
      return [];
    }
  },

  async getClients() {
    const cached = this._getCache(CLIENTS_CACHE_KEY);
    if (cached) return cached;

    const query = 'SELECT A, B, C, D, E, F';
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      CLIENTS_SHEET_NAME
    )}&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      const rows = this._parseGvizResponse(text);

      const clients = rows
        .map((row, i) => {
          if (i === 0 && (row[0] === 'Código' || row[0] === 'Codigo')) return null;
          if (!row[0]) return null;

          return {
            id: String(row[0]),
            razaoSocial: row[1] || '',
            nomeFantasia: row[2] || row[1] || 'Cliente Sem Nome',
            cnpj: row[3] ? String(row[3]).replace(/\D/g, '') : '',
            municipio: normalizeCity(row[4] || ''),
            cidade: normalizeCity(row[4] || ''),
            bairro: row[5] || '',
          };
        })
        .filter(Boolean);

      this._setCache(CLIENTS_CACHE_KEY, clients);
      return clients;
    } catch (e) {
      console.error('[API] Clients fetch error', e);
      return [];
    }
  },

  async getRoutes() {
    const cached = this._getCache(ROUTES_CACHE_KEY);
    if (cached) return cached;

    const query = 'SELECT A, B, C, D, F';
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      ROUTES_SHEET_NAME
    )}&tq=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      const rows = this._parseGvizResponse(text);

      const routes = rows
        .map((row, i) => {
          if (i === 0 && (row[0] === 'DESCRICAO DO GRUPO (ROTA)' || row[1] === 'MUNICIPIOS')) return null;
          if (!row[1] || !row[0]) return null;

          return {
            municipio: normalizeCity(row[1]),
            descricao_grupo_rota: row[0] || '',
            dias_entrega: row[2] || '',
            corte_ate: row[3] || '17:00',
            codigo_cidade: row[4] || '',
          };
        })
        .filter(Boolean);

      this._setCache(ROUTES_CACHE_KEY, routes);
      return routes;
    } catch (e) {
      console.error('[API] Routes fetch error', e);
      return [];
    }
  },

  async saveOrderToSupabase(orderData) {
    const required = ['vendor_id', 'client_id', 'route_name', 'delivery_date', 'items', 'total_value'];
    const missing = required.filter(field => !orderData[field]);
    if (missing.length > 0) {
      console.warn(`[Supabase] Campos faltando: ${missing.join(', ')}`);
    }

    const vendorIdRaw = String(orderData?.vendor_id || '').toUpperCase();
    const isGuestOrder = vendorIdRaw === 'WEBSITE' || vendorIdRaw === 'GUEST';
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const uid = orderData?.vendor_uid || authData?.user?.id || null;

    if ((authErr || !uid) && !isGuestOrder) {
      console.error('[saveOrderToSupabase] Sem sessão autenticada:', authErr);
      throw new Error('Você precisa estar logado para finalizar o pedido.');
    }
    
    const payload = {
      // Em pedidos autenticados usamos uid do Supabase; em pedido público fica null.
      vendor_uid: uid || null,
    
      vendor_id: orderData.vendor_id,
      vendor_name: orderData.vendor_name,
      client_id: orderData.client_id,
      client_name: orderData.client_name,
      client_cnpj: orderData.client_cnpj,
      route_id: orderData.route_id,
      route_name: orderData.route_name,
      delivery_date: orderData.delivery_date,
      delivery_city: orderData.delivery_city,
      cutoff: orderData.cutoff,
      items: orderData.items,
      total_value: orderData.total_value,
      total_weight: orderData.total_weight,
      observations: orderData.observations,
      status: normalizeOrderStatus(orderData.status || ORDER_STATUS.ENVIADO),
    };

    const { data, error } = await supabase.from('pedidos').insert([payload]).select('id').single();

    if (error) {
      console.error('[Supabase] Insert error:', error);

      // Fallback operacional para pedido público: tenta envio externo quando configurado.
      if (isGuestOrder) {
        try {
          const sync = await this.saveOrderToSheets(payload, payload.vendor_name);
          if (sync?.success) {
            return `GUEST-${Date.now()}`;
          }
        } catch (syncErr) {
          console.error('[Supabase] Guest fallback sync error:', syncErr);
        }
      }

      throw new Error(`Erro ao salvar no banco: ${error.message}`);
    }

    return data.id;
  },

  // --- STOCK FUNCTIONS ---

  async getStockByProduct(codigo) {
    const targetCode = String(codigo).trim();

    const { data, error } = await supabase
      .from('entradas_estoque')
      .select('codigo, qtd_und, data_entrada')
      .eq('codigo', targetCode)
      .order('data_entrada', { ascending: true });

    if (error) {
      console.error('[schlosserApi] Error fetching stock entries:', error);
      return [];
    }

    return data || [];
  },

  async getOrdersByProduct(sku) {
    const targetSku = String(sku).trim();

    const { data, error } = await supabase
      .from('pedidos')
      .select('id, delivery_date, items, status')
      .in('status', COMMITTED_STATUSES);

    if (error) {
      console.error('[schlosserApi] Error fetching orders:', error);
      return { totalQuantity: 0, orders: [] };
    }

    const matchingOrders = [];
    let totalQty = 0;

    (data || []).forEach(order => {
      let items = order.items;

      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }

      if (Array.isArray(items)) {
        items.forEach(item => {
          const itemCode = String(item.codigo || item.sku || item.id || '').trim();
          if (itemCode === targetSku) {
            const qty = Number(item.quantity_unit || item.quantity || item.qtd || 0);
            totalQty += qty;
            matchingOrders.push({
              delivery_date: order.delivery_date,
              quantity_unit: qty,
              sku: targetSku,
              status: order.status,
              original_item: item,
            });
          }
        });
      }
    });

    return { totalQuantity: totalQty, orders: matchingOrders };
  },

  async calculateAvailableStock(codigo, deliveryDate) {
    const safeCode = String(codigo).trim();
    const targetDateStr = onlyISODate(deliveryDate) || String(deliveryDate).split('T')[0];

    const breakdown = await getStockBreakdown(safeCode, targetDateStr);

    return {
      codigo: safeCode,
      deliveryDate: targetDateStr,
      totalStock: (breakdown.base || 0) + (breakdown.entradas || 0),
      confirmedOrders: breakdown.pedidos || 0,
      availableStock: breakdown.available || 0,
      breakdown,
    };
  },

  async calculateStockForDates(codigo, _baseStock = 0, dates = []) {
    const sku = String(codigo || '').trim();
    const targetDates = Array.isArray(dates) ? dates : [dates];

    const results = [];
    for (const date of targetDates) {
      const dateISO = onlyISODate(date) || String(date || '').split('T')[0];
      if (!dateISO) {
        results.push({ date: '', available: 0, base: 0, entradas: 0, pedidos: 0 });
        continue;
      }

      const breakdown = await getStockBreakdown(sku, dateISO);
      results.push({
        date: dateISO,
        available: breakdown.available || 0,
        base: breakdown.base || 0,
        entradas: breakdown.entradas || 0,
        pedidos: breakdown.pedidos || 0,
      });
    }

    return results;
  },

  async getIncomingStock() {
    return [];
  },

  async getProductQuantities() {
    return this.getProducts();
  },
};

// --- DEBUG EXPORTS (mantidos) ---

export const debugSupabaseData = async () => {
  console.log('🐞 STARTING FULL SUPABASE DEBUG...');
  const results = {};

  try {
    const { data, error } = await supabase.from('entradas_estoque').select('*');
    if (error) throw error;
    console.log('📊 ENTRADAS_ESTOQUE RAW DATA:', { count: data?.length, sample: data?.[0] });
    results.entradas_estoque = data;
  } catch (e) {
    console.error('❌ ENTRADAS_ESTOQUE ERROR:', e);
    results.entradas_error = e;
  }

  try {
    const { data, error } = await supabase.from('pedidos').select('*');
    if (error) throw error;
    console.log('📦 PEDIDOS RAW DATA:', { count: data?.length, sample: data?.[0] });
    results.pedidos = data;
  } catch (e) {
    console.error('❌ PEDIDOS ERROR:', e);
    results.pedidos_error = e;
  }

  return results;
};

export const checkRLSPolicies = async () => {
  console.log('🛡️ CHECKING RLS POLICIES...');
  const report = {};

  const { error: eError } = await supabase.from('entradas_estoque').select('codigo').limit(1);
  report.entradas_public_read = !eError;
  console.log(`Entradas Read: ${!eError ? '✅ OK' : '❌ BLOCKED'}`, eError || '');

  const { error: pError } = await supabase.from('pedidos').select('id').limit(1);
  report.pedidos_public_read = !pError;
  console.log(`Pedidos Read: ${!pError ? '✅ OK' : '❌ BLOCKED'}`, pError || '');

  return report;
};

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.schlosserApi = schlosserApi;
  window.schlosserDebug = { debugSupabaseData, checkRLSPolicies };
}

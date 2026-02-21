const TAB_KEYS = Object.freeze(['TAB0', 'TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB5']);

const TAB_TOKEN_MAP = Object.freeze({
  '0': 'TAB0',
  '1': 'TAB1',
  '2': 'TAB2',
  '3': 'TAB3',
  '4': 'TAB4',
  '5': 'TAB5',
  TAB0: 'TAB0',
  TAB1: 'TAB1',
  TAB2: 'TAB2',
  TAB3: 'TAB3',
  TAB4: 'TAB4',
  TAB5: 'TAB5',
});

const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

const resolveTabRRaw = (user) => {
  if (!user || typeof user !== 'object') return '';
  const candidates = [
    user['TabR$'],
    user['tabr$'],
    user.TabR,
    user.tabr,
    user.tab_r,
    user.tab_rs,
    user.tabelas_permitidas,
    user.allowed_tabs,
  ];
  const found = candidates.find((v) => v !== undefined && v !== null && String(v).trim() !== '');
  return found == null ? '' : String(found);
};

const parseAllowedTabs = (user) => {
  const raw = resolveTabRRaw(user);
  if (!raw) return [];
  const matches = raw.toUpperCase().match(/TAB\s*[0-5]|[0-5]/g) || [];
  return unique(
    matches.map((token) => {
      const normalized = String(token || '').replace(/\s+/g, '').toUpperCase();
      return TAB_TOKEN_MAP[normalized] || '';
    })
  );
};

const getPriceForTab = (tabelasDisponiveis, tabName) => {
  const value = Number(tabelasDisponiveis?.[tabName]);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const pickFirstTabWithPrice = (tabNames, tabelasDisponiveis) => {
  const safeTabs = unique(tabNames);
  for (const tabName of safeTabs) {
    const price = getPriceForTab(tabelasDisponiveis, tabName);
    if (price > 0) return { tabName, price };
  }
  return null;
};

const pickLowestPriceTab = (tabNames, tabelasDisponiveis) => {
  const safeTabs = unique(tabNames);
  let best = null;
  for (const tabName of safeTabs) {
    const price = getPriceForTab(tabelasDisponiveis, tabName);
    if (price <= 0) continue;
    if (!best || price < best.price) {
      best = { tabName, price };
    }
  }
  return best;
};

const resolveVolumePreferredTab = (qtdUNDTotalCarrinho) => {
  const qtd = Number(qtdUNDTotalCarrinho || 0);
  if (qtd === 1) return 'TAB1';
  if (qtd >= 2 && qtd <= 9) return 'TAB0';
  if (qtd >= 10) return 'TAB4';
  return 'TAB3';
};

const resolveIsAdminLiberado = (user, userLevel) => {
  const roleRaw = String(user?.tipo_de_Usuario ?? user?.tipo_usuario ?? user?.role ?? '').toLowerCase();
  const isAdminRole = roleRaw.includes('admin');
  const isAdminLevel = Number.isFinite(userLevel) && userLevel >= 10;
  return isAdminRole || isAdminLevel;
};

export const schlosserRules = {
  _formatMoney: (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val),

  _formatWeight: (val) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val),

  /**
   * CAP 6 — FÓRMULA ÚNICA
   * VALOR ESTIMADO = UND × PESO MÉDIO × PREÇO (R$/KG)
   */
  calcularValorEstimado: (und, pesoMedio, precoKg) => {
    const nUnd = Number(und);
    const nPeso = Number(pesoMedio);
    const nPreco = Number(precoKg);

    if (isNaN(nUnd) || nUnd < 0) return 0;
    if (isNaN(nPeso) || nPeso < 0) return 0;
    if (isNaN(nPreco) || nPreco < 0) return 0;

    return nUnd * nPeso * nPreco;
  },

  /**
   * CAP 7 — Cliente vê apenas o benefício (%)
   * Benefício = diferença entre TAB3 (público) e preço aplicado
   */
  calcularBeneficio: (precoTab3, precoAplicado) => {
    const base = Number(precoTab3);
    const aplicado = Number(precoAplicado);
    if (!base || base <= 0) return 0;
    if (!aplicado || aplicado <= 0) return 0;
    return ((base - aplicado) / base) * 100;
  },

  /**
   * CAP 7 — TABELAS POR VOLUME (UND TOTAL NO CARRINHO)
   * 1 UND    -> TAB1
   * 2–9 UND  -> TAB0
   * >=10 UND -> TAB4
   * Sem login -> TAB3 (público)
   *
   * Obs: user aqui é o objeto do SupabaseAuth (não precisa tipo_usuario)
   */
  getTabelaAplicada: (qtdUNDTotalCarrinho, user, tabelasDisponiveis) => {
    const publicPrice = Number(tabelasDisponiveis?.TAB3) || 0;
    const floorTab5 = Number(tabelasDisponiveis?.TAB5) || 0;
    const userLevel = Number(
      user?.Nivel ??
      user?.nivel ??
      user?.nivel_usuario ??
      user?.nivelUsuario
    );
    const allowedTabs = parseAllowedTabs(user);
    const volumePreferredTab = resolveVolumePreferredTab(qtdUNDTotalCarrinho);
    const isLevel3 = Number.isFinite(userLevel) && userLevel === 3;
    const isAdminLiberado = resolveIsAdminLiberado(user, userLevel);

    const applyFloor = (value) => {
      const n = Number(value) || 0;
      if (floorTab5 > 0 && (!n || n < floorTab5)) return floorTab5;
      return n;
    };

    // Sem login: sempre TAB3
    if (!user) {
      const price = applyFloor(publicPrice);
      return { price, tabName: price === floorTab5 && floorTab5 > 0 ? 'TAB5' : 'TAB3' };
    }

    // Admin liberado: usa menor preço válido entre todas as tabelas e ignora piso TAB5
    if (isAdminLiberado) {
      const bestAdminPrice = pickLowestPriceTab(TAB_KEYS, tabelasDisponiveis);
      if (bestAdminPrice) {
        return { price: bestAdminPrice.price, tabName: bestAdminPrice.tabName };
      }
      return { price: 0, tabName: 'TAB3' };
    }

    // TabR$ define as tabelas permitidas para o usuário.
    // Se vazio, mantém fallback legado por volume.
    const preferredTabs = allowedTabs.length > 0
      ? unique([
          isLevel3 && allowedTabs.includes('TAB2') ? 'TAB2' : volumePreferredTab,
          ...allowedTabs,
          'TAB3',
          'TAB5',
        ])
      : unique([
          isLevel3 ? 'TAB2' : volumePreferredTab,
          'TAB1',
          'TAB0',
          'TAB4',
          'TAB2',
          'TAB3',
          'TAB5',
        ]);

    const selected = pickFirstTabWithPrice(preferredTabs, tabelasDisponiveis);
    if (!selected) {
      const fallback = applyFloor(publicPrice);
      return {
        price: fallback,
        tabName: fallback === floorTab5 && floorTab5 > 0 ? 'TAB5' : 'TAB3',
      };
    }

    // Piso absoluto: nunca vender abaixo da TAB5
    const flooredPrice = applyFloor(selected.price);
    if (!flooredPrice || flooredPrice <= 0) {
      const fallback = applyFloor(publicPrice);
      return { price: fallback, tabName: fallback === floorTab5 && floorTab5 > 0 ? 'TAB5' : 'TAB3' };
    }

    return {
      price: flooredPrice,
      tabName: flooredPrice === floorTab5 && floorTab5 > 0 ? 'TAB5' : selected.tabName,
    };
  },

  formatarCalculo: (und, pesoMedio, precoKg) => {
    const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoKg || 0);
    const weight = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pesoMedio || 0);
    return `${und} UND × ${weight} KG × ${money}/KG`;
  },

  formatarCalculoCompleto: (und, pesoMedio, precoKg) => {
    const nUnd = Number(und) || 0;
    const nPeso = Number(pesoMedio) || 0;
    const nPreco = Number(precoKg) || 0;

    const total = nUnd * nPeso * nPreco;
    const moneyTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);

    const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nPreco);
    const weight = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(nPeso);

    return `${nUnd} UND × ${weight} KG × ${money}/KG = ${moneyTotal}`;
  }
};

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
    const transferPrice = Number(tabelasDisponiveis?.TAB2) || 0;
    const floorTab5 = Number(tabelasDisponiveis?.TAB5) || 0;
    const userLevel = Number(
      user?.Nivel ??
      user?.nivel ??
      user?.nivel_usuario ??
      user?.nivelUsuario
    );

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

    let price = publicPrice;
    let tabName = 'TAB3';

    // Regra especial: nível 3 usa TAB2 (transferência) direto ao logar
    if (Number.isFinite(userLevel) && userLevel === 3 && transferPrice > 0) {
      price = transferPrice;
      tabName = 'TAB2';
    } else if (qtdUNDTotalCarrinho === 1 && Number(tabelasDisponiveis?.TAB1) > 0) {
      price = Number(tabelasDisponiveis.TAB1);
      tabName = 'TAB1';
    } else if (
      qtdUNDTotalCarrinho >= 2 &&
      qtdUNDTotalCarrinho <= 9 &&
      Number(tabelasDisponiveis?.TAB0) > 0
    ) {
      price = Number(tabelasDisponiveis.TAB0);
      tabName = 'TAB0';
    } else if (qtdUNDTotalCarrinho >= 10 && Number(tabelasDisponiveis?.TAB4) > 0) {
      price = Number(tabelasDisponiveis.TAB4);
      tabName = 'TAB4';
    }

    // Piso absoluto: nunca vender abaixo da TAB5
    const flooredPrice = applyFloor(price);
    if (!flooredPrice || flooredPrice <= 0) {
      const fallback = applyFloor(publicPrice);
      return { price: fallback, tabName: fallback === floorTab5 && floorTab5 > 0 ? 'TAB5' : 'TAB3' };
    }

    return {
      price: flooredPrice,
      tabName: flooredPrice === floorTab5 && floorTab5 > 0 ? 'TAB5' : tabName,
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

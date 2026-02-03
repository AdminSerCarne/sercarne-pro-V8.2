
import { isBefore, parseISO, startOfDay, isSameDay } from 'date-fns';

export const schlosserRules = {
  // Formatters Helper
  _formatMoney: (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val),
  _formatWeight: (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val),

  /**
   * Calculates availability for a specific date.
   * Formula: Available = Base Stock + Incoming(<= targetDate) - Committed(<= targetDate)
   */
  calculateAvailability: (product, targetDate) => {
      if (!product || !targetDate) return 0;
      
      // 1. Base Stock (Snapshot of current physical inventory)
      const baseStock = Number(product.estoque_base || 0);
      
      // 2. Incoming Stock
      // Filter entries in 'entradas_estoque' where data_entrada <= targetDate
      // Note: We need 'stock_movements' attached to product from useProducts hook
      let incomingSum = 0;
      if (product.stock_movements?.incoming) {
          product.stock_movements.incoming.forEach(entry => {
              // Check matching product code
              if (String(entry.codigo) === String(product.codigo)) {
                  // Check date condition
                  const entryDate = parseISO(entry.data_entrada); // assuming YYYY-MM-DD string or ISO
                  if (isBefore(entryDate, targetDate) || isSameDay(entryDate, targetDate)) {
                      incomingSum += Number(entry.qtd_und || 0);
                  }
              }
          });
      }

      // 3. Committed Stock
      // Filter active orders where delivery_date <= targetDate
      let committedSum = 0;
      if (product.stock_movements?.orders) {
          product.stock_movements.orders.forEach(order => {
              const deliveryDate = parseISO(order.delivery_date); // assuming YYYY-MM-DD
              
              // If order is delivered by (or on) target date, it consumes stock
              if (isBefore(deliveryDate, targetDate) || isSameDay(deliveryDate, targetDate)) {
                  if (Array.isArray(order.items)) {
                      // Find item in order matching product
                      const item = order.items.find(i => String(i.sku || i.codigo) === String(product.codigo));
                      if (item) {
                          // Use quantity_unit or fallback
                          committedSum += Number(item.quantity_unit || item.quantidade || 0);
                      }
                  }
              }
          });
      }

      const totalAvailable = baseStock + incomingSum - committedSum;
      return totalAvailable > 0 ? totalAvailable : 0; // Never show negative stock availability
  },

  /**
   * Calculates the estimated total value based on units, average weight, and price per kg.
   * Formula: und * pesoMedio * precoKg
   */
  calcularValorEstimado: (und, pesoMedio, precoKg) => {
    // Validation for debugging and safety
    const nUnd = Number(und);
    const nPeso = Number(pesoMedio);
    const nPreco = Number(precoKg);

    if (isNaN(nUnd) || nUnd < 0) {
        return 0;
    }
    if (isNaN(nPeso) || nPeso < 0) {
        return 0;
    }
    if (isNaN(nPreco) || nPreco < 0) {
        return 0;
    }
    
    return nUnd * nPeso * nPreco;
  },

  /**
   * Calculates the discount percentage between a base price (TAB3) and the applied price.
   */
  calcularBeneficio: (precoTab3, precoAplicado) => {
    if (!precoTab3 || precoTab3 <= 0) return 0;
    if (!precoAplicado || precoAplicado <= 0) return 0;
    return ((precoTab3 - precoAplicado) / precoTab3) * 100;
  },

  /**
   * Determines the correct price table based on quantity and user type.
   */
  getTabelaAplicada: (qtdUND, tipoUsuario, tabelasDisponiveis) => {
    // Default to Public Price (TAB3)
    const publicPrice = Number(tabelasDisponiveis?.TAB3) || 0;
    
    // If not logged in, always public price
    if (!tipoUsuario) {
       return { price: publicPrice, tabName: 'TAB3' };
    }

    let price = publicPrice;
    let tabName = 'TAB3';

    // B2B Rules
    if (qtdUND === 1) {
       if (tabelasDisponiveis?.TAB1 > 0) {
          price = Number(tabelasDisponiveis.TAB1);
          tabName = 'TAB1';
       }
    } else if (qtdUND >= 2 && qtdUND <= 9) {
       if (tabelasDisponiveis?.TAB0 > 0) {
          price = Number(tabelasDisponiveis.TAB0);
          tabName = 'TAB0';
       }
    } else if (qtdUND >= 10) {
       if (tabelasDisponiveis?.TAB4 > 0) {
          price = Number(tabelasDisponiveis.TAB4);
          tabName = 'TAB4';
       }
    }

    // Fallback if specific table price is 0/invalid, use public price
    if (price <= 0) {
        price = publicPrice;
        tabName = 'TAB3';
    }

    return { price, tabName };
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
    
    const safeTotal = nUnd * nPeso * nPreco;
    const moneyTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeTotal);
    
    const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nPreco);
    const weight = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(nPeso);
    
    return `${nUnd} UND × ${weight} KG × ${money}/KG = ${moneyTotal}`;
  }
};

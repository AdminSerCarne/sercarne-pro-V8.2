import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { schlosserRules } from '@/domain/schlosserRules';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [deliveryInfo, setDeliveryInfo] = useState({
    delivery_date: null,
    route_code: '',
    route_name: '',
    route_cutoff: '',
    route_city: ''
  });

  const [stockUpdateTrigger, setStockUpdateTrigger] = useState(0);

  const { user } = useSupabaseAuth();

  // ✅ UND total do carrinho (CAP 7)
  const getTotalUND = useCallback((items) => {
    return (items || []).reduce((sum, i) => {
      const q = Number(i?.quantidade ?? i?.quantity ?? 0);
      return sum + (Number.isFinite(q) ? q : 0);
    }, 0);
  }, []);

  /**
   * ✅ Reaplica tabela/preço em TODOS os itens conforme UND total do carrinho.
   * Regra do Manual: a tabela é definida pelo UND total do carrinho, e o cliente não vê a tabela.
   */
  const reapplyPriceTables = useCallback((items) => {
    const totalUND = getTotalUND(items);

    return (items || []).map((item) => {
      const tabelas = item?.prices || item?.tabelas || {};
      const currentPrice = Number(item?.price ?? item?.preco ?? item?.price_per_kg ?? 0);

      const { price } = schlosserRules.getTabelaAplicada(totalUND, user, tabelas);

      // fallback: se não tiver tabelas no item, não zera — mantém o que já tem
      const finalPrice = Number(price);
      return {
        ...item,
        price: Number.isFinite(finalPrice) && finalPrice > 0 ? finalPrice : currentPrice
      };
    });
  }, [getTotalUND, user]);

  // ✅ Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('schlosser_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCartItems(reapplyPriceTables(parsed));
        }
      } catch (e) {
        console.error("Error loading cart", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('schlosser_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // ✅ Se logar/deslogar, recalcula preços (B2B vs público)
  useEffect(() => {
    setCartItems((prev) => (prev?.length ? reapplyPriceTables(prev) : prev));
  }, [user, reapplyPriceTables]);

  const notifyStockUpdate = useCallback(() => {
    setStockUpdateTrigger((prev) => prev + 1);
  }, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  /**
   * ✅ Add item e depois reaplica tabela do carrinho todo (CAP 7)
   */
  const addToCart = useCallback((product, quantity, variant = null) => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) return;

    setCartItems((prev) => {
      const code = String(product.codigo).trim();
      const existingItem = prev.find((i) => String(i.codigo).trim() === code);

      let next;
      if (existingItem) {
        next = prev.map((i) =>
          String(i.codigo).trim() === code
            ? { ...i, quantidade: Number(i.quantidade || 0) + qty, variant }
            : i
        );
      } else {
        next = [...prev, { ...product, quantidade: qty, variant }];
      }

      // ✅ recalcula preços de todos os itens conforme UND total
      return reapplyPriceTables(next);
    });
  }, [reapplyPriceTables]);

  /**
   * ✅ Remover item e reaplicar tabela (UND total muda)
   */
  const removeFromCart = useCallback((codigo) => {
    setCartItems((prev) => {
      const next = prev.filter((item) => String(item.codigo).trim() !== String(codigo).trim());
      return reapplyPriceTables(next);
    });
  }, [reapplyPriceTables]);

  /**
   * ✅ Atualiza quantidade e reaplica tabela (UND total muda)
   */
  const updateItemQuantity = useCallback((codigo, newQuantity) => {
    const n = Number(newQuantity);
    if (!Number.isFinite(n) || n < 1) return;

    setCartItems((prev) => {
      const next = prev.map((item) =>
        String(item.codigo).trim() === String(codigo).trim()
          ? { ...item, quantidade: n }
          : item
      );
      return reapplyPriceTables(next);
    });
  }, [reapplyPriceTables]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setDeliveryInfo({
      delivery_date: null,
      route_code: '',
      route_name: '',
      route_cutoff: '',
      route_city: ''
    });
  }, []);

  const getCartMetrics = useCallback(() => {
    const { totalValue, totalWeight, processedItems } = calculateOrderMetrics(cartItems);
    return { totalValue, totalWeight, processedItems };
  }, [cartItems]);

  const getCartTotal = useCallback(() => {
    const { totalValue } = calculateOrderMetrics(cartItems);
    return totalValue || 0;
  }, [cartItems]);

  const getCartCount = useCallback(() => {
    return cartItems.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
  }, [cartItems]);

  const contextValue = useMemo(() => ({
    cartItems,
    isCartOpen,
    setIsCartOpen,
    openCart,
    closeCart,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    getCartMetrics,
    selectedClient,
    setSelectedClient,
    deliveryInfo,
    setDeliveryInfo,
    stockUpdateTrigger,
    notifyStockUpdate
  }), [
    cartItems,
    isCartOpen,
    selectedClient,
    deliveryInfo,
    stockUpdateTrigger,
    openCart,
    closeCart,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    getCartMetrics,
    notifyStockUpdate
  ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

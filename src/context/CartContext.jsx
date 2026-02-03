import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { schlosserRules } from '@/domain/schlosserRules';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
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

  // Trigger for refetching stock
  const [stockUpdateTrigger, setStockUpdateTrigger] = useState(0);

  const { toast } = useToast();
  // Access user for pricing calculations
  const { user } = useSupabaseAuth();

  // Helper: total UND do carrinho (regra do manual CAP 7)
  const getTotalUND = useCallback((items) => {
    return (items || []).reduce((sum, i) => {
      const q = Number(i?.quantidade ?? i?.quantity ?? 0);
      return sum + (Number.isFinite(q) ? q : 0);
    }, 0);
  }, []);

  // Helper: reaplicar tabela em TODOS itens baseado no total UND
  const reapplyPriceTables = useCallback((items) => {
    const totalUND = getTotalUND(items);

    return (items || []).map(item => {
      // item.prices vem do schlosserApi/getProducts e deve viajar junto no item
      const tabelas = item?.prices || item?.tabelas || {};

      const { price } = schlosserRules.getTabelaAplicada(totalUND, user, tabelas);

      return {
        ...item,
        price // preço por KG aplicado (TAB1/TAB0/TAB4 ou fallback TAB3)
      };
    });
  }, [getTotalUND, user]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('schlosser_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);

        // Segurança: ao carregar, reaplica tabela conforme UND total atual
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCartItems(reapplyPriceTables(parsed));
        } else {
          setCartItems([]);
        }
      } catch (e) {
        console.error("Error loading cart", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // roda só uma vez (mount)

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('schlosser_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const notifyStockUpdate = useCallback(() => {
    setStockUpdateTrigger(prev => prev + 1);
  }, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const addToCart = useCallback((product, quantity, variant = null) => {
    // O preço que entra aqui já vem calculado no ProductCard
    const priceToStore = product.price || product.preco || product.price_per_kg || 0;

    console.log(`[CartContext] Adding item ${product.codigo}. Price: ${priceToStore}, Qty: ${quantity}`);

    setCartItems(prev => {
      let next = [];


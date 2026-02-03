import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';

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

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('schlosser_cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error loading cart", e);
      }
    }
  }, []);

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
    // Ensure price is captured correctly. 
    // The 'product' object passed here MUST have the 'price' field set by ProductCard.
    // We prioritize 'price' (calculated), then 'preco', then 'price_per_kg'.
    
    const priceToStore = product.price || product.preco || product.price_per_kg || 0;
    
    console.log(`[CartContext] Adding item ${product.codigo}. Price: ${priceToStore}, Qty: ${quantity}`);

    setCartItems(prev => {
      const existingItem = prev.find(item => item.codigo === product.codigo);
      if (existingItem) {
        // Update existing item
        return prev.map(item => 
          item.codigo === product.codigo 
            ? { 
                ...item, 
                quantidade: item.quantidade + quantity,
                // Update price just in case it changed
                price: priceToStore
              }
            : item
        );
      }
      // New item - Explicitly store 'price'
      return [...prev, { ...product, quantidade: quantity, variant, price: priceToStore }];
    });
  }, []);

  const removeFromCart = useCallback((codigo) => {
    setCartItems(prev => prev.filter(item => item.codigo !== codigo));
  }, []);

  const updateItemQuantity = useCallback((codigo, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems(prev => 
      prev.map(item => 
        item.codigo === codigo 
          ? { ...item, quantidade: newQuantity }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setDeliveryInfo({
        delivery_date: null,
        route_code: '',
        route_name: '',
        route_cutoff: '',
        route_city: ''
    });
    // Don't clear selectedClient for convenience
  }, []);

  // Helper to get processed metrics (prices, weights) for the current cart
  // Memoized to prevent recreation on every render
  const getCartMetrics = useCallback(() => {
    const { totalValue, totalWeight, processedItems } = calculateOrderMetrics(cartItems);
    return { totalValue, totalWeight, processedItems };
  }, [cartItems]);

  const getCartTotal = useCallback(() => {
    const { totalValue } = calculateOrderMetrics(cartItems);
    return totalValue || 0;
  }, [cartItems]);
  
  const getCartCount = useCallback(() => {
    return cartItems.reduce((acc, item) => acc + item.quantidade, 0);
  }, [cartItems]);

  // Memoize the context value to prevent unnecessary re-renders of consumers
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
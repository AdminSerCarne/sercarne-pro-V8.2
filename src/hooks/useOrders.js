import { useState, useCallback } from 'react';
import { schlosserApi } from '@/services/schlosserApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useOrders = () => {
  const { role, userKey } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchOrders = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const data = await schlosserApi.getOrders(role, userKey, filters);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [role, userKey]);

  const createOrder = useCallback(async (orderData) => {
    setLoading(true);
    try {
      const result = await schlosserApi.createOrder(role, userKey, orderData);
      return result;
    } catch (err) {
      toast({
        title: "Erro ao criar pedido",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [role, userKey, toast]);

  const cancelOrder = useCallback(async (orderId) => {
    setLoading(true);
    try {
      const result = await schlosserApi.cancelOrder(orderId);
      if (result.success) {
        toast({ title: "Pedido cancelado", description: `Pedido #${orderId} foi cancelado.` });
      }
      return result;
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível cancelar o pedido.", variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    error,
    fetchOrders,
    createOrder,
    cancelOrder
  };
};
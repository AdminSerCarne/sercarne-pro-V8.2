import React, { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/context/CartContext";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import CartItemControls from './CartItemControls';
import ClientSelector from './ClientSelector';
import CitySelector from './CitySelector';
import RotaSelector from './RotaSelector';
import DeliveryDateSelector from './DeliveryDateSelector';
import {
  ShoppingBag,
  ArrowLeft,
  Check,
  Loader2,
  AlertOctagon,
  RefreshCw,
  User,
  Phone,
  FileText,
  AlertCircle,
  PartyPopper
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { schlosserApi } from '@/services/schlosserApi';

const ShoppingCart = ({ isCartOpen, setIsCartOpen }) => {
  const {
    cartItems,
    updateItemQuantity,
    removeFromCart,
    selectedClient,
    setSelectedClient,
    deliveryInfo,
    setDeliveryInfo,
    getCartMetrics,
    clearCart
  } = useCart();

  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Guest Form State
  const [guestName, setGuestName] = useState('');
  const [guestCnpj, setGuestCnpj] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCity, setGuestCity] = useState('');

  // Selected Route State
  const [selectedRoute, setSelectedRoute] = useState(null);

  const [validationStatuses, setValidationStatuses] = useState({});
  const [isValidatingOrder, setIsValidatingOrder] = useState(false);
  const [isRefreshingStock, setIsRefreshingStock] = useState(false);

  const { totalValue, totalWeight, processedItems } = useMemo(() => getCartMetrics(), [getCartMetrics]);

  const hasPriceError = useMemo(() => {
    return (processedItems || []).some(item => !Number.isFinite(item.pricePerKg) || item.pricePerKg <= 0);
  }, [processedItems]);

  // Calculate Total Quantity for Discount Threshold
  const totalQuantity = useMemo(() => {
    return (cartItems || []).reduce((acc, item) => acc + Number(item?.quantidade || 0), 0);
  }, [cartItems]);

  const DISCOUNT_THRESHOLD = 10;
  const isDiscountReached = totalQuantity >= DISCOUNT_THRESHOLD;
  const unitsToDiscount = Math.max(0, DISCOUNT_THRESHOLD - totalQuantity);

  const normalizeDateToISO = (dateLike) => {
    if (!dateLike) return '';
    // já vem "YYYY-MM-DD" do selector normalmente
    if (typeof dateLike === 'string') return dateLike.split('T')[0];
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (isNaN(d.getTime())) return String(dateLike).split('T')[0];
    return d.toISOString().split('T')[0];
  };

  const refreshStockValidation = async () => {
    if (!deliveryInfo?.delivery_date) {
      setValidationStatuses({});
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      setValidationStatuses({});
      return;
    }

    setIsRefreshingStock(true);

    const statuses = {};
    const dateObj = new Date(deliveryInfo.delivery_date);

    for (const item of cartItems) {
      const result = await schlosserApi.calculateAvailableStock(item.codigo, dateObj);
      const isValid = result.availableStock >= item.quantidade;
      statuses[item.codigo] = { isValid, available: result.availableStock };
    }

    setValidationStatuses(statuses);
    setIsRefreshingStock(false);
  };

  useEffect(() => {
    refreshStockValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, deliveryInfo?.delivery_date]);

  // Handle Route Selection
  const handleRouteSelect = (route) => {
    setSelectedRoute(route);

    if (route) {
      setDeliveryInfo(prev => ({
        ...prev,
        route_id: route.descricao_grupo_rota,
        route_name: route.descricao_grupo_rota,
        delivery_city: route.municipio,
        cutoff: route.corte_ate,
        delivery_date: null
      }));
    } else {
      setDeliveryInfo(prev => ({ ...prev, route_id: '', delivery_date: null }));
    }
  };

  const buildOrderItemsPayload = () => {
    // ✅ Aqui é a correção que resolve “peso/valor zerado” no WhatsApp/Print:
    // Gravamos nos itens os campos esperados pelo calculateOrderMetrics + os campos legados.
    return (processedItems || []).map(i => {
      const codigo = String(i.codigo || i.sku || '').trim();

      const quantity = Number(i.quantity || 0);
      const unitType = String(i.unitType || 'UND').toUpperCase();

      const pricePerKg = Number(i.pricePerKg || 0);
      const pesoMedio = Number(i.averageWeight || i.pesoMedio || 0);

      const estimatedWeight = Number(i.estimatedWeight || 0);
      const estimatedValue = Number(i.estimatedValue || 0);

      const name = i.name || i.descricao || 'Produto';

      return {
        // chaves “do app” (usadas por WhatsAppShare / Print quando recalcula)
        codigo,
        sku: codigo,
        name,
        descricao: name,
        quantidade: quantity,
        quantity,
        unitType,
        pricePerKg,
        pesoMedio,
        averageWeight: pesoMedio,
        estimatedWeight,
        estimatedValue,

        // chaves “legadas” (já estava salvando — mantemos por compatibilidade)
        quantity_unit: quantity,
        unit_type: unitType,
        price_per_kg: pricePerKg,
        total_weight: estimatedWeight,
        total_value: estimatedValue,
      };
    });
  };

  const handleConfirmOrderClick = async () => {
    setIsValidatingOrder(true);

    try {
      if (!cartItems || cartItems.length === 0) {
        toast({ variant: "destructive", title: "Carrinho vazio" });
        return;
      }

      if (user && !selectedClient) {
        toast({ variant: "destructive", title: "Selecione um cliente" });
        return;
      }

      if (!user && (!guestName || !guestPhone || !guestCity)) {
        toast({
          variant: "destructive",
          title: "Preencha seus dados",
          description: "Nome, Telefone e Cidade são obrigatórios."
        });
        return;
      }

      if (!deliveryInfo?.delivery_date) {
        toast({ variant: "destructive", title: "Selecione uma data de entrega" });
        return;
      }

      if (hasPriceError) {
        toast({ variant: "destructive", title: "Erro de Preço", description: "Alguns itens estão sem preço válido." });
        return;
      }

      // Stock Validation
      const insufficientItems = [];
      for (const item of cartItems) {
        const result = await schlosserApi.calculateAvailableStock(item.codigo, new Date(deliveryInfo.delivery_date));
        if (result.availableStock < item.quantidade) {
          insufficientItems.push({
            descricao: item.descricao,
            needed: item.quantidade,
            available: result.availableStock
          });
        }
      }

      if (insufficientItems.length > 0) {
        const details = insufficientItems.map(p =>
          `${p.descricao}\n(Pedido: ${p.needed}, Disp: ${p.available})`
        ).join('\n\n');

        toast({
          variant: "destructive",
          title: "Estoque insuficiente",
          description: `Ajuste as quantidades:\n\n${details}`,
          className: "whitespace-pre-wrap"
        });

        refreshStockValidation();
        return;
      }

      const itemsPayload = buildOrderItemsPayload();
      const clientCnpjRaw = user
        ? (selectedClient?.cnpj ??
           selectedClient?.CNPJ ??
           selectedClient?.client_cnpj ??
           selectedClient?.cnpjCpf ??
           selectedClient?.documento ??
           '')
        : (guestCnpj ?? '');
      
      const clientCnpj = String(clientCnpjRaw).replace(/\D/g, ''); // só dígitos
      
      const orderData = {
        vendor_id: user ? (user.id || 'VENDOR') : 'WEBSITE',
        vendor_name: user ? (user.usuario || user.nome || 'Vendedor') : 'Cliente Site',
        client_id: user ? (selectedClient.id || selectedClient.cnpj) : 'GUEST',
        client_name: user ? (selectedClient.nomeFantasia || selectedClient.razaoSocial) : guestName,
        client_cnpj: user ? (clientCnpj || 'N/A') : (clientCnpj || 'N/A'),

        route_id: deliveryInfo.route_id || 'ROTA_SITE',
        route_name: deliveryInfo.route_name || guestCity,

        delivery_date: normalizeDateToISO(deliveryInfo.delivery_date),
        delivery_city: user ? (deliveryInfo.delivery_city || selectedClient.municipio) : guestCity,
        cutoff: deliveryInfo.cutoff || '17:00',

        items: itemsPayload,

        total_value: Number(totalValue || 0),
        total_weight: Number(totalWeight || 0),

        observations: user ? '' : `Contato: ${guestPhone}`,

        // Vendedor confirma na hora; Site fica pendente
        status: user ? 'CONFIRMADO' : 'PENDENTE'
      };

      await schlosserApi.saveOrderToSupabase(orderData);

      toast({
        title: "Pedido Enviado!",
        description: user ? "Confirmado com sucesso." : "Recebemos seu pedido. Entraremos em contato.",
        className: "bg-green-600 text-white"
      });

      clearCart();
      setIsCartOpen(false);

      if (!user) navigate('/catalog?orderSuccess=true');
    } catch (error) {
      console.error("Order save error:", error);
      toast({ variant: "destructive", title: "Erro ao finalizar", description: error.message });
    } finally {
      setIsValidatingOrder(false);
    }
  };

  const handleContinueShopping = () => {
    setIsCartOpen(false);
    navigate('/catalog');
  };

  const formatMoney = (value) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
      : 'R$ 0,00';

  // Determine current city context
  const targetCity = user
    ? (selectedClient?.municipio || selectedClient?.cidade)
    : guestCity;

  // For automatic suggestions (pode ser null quando carrinho vazio)
  const drivingCartItem = (cartItems && cartItems.length > 0) ? {
    sku: cartItems[0].codigo,
    quantity_unit: cartItems[0].quantidade,
    ...cartItems[0]
  } : null;

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col h-full p-0 bg-[#0a0a0a] text-white border-l border-white/10 z-50 overflow-hidden shadow-2xl">
        <SheetHeader className="p-4 border-b border-white/10 bg-[#0a0a0a] z-20 shadow-md flex-none">
          <div className="flex items-center gap-3">
            <div className="bg-[#FF6B35]/10 p-2 rounded-full text-[#FF6B35]">
              <ShoppingBag size={20} />
            </div>
            <div>
              <SheetTitle className="text-white text-lg">Seu Carrinho</SheetTitle>
              <SheetDescription className="text-gray-400 text-xs">
                {(cartItems || []).length} {(cartItems || []).length === 1 ? 'item' : 'itens'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-none px-4 py-3 bg-white/5 border-b border-white/10 backdrop-blur-sm z-10 space-y-3">
          {/* Step 1: Client / Guest Info */}
          {user ? (
            <ClientSelector
              selectedClient={selectedClient}
              onSelect={(client) => {
                setSelectedClient(client);
                setSelectedRoute(null);
                setDeliveryInfo(prev => ({ ...prev, delivery_date: null }));
              }}
              className="shadow-none bg-black/40 text-white border-white/20"
            />
          ) : (
            <div className="space-y-3 p-3 bg-black/20 rounded-lg border border-white/10">
              <h3 className="text-xs font-bold text-[#FF6B35] uppercase tracking-wider mb-2">Seus Dados</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="pl-9 bg-[#1a1a1a] border-white/20 text-white h-9 text-sm"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="pl-9 bg-[#1a1a1a] border-white/20 text-white h-9 text-sm"
                      placeholder="(XX) 99999-9999"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">CPF / CNPJ (Opcional)</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      value={guestCnpj}
                      onChange={(e) => setGuestCnpj(e.target.value)}
                      className="pl-9 bg-[#1a1a1a] border-white/20 text-white h-9 text-sm"
                      placeholder="Documento"
                    />
                  </div>
                </div>

                <CitySelector
                  selectedCity={guestCity}
                  onSelectCity={(city) => {
                    setGuestCity(city);
                    setSelectedRoute(null);
                    setDeliveryInfo(prev => ({ ...prev, delivery_date: null }));
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Route Selection */}
          {targetCity && (
            <RotaSelector
              city={targetCity}
              selectedRoute={selectedRoute}
              onRouteSelect={handleRouteSelect}
            />
          )}

          {/* Step 3: Date Selection */}
          {selectedRoute && (
            <DeliveryDateSelector
              route={selectedRoute}
              cartItem={drivingCartItem} // pode ser null quando carrinho vazio
              selectedDate={deliveryInfo?.delivery_date}
              onDateSelect={(date) => {
                setDeliveryInfo(prev => ({ ...prev, delivery_date: date }));
              }}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0 bg-[#0a0a0a]">
          {(cartItems || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <ShoppingBag size={48} className="text-gray-600" />
              <div className="space-y-2">
                <p className="text-xl font-medium text-white">Carrinho vazio</p>
                <Button variant="link" onClick={handleContinueShopping} className="text-[#FF6B35] mt-4">
                  Ir para o Catálogo
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {(processedItems || []).map((item) => (
                <CartItemControls
                  key={item.codigo}
                  item={item}
                  onUpdateQuantity={updateItemQuantity}
                  onRemove={removeFromCart}
                  deliveryDate={deliveryInfo?.delivery_date}
                  validationStatus={validationStatuses[item.codigo]}
                />
              ))}
            </div>
          )}
        </div>

        {(cartItems || []).length > 0 && (
          <div className="flex-none bg-[#121212] border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] z-30 p-4 pb-6 safe-area-bottom">
            <div className="space-y-3 mb-4">
              {/* Stock Warning */}
              {Object.values(validationStatuses).some(s => s && !s.isValid) && (
                <div className="bg-red-900/20 border border-red-500/50 p-2 rounded text-red-200 text-xs flex items-center justify-between gap-2 animate-pulse">
                  <div className="flex items-center gap-2">
                    <AlertOctagon size={14} />
                    <span>Atenção: Estoque insuficiente na data selecionada!</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] border-red-500/30 hover:bg-red-900/30 text-red-100"
                    onClick={refreshStockValidation}
                  >
                    {isRefreshingStock ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  </Button>
                </div>
              )}

              {/* Discount Threshold Alert */}
              <div className={cn(
                "p-2.5 rounded-lg border text-xs font-bold flex items-center gap-2 transition-colors",
                isDiscountReached
                  ? "bg-green-900/20 border-green-500/40 text-green-400"
                  : "bg-orange-900/20 border-[#FF6B35]/40 text-[#FF6B35]"
              )}>
                {isDiscountReached ? (
                  <>
                    <PartyPopper size={16} />
                    <span>Parabéns! Você atingiu {DISCOUNT_THRESHOLD} unidades - Desconto aplicado!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} />
                    <span>Você tem {totalQuantity} unidades - Faltam {unitsToDiscount} para ganhar desconto!</span>
                  </>
                )}
              </div>

              <div className="flex justify-between items-end">
                <span className="text-sm text-gray-400">Total Estimado</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#FF6B35] block leading-none">
                    {formatMoney(totalValue)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium uppercase mt-1 block">
                    Peso Total: {Number(totalWeight || 0).toFixed(2)}kg
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                className="col-span-1 h-12 border-white/20 bg-transparent hover:bg-white/5 text-gray-300 hover:text-white p-0"
                onClick={handleContinueShopping}
              >
                <ArrowLeft size={20} />
              </Button>

              <Button
                className={cn(
                  "col-span-3 h-12 text-base font-bold text-white shadow-lg transition-all border-0",
                  (deliveryInfo?.delivery_date && !isValidatingOrder && !hasPriceError)
                    ? "bg-gradient-to-r from-[#FF6B35] to-[#FF8C42] hover:from-[#e55a2b] hover:to-[#e67e22] shadow-[#FF6B35]/20"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                )}
                onClick={handleConfirmOrderClick}
                disabled={!deliveryInfo?.delivery_date || isValidatingOrder || hasPriceError}
              >
                {isValidatingOrder ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Check className="mr-2 h-5 w-5" />
                )}
                {user ? 'FINALIZAR PEDIDO' : 'ENVIAR SOLICITAÇÃO'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ShoppingCart;

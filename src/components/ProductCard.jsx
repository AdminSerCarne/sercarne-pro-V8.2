import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart, Scale, Tag, Calendar, Info, Check, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { schlosserRules } from '@/domain/schlosserRules';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { getWeeklyStockSchedule, validateAndSuggestAlternativeDate } from '@/utils/stockValidator';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ProductCard = ({ product }) => {
  const { addToCart, setIsCartOpen, stockUpdateTrigger, deliveryInfo, cartItems } = useCart();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [loadingStock, setLoadingStock] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [weeklyStock, setWeeklyStock] = useState([]);

  // Determine Pricing
  const cartTotalUND = (cartItems || []).reduce((sum, i) => {
  const q = Number(i.quantidade ?? i.quantity ?? 0);
  return sum + (isNaN(q) ? 0 : q);
}, 0);

// UND total se eu adicionar este item agora
const totalUNDIfAdd = cartTotalUND + quantity;

const { price, tabName } = schlosserRules.getTabelaAplicada(totalUNDIfAdd, user, product.prices);

  const unit = product.unidade_estoque || 'UND';

  // Discount Logic
  const publicPrice = product.prices?.TAB3 || 0;
  let discountPercent = 0;
  if (user && publicPrice > 0) {
    discountPercent = ((publicPrice - price) / publicPrice) * 100;
  }
  const showDiscount = user && discountPercent > 1;

  // Metrics
  const tempItem = {
    ...product,
    quantidade: quantity,
    price: price,
    preco: price,
    peso: product.pesoMedio,
    tipoVenda: product.tipoVenda,
    unitType: unit
  };

  const { processedItems } = calculateOrderMetrics([tempItem]);
  const metrics = processedItems[0];
  const estimatedWeight = metrics.estimatedWeight;
  const estimatedSubtotal = metrics.estimatedValue;

  // Validations for safe display
  const isWeightValid = product.pesoMedio !== undefined && product.pesoMedio !== null && !isNaN(product.pesoMedio) && product.pesoMedio > 0;
  const isPriceValid = price !== undefined && price !== null && !isNaN(price) && price > 0;

  // ✅ Helper: pegar data de entrega real (aceita Date ou string)
  const getDeliveryDateStr = () => {
    const raw = deliveryInfo?.date || deliveryInfo?.delivery_date || deliveryInfo?.deliveryDate;

    if (!raw) return null;

    // Date object
    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) return null;
      return raw.toISOString().split('T')[0];
    }

    // string / timestamp
    const str = String(raw).trim();
    if (!str) return null;

    // Se já vier YYYY-MM-DD ou YYYY-MM-DDTHH...
    if (str.includes('T')) return str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // tenta parse genérico
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

    return null;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchStock = async () => {
      if (!product.codigo) return;

      // Optimization: Skip fetch if product is hidden, but keep hook call valid
      if (product.visivel === false) return;

      setLoadingStock(true);

      try {
        const schedule = await getWeeklyStockSchedule(product.codigo);
        if (isMounted) {
          setWeeklyStock(schedule);
        }
      } catch (error) {
        console.error(`Error fetching stock ${product.codigo}:`, error);
      } finally {
        if (isMounted) setLoadingStock(false);
      }
    };

    fetchStock();
    return () => { isMounted = false; };
  }, [product.codigo, stockUpdateTrigger, product.visivel]);

  const handleIncrement = () => setQuantity(prev => prev + 1);
  const handleDecrement = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const validateStock = async () => {
    const deliveryDateStr = getDeliveryDateStr();

    // ✅ Se não tiver data selecionada, trava
    if (!deliveryDateStr) {
      toast({
        title: "Selecione a data de entrega 📅",
        description: "Escolha a rota/data antes de adicionar produtos.",
        variant: "destructive",
        duration: 4500
      });
      return false;
    }

    const productCode = String(product.codigo).trim();

    // ✅ Evita bug number vs string no carrinho
    const existingItem = cartItems.find(i => String(i.codigo).trim() === productCode);
    const totalQty = (existingItem?.quantidade || 0) + quantity;

    const validation = await validateAndSuggestAlternativeDate(productCode, totalQty, deliveryDateStr);

    if (!validation.isValid) {
      const b = validation.breakdown || { base: 0, entradas: 0, pedidos: 0, available: 0 };
      const breakdownMsg = `Base: ${b.base} + Entradas: ${b.entradas} - Pedidos: ${b.pedidos} = Disponível: ${b.available}`;

      toast({
        title: `Apenas ${validation.availableQty ?? b.available ?? 0} UND disponível`,
        description: breakdownMsg,
        variant: "destructive",
        duration: 5500
      });

      if (validation.suggestedDate) {
        setTimeout(() => {
          toast({
            title: "Sugestão de Data",
            description: `Temos estoque a partir de ${format(parseISO(validation.suggestedDate), 'dd/MM/yyyy', { locale: ptBR })}.`,
            className: "bg-blue-600 text-white border-blue-700",
            duration: 5500
          });
        }, 600);
      }

      return false;
    }

    return true;
  };

  const handleAddToCart = async () => {
    setAddingToCart(true);
    const qtySnapshot = quantity;

    try {
      const isValid = await validateStock();
      if (!isValid) return;

      const productToAdd = { ...product, price: price, preco: price };
      addToCart(productToAdd, qtySnapshot);

      setQuantity(1);

      toast({
        title: "Produto adicionado ✅",
        description: `${qtySnapshot} ${unit} de ${product.descricao}`
      });
    } catch (error) {
      console.error("Add to cart error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível validar o estoque. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    const qtySnapshot = quantity;

    try {
      const isValid = await validateStock();
      if (!isValid) return;

      const productToAdd = { ...product, price: price, preco: price };
      addToCart(productToAdd, qtySnapshot);

      setQuantity(1);
      setIsCartOpen(true); // Open cart immediately
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível validar o estoque. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setCheckingOut(false);
    }
  };

  const formatMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatWeight = (value) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const displayImage = product.imagem || 'https://via.placeholder.com/300?text=Sem+Imagem';

  // Calculate if item is totally out for next 7 days
  const isTotallyOutOfStock = !loadingStock && weeklyStock.every(d => d.qty <= 0);

  // Visibility Safety Check
  if (product.visivel === false) return null;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col h-[620px] border border-gray-100 group">
      {/* Fixed Height Image Container */}
      <div className="relative h-[200px] w-full bg-white p-4 flex items-center justify-center border-b border-gray-50 flex-shrink-0">
        <img
          src={displayImage}
          alt={product.descricao}
          className="h-full w-auto object-contain mix-blend-multiply transition-transform group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute bottom-2 left-2">
          <Badge className="bg-[#FF6B35] hover:bg-[#FF6B35] text-white font-mono font-bold text-xs px-2 shadow-sm rounded-sm">
            #{product.codigo}
          </Badge>
        </div>
        {showDiscount && (
          <div className="absolute top-2 right-2 animate-in zoom-in spin-in-3">
            <Badge className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-2 py-1 shadow-md border border-green-700">
              {discountPercent.toFixed(0)}% OFF
            </Badge>
          </div>
        )}
      </div>

      {/* Content - Flex Grow to fill space */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Title Section */}
        <div className="mb-4 h-[3.5rem]">
          <h3 className="font-bold text-gray-900 leading-tight text-sm uppercase mb-1 line-clamp-2" title={product.descricao}>
            {product.descricao}
          </h3>
          {product.descricao_complementar && (
            <p className="text-xs text-gray-500 font-medium uppercase leading-snug line-clamp-1 overflow-hidden text-ellipsis">
              {product.descricao_complementar}
            </p>
          )}
        </div>

        {/* Price & Info Section */}
        <div className="mb-2">
          <div className="flex flex-col mb-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#FF6B35]">{formatMoney(price)}</span>
              <span className="text-xs text-gray-400 font-bold uppercase">/ KG</span>
            </div>

            {/* Discount Label */}
            <div className="h-5">
              {showDiscount && (
                <div className="flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded w-fit border border-green-100 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  <Tag size={10} className="flex-shrink-0" />
                  <span title="20% abaixo do preço público">{discountPercent.toFixed(0)}% abaixo do preço público</span>
                </div>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded text-[10px] font-bold text-gray-500 uppercase mt-1">
            <Scale size={10} />
            Médio: {formatWeight(product.pesoMedio || 0)} kg
          </div>
        </div>

        {/* Stock Availability Section */}
        <div className="mb-2 h-[60px] flex flex-col justify-end">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar size={12} className="text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
              Disponibilidade (7 dias)
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><Info size={10} className="text-gray-300" /></TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Estoque futuro confirmado.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {loadingStock ? (
            <div className="flex gap-1 overflow-hidden pb-1">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 w-12 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {weeklyStock.slice(0, 5).map((stock, idx) => {
                const dateObj = parseISO(stock.date);
                const isAvailable = stock.qty >= quantity;
                const isZero = stock.qty <= 0;

                return (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`
                          flex flex-col items-center justify-center min-w-[40px] px-1 py-1 rounded border text-[9px] cursor-help
                          ${isAvailable
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : (isZero ? 'bg-gray-50 border-gray-100 text-gray-300' : 'bg-red-50 border-red-200 text-red-800')
                          }
                        `}>
                          <span className="font-bold uppercase mb-0.5">{format(dateObj, 'dd/MM')}</span>
                          <span className="font-bold text-[10px]">{stock.qty}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-[10px]">
                        <p>{format(dateObj, "dd 'de' MMMM", { locale: ptBR })}</p>
                        <p className="font-bold">Disponível: {stock.qty} UND</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}
        </div>

        {/* Spacer to push controls to bottom */}
        <div className="flex-grow"></div>

        {/* Controls & Add Buttons */}
        <div className="space-y-2 pt-2 border-t border-gray-100 mt-auto">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1 border border-gray-200 h-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDecrement}
              disabled={quantity <= 1 || isTotallyOutOfStock || addingToCart || checkingOut}
              className="h-6 w-8 text-gray-500 hover:text-gray-900 hover:bg-white"
            >
              <Minus size={12} />
            </Button>
            <div className="flex flex-col items-center">
              <span className="font-bold text-base text-gray-900 leading-none">{quantity}</span>
              <span className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">{unit}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleIncrement}
              disabled={isTotallyOutOfStock || addingToCart || checkingOut}
              className="h-6 w-8 text-gray-500 hover:text-gray-900 hover:bg-white"
            >
              <Plus size={12} />
            </Button>
          </div>

          {/* Estimates Display */}
          <div className="bg-[#FFF8F4] rounded px-2 py-1.5 space-y-0.5 border border-orange-100/50">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Peso Est.:</span>
              <span className="font-medium text-gray-700">
                {isWeightValid ? `${formatWeight(estimatedWeight)} kg` : '--'}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 border-t border-orange-100 pt-0.5 mt-0.5">
              <span className="font-bold text-[#FF6B35]">Subtotal:</span>
              <span className="font-bold text-[#FF6B35]">
                {isWeightValid && isPriceValid ? formatMoney(estimatedSubtotal) : '--'}
              </span>
            </div>
          </div>

          {/* Dual Buttons */}
          <div className="flex gap-2 h-10">
            <Button
              className="flex-1 h-full bg-[#FF6B35] hover:bg-[#E65100] text-white font-semibold text-sm rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed px-1"
              onClick={handleAddToCart}
              disabled={isTotallyOutOfStock || addingToCart || checkingOut}
              title="Adicionar ao carrinho e continuar comprando"
            >
              {addingToCart ? <Loader2 size={16} className="animate-spin" /> : (
                <div className="flex items-center justify-center gap-1.5">
                  <ShoppingCart size={16} />
                  <span className="leading-tight">Carrinho</span>
                </div>
              )}
            </Button>

            <Button
              className="flex-1 h-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed px-1"
              onClick={handleCheckout}
              disabled={isTotallyOutOfStock || addingToCart || checkingOut}
              title="Adicionar e finalizar pedido agora"
            >
              {checkingOut ? <Loader2 size={16} className="animate-spin" /> : (
                <div className="flex items-center justify-center gap-1.5">
                  <Check size={16} />
                  <span className="leading-tight">Finalizar</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

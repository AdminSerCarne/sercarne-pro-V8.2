import React, { useState, useEffect, useMemo } from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ProductCard = ({ product }) => {
  const { addToCart, setIsCartOpen, stockUpdateTrigger, deliveryInfo, cartItems } = useCart();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [loadingStock, setLoadingStock] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [weeklyStock, setWeeklyStock] = useState([]);

  // ✅ Derivados seguros
  const productCodigo = product?.codigo ?? null;
  const isVisible = product?.visivel !== false;
  const shouldRender = Boolean(product && isVisible);

  // ✅ Galeria de imagens
  const gallery = useMemo(() => {
    const arr = Array.isArray(product?.images) ? product.images : [];
    const cleaned = arr.filter(Boolean);
    if (cleaned.length > 0) return cleaned;
    if (product?.imagem) return [product.imagem];
    return ['https://via.placeholder.com/300?text=Sem+Imagem'];
  }, [product?.images, product?.imagem]);

  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
  }, [productCodigo]);

  const displayImage = gallery[Math.min(imgIndex, Math.max(gallery.length - 1, 0))] || gallery[0];
  const brandOverlay = product?.brandImage || '';

  const nextImage = () => {
    if (!gallery || gallery.length <= 1) return;
    setImgIndex((prev) => (prev + 1) % gallery.length);
  };

  // ✅ Pricing
  const cartTotalUND = useMemo(() => {
    return (cartItems || []).reduce((sum, i) => {
      const q = Number(i?.quantidade ?? i?.quantity ?? i?.quantity_unit ?? 0);
      return sum + (Number.isFinite(q) ? q : 0);
    }, 0);
  }, [cartItems]);

  const totalUNDIfAdd = cartTotalUND + quantity;

  const pricesObj = product?.prices || {};
  const { price, tabName } = useMemo(() => {
    return schlosserRules.getTabelaAplicada(totalUNDIfAdd, user, pricesObj);
  }, [totalUNDIfAdd, user, pricesObj]);

  const unit = product?.unidade_estoque || 'UND';

  // Discount Logic
  const publicPrice = Number(product?.prices?.TAB3 || 0);
  const discountPercent = useMemo(() => {
    if (!user) return 0;
    if (!(publicPrice > 0)) return 0;
    const p = Number(price || 0);
    if (!(p > 0)) return 0;
    return ((publicPrice - p) / publicPrice) * 100;
  }, [user, publicPrice, price]);

  const showDiscount = Boolean(user && discountPercent > 1);

  // Metrics
  const tempItem = useMemo(() => {
    if (!product) return null;

    return {
      ...product,
      quantidade: quantity,
      price: price,
      preco: price,
      peso: product.pesoMedio,
      tipoVenda: product.tipoVenda,
      unitType: unit,
    };
  }, [product, quantity, price, unit]);

  const { processedItems } = useMemo(() => {
    if (!tempItem) return { processedItems: [] };
    return calculateOrderMetrics([tempItem]);
  }, [tempItem]);

  const metrics = processedItems?.[0] || {};
  const estimatedWeight = Number(metrics.estimatedWeight || 0);
  const estimatedSubtotal = Number(metrics.estimatedValue || 0);

  const isWeightValid = Number(product?.pesoMedio || 0) > 0;
  const isPriceValid = Number(price || 0) > 0;

  // ✅ Helper: pegar data de entrega real (aceita Date ou string)
  const getDeliveryDateStr = () => {
    const raw = deliveryInfo?.date || deliveryInfo?.delivery_date || deliveryInfo?.deliveryDate;
    if (!raw) return null;

    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) return null;
      return raw.toISOString().split('T')[0];
    }

    const str = String(raw).trim();
    if (!str) return null;

    if (str.includes('T')) return str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

    return null;
  };

  // ✅ Buscar agenda de estoque (7 dias)
  useEffect(() => {
    let isMounted = true;

    const fetchStock = async () => {
      if (!productCodigo || !isVisible) {
        if (isMounted) {
          setWeeklyStock([]);
          setLoadingStock(false);
        }
        return;
      }

      setLoadingStock(true);

      try {
        const schedule = await getWeeklyStockSchedule(productCodigo);
        if (isMounted) setWeeklyStock(Array.isArray(schedule) ? schedule : []);
      } catch (error) {
        console.error(`Error fetching stock ${productCodigo}:`, error);
        if (isMounted) setWeeklyStock([]);
      } finally {
        if (isMounted) setLoadingStock(false);
      }
    };

    fetchStock();

    return () => {
      isMounted = false;
    };
  }, [productCodigo, isVisible, stockUpdateTrigger]);

  const handleIncrement = () => setQuantity((prev) => prev + 1);
  const handleDecrement = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  /**
   * ✅ VALIDAR ESTOQUE SÓ QUANDO EXISTE DATA
   * - Se não tem data, não valida e NÃO bloqueia (regra V8.3)
   * - Validação forte fica no carrinho ao FINALIZAR PEDIDO
   */
  const validateStockIfHasDate = async () => {
    const deliveryDateStr = getDeliveryDateStr();
    if (!deliveryDateStr) return true; // ✅ SEM DATA: NÃO BLOQUEIA

    const productCode = String(productCodigo || '').trim();
    if (!productCode) return false;

    const existingItem = (cartItems || []).find((i) => String(i.codigo).trim() === productCode);
    const totalQty = Number(existingItem?.quantidade || 0) + quantity;

    const validation = await validateAndSuggestAlternativeDate(productCode, totalQty, deliveryDateStr);

    if (!validation?.isValid) {
      const b = validation?.breakdown || { base: 0, entradas: 0, pedidos: 0, available: 0 };
      const breakdownMsg = `Base: ${b.base} + Entradas: ${b.entradas} - Pedidos: ${b.pedidos} = Disponível: ${b.available}`;

      toast({
        title: `Apenas ${validation?.availableQty ?? b.available ?? 0} UND disponível`,
        description: breakdownMsg,
        variant: 'destructive',
        duration: 5500,
      });

      if (validation?.suggestedDate) {
        setTimeout(() => {
          toast({
            title: 'Sugestão de Data',
            description: `Temos estoque a partir de ${format(
              parseISO(validation.suggestedDate),
              'dd/MM/yyyy',
              { locale: ptBR }
            )}.`,
            className: 'bg-blue-600 text-white border-blue-700',
            duration: 5500,
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
      const ok = await validateStockIfHasDate(); // ✅ só valida se já tiver data
      if (!ok) return;

      const productToAdd = { ...product, price: price, preco: price };
      addToCart(productToAdd, qtySnapshot);

      setQuantity(1);

      toast({
        title: 'Produto adicionado ✅',
        description: `${qtySnapshot} ${unit} de ${product?.descricao || 'produto'}`,
      });
    } catch (error) {
      console.error('Add to cart error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível validar o estoque. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    const qtySnapshot = quantity;

    try {
      const ok = await validateStockIfHasDate(); // ✅ só valida se já tiver data
      if (!ok) return;

      const productToAdd = { ...product, price: price, preco: price };
      addToCart(productToAdd, qtySnapshot);

      setQuantity(1);
      setIsCartOpen(true);

      // ✅ Se ainda não tem data, só orienta
      const deliveryDateStr = getDeliveryDateStr();
      if (!deliveryDateStr) {
        toast({
          title: 'Quase lá 😄',
          description: 'Agora selecione Cliente, Rota e Data de entrega para finalizar.',
          duration: 4500,
        });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível validar o estoque. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCheckingOut(false);
    }
  };

  const formatMoney = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const formatWeight = (value) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

  const isTotallyOutOfStock =
    !loadingStock &&
    Array.isArray(weeklyStock) &&
    weeklyStock.length > 0 &&
    weeklyStock.every((d) => Number(d?.qty || 0) <= 0);

  if (!shouldRender) return null;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col h-[620px] border border-gray-100 group">
      <div className="relative h-[200px] w-full bg-white p-4 flex items-center justify-center border-b border-gray-50 flex-shrink-0">
        <button
          type="button"
          onClick={nextImage}
          className="w-full h-full flex items-center justify-center"
          title={gallery.length > 1 ? 'Clique para ver mais fotos' : 'Foto do produto'}
        >
          <img
            src={displayImage}
            alt={product?.descricao || 'Produto'}
            className="h-full w-auto object-contain mix-blend-multiply transition-transform group-hover:scale-105"
            loading="lazy"
          />
        </button>

        {brandOverlay && (
          <div className="absolute top-2 left-2 bg-white/90 border border-gray-100 rounded-md px-1.5 py-1 shadow-sm">
            <img src={brandOverlay} alt={product?.brandName || 'Marca'} className="h-6 w-auto object-contain" loading="lazy" />
          </div>
        )}

        <div className="absolute bottom-2 left-2">
          <Badge className="bg-[#FF6B35] hover:bg-[#FF6B35] text-white font-mono font-bold text-xs px-2 shadow-sm rounded-sm">
            #{productCodigo}
          </Badge>
        </div>

        {showDiscount && (
          <div className="absolute top-2 right-2 animate-in zoom-in spin-in-3">
            <Badge className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-2 py-1 shadow-md border border-green-700">
              {discountPercent.toFixed(0)}% OFF
            </Badge>
          </div>
        )}

        {gallery.length > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/80 border border-gray-100 rounded-full px-2 py-1 shadow-sm">
            {gallery.slice(0, 3).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImgIndex(i)}
                className={`h-2 w-2 rounded-full ${i === imgIndex ? 'bg-[#FF6B35]' : 'bg-gray-300'}`}
                aria-label={`Foto ${i + 1}`}
                title={`Foto ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <div className="mb-4 h-[3.5rem]">
          <h3 className="font-bold text-gray-900 leading-tight text-sm uppercase mb-1 line-clamp-2" title={product?.descricao}>
            {product?.descricao}
          </h3>
          {product?.descricao_complementar && (
            <p className="text-xs text-gray-500 font-medium uppercase leading-snug line-clamp-1 overflow-hidden text-ellipsis">
              {product.descricao_complementar}
            </p>
          )}
        </div>

        <div className="mb-2">
          <div className="flex flex-col mb-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#FF6B35]">{formatMoney(price)}</span>
              <span className="text-xs text-gray-400 font-bold uppercase">/ KG</span>
            </div>

            <div className="h-5">
              {showDiscount && (
                <div className="flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded w-fit border border-green-100 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  <Tag size={10} className="flex-shrink-0" />
                  <span title={`Tabela aplicada: ${tabName}`}>{discountPercent.toFixed(0)}% abaixo do preço público</span>
                </div>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded text-[10px] font-bold text-gray-500 uppercase mt-1">
            <Scale size={10} />
            Médio: {formatWeight(product?.pesoMedio || 0)} kg
          </div>
        </div>

        <div className="mb-2 h-[60px] flex flex-col justify-end">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar size={12} className="text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Disponibilidade (7 dias)</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info size={10} className="text-gray-300" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Estoque futuro confirmado.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {loadingStock ? (
            <div className="flex gap-1 overflow-hidden pb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 w-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {(weeklyStock || []).slice(0, 5).map((stock, idx) => {
                const dateObj = parseISO(stock.date);
                const isAvailable = Number(stock.qty || 0) >= quantity;
                const isZero = Number(stock.qty || 0) <= 0;

                return (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`
                            flex flex-col items-center justify-center min-w-[40px] px-1 py-1 rounded border text-[9px] cursor-help
                            ${
                              isAvailable
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : isZero
                                ? 'bg-gray-50 border-gray-100 text-gray-300'
                                : 'bg-red-50 border-red-200 text-red-800'
                            }
                          `}
                        >
                          <span className="font-bold uppercase mb-0.5">{format(dateObj, 'dd/MM')}</span>
                          <span className="font-bold text-[10px]">{Number(stock.qty || 0)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-[10px]">
                        <p>{format(dateObj, "dd 'de' MMMM", { locale: ptBR })}</p>
                        <p className="font-bold">Disponível: {Number(stock.qty || 0)} UND</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-grow"></div>

        <div className="space-y-2 pt-2 border-t border-gray-100 mt-auto">
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

          <div className="bg-[#FFF8F4] rounded px-2 py-1.5 space-y-0.5 border border-orange-100/50">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Peso Est.:</span>
              <span className="font-medium text-gray-700">{isWeightValid ? `${formatWeight(estimatedWeight)} kg` : '--'}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 border-t border-orange-100 pt-0.5 mt-0.5">
              <span className="font-bold text-[#FF6B35]">Subtotal:</span>
              <span className="font-bold text-[#FF6B35]">{isWeightValid && isPriceValid ? formatMoney(estimatedSubtotal) : '--'}</span>
            </div>
          </div>

          <div className="flex gap-2 h-10">
            <Button
              className="flex-1 h-full bg-[#FF6B35] hover:bg-[#E65100] text-white font-semibold text-sm rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed px-1"
              onClick={handleAddToCart}
              disabled={isTotallyOutOfStock || addingToCart || checkingOut}
              title="Adicionar ao carrinho e continuar comprando"
            >
              {addingToCart ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
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
              title="Adicionar e abrir o carrinho"
            >
              {checkingOut ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
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

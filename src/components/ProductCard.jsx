//import React, { useState, useEffect, useMemo } from 'react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
//import { Plus, Minus, ShoppingCart, Scale, Tag, Calendar, Info, Check, Loader2 } from 'lucide-react';
import { Plus, Minus, ShoppingCart, Scale, Tag, Calendar, Info, Check, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { schlosserRules } from '@/domain/schlosserRules';
import { resolveProductUnitType } from '@/domain/unitType';
import { calculateOrderMetrics } from '@/utils/calculateOrderMetrics';
import { getWeeklyStockSchedule, validateAndSuggestAlternativeDate } from '@/utils/stockValidator';
import { toISODateLocal } from '@/utils/dateUtils';
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


  // ✅ NOVO: tick local pra forçar refetch do schedule ao cancelar/reativar no dashboard
  const [stockRefreshTick, setStockRefreshTick] = useState(0);

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
  const touchStartX = React.useRef(0);
  const touchEndX = React.useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const didSwipeRef = React.useRef(false);
  const [slideDir, setSlideDir] = useState('next'); // 'next' | 'prev'

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  useEffect(() => {
    if (!isLightboxOpen) return;
  
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };
  
    window.addEventListener('keydown', onKeyDown);
  
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isLightboxOpen]);
  
  useEffect(() => {
    setImgIndex(0);
  }, [productCodigo]);

  const displayImage = gallery[Math.min(imgIndex, Math.max(gallery.length - 1, 0))] || gallery[0];
  const brandOverlay = product?.brandImage || '';

  const nextImage = () => {
    if (!gallery || gallery.length <= 1) return;
    setSlideDir('next');
    setImgIndex((prev) => (prev + 1) % gallery.length);
  };
  
  const prevImage = () => {
    if (!gallery || gallery.length <= 1) return;
    setSlideDir('prev');
    setImgIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  const SWIPE_THRESHOLD = 40; // sensibilidade (px)
  
  const onTouchStart = (e) => {
    if (!gallery || gallery.length <= 1) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchEndX.current = t.clientX;
    touchStartY.current = t.clientY;
    touchEndY.current = t.clientY;
  };
  
  const onTouchMove = (e) => {
    if (!gallery || gallery.length <= 1) return;
      const t = e.touches[0];
      touchEndX.current = t.clientX;
      touchEndY.current = t.clientY;
  };

  const TAP_THRESHOLD = 8;        // toque real: mexeu muito pouco
  const VERTICAL_THRESHOLD = 14;  // scroll: mexeu o suficiente no Y
  
  const onTouchEnd = (e) => {
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;
  
    // reset
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartY.current = 0;
    touchEndY.current = 0;
  
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
  
    // 1) Arrasto vertical (scroll): NÃO abre modal, não troca imagem
    if (absY > VERTICAL_THRESHOLD && absY > absX) {
      didSwipeRef.current = false;
      return;
    }
  
    // 2) Toque (tap): abre modal
    if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
      setIsLightboxOpen(true);
      return;
    }
  
    // 3) Swipe horizontal: troca imagem
    if (absX >= SWIPE_THRESHOLD && absX > absY) {
      didSwipeRef.current = true;
      e.preventDefault();
      e.stopPropagation();
  
      if (deltaX > 0) prevImage();
      else nextImage();
    }
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
  const { price } = useMemo(() => {
    return schlosserRules.getTabelaAplicada(totalUNDIfAdd, user, pricesObj);
  }, [totalUNDIfAdd, user, pricesObj]);

  const unit = resolveProductUnitType(product, 'UND');
  const isPctSale = unit === 'PCT';

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
  const displayWeightLabel = isPctSale || unit === 'CX' ? 'Peso Padrão:' : 'Médio:';
  const displayWeightValue = unit === 'CX' ? 10 : Number(product?.pesoMedio || 0);

  const isWeightValid = Number(product?.pesoMedio || 0) > 0;
  const isPriceValid = Number(price || 0) > 0;
  const canShowSubtotal = isPriceValid && (isWeightValid || isPctSale);

  // ✅ Helper: pegar data de entrega real (aceita Date ou string)
  const getDeliveryDateStr = () => {
    const raw = deliveryInfo?.date || deliveryInfo?.delivery_date || deliveryInfo?.deliveryDate;
    return toISODateLocal(raw);
  };

  // ✅ NOVO: escuta evento do dashboard + storage (cross-tab)
  useEffect(() => {
    const bump = () => setStockRefreshTick(Date.now());

    const onStorage = (e) => {
      if (e.key === 'schlosser_stock_update') bump();
    };

    window.addEventListener('schlosser:stock-updated', bump);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('schlosser:stock-updated', bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

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
    // ✅ inclui stockRefreshTick pra atualizar ao CANCELAR/REATIVAR no dashboard
  }, [productCodigo, isVisible, stockUpdateTrigger, stockRefreshTick]);

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
          onClick={(e) => {
            if (didSwipeRef.current) {
              didSwipeRef.current = false;
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            setIsLightboxOpen(true);
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="w-full h-full flex items-center justify-center"
          title={gallery.length > 1 ? 'Clique para ver mais fotos' : 'Foto do produto'}
        >
          <img
            key={imgIndex}
            src={displayImage}
            alt={product?.descricao || 'Produto'}
            className={`h-full w-auto object-contain mix-blend-multiply transition-transform group-hover:scale-105 ${
              slideDir === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'
            }`}
            loading="lazy"
          />
        </button>
        {gallery.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 border border-gray-300 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white"
              aria-label="Foto anterior"
              title="Anterior"
            >
              <span className="text-xl leading-none">&lt;</span>
            </button>
        
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 border border-gray-300 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white"
              aria-label="Próxima foto"
              title="Próxima"
            >
              <span className="text-xl leading-none">&gt;</span>
            </button>
          </>
        )}

        {isLightboxOpen && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 md:pt-24">
            {/* Fundo com blur + fechar ao clicar fora */}
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Fechar visualização"
              onClick={() => setIsLightboxOpen(false)}
            />
              <div className="relative z-10 w-[95vw] max-w-5xl h-[calc(100vh-6rem)] md:h-[calc(100vh-7rem)] flex flex-col">
              {/* Botão fechar */}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="absolute top-6 right-3 md:top-8 md:right-4 w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow flex items-center justify-center z-30"
                aria-label="Fechar"
                title="Fechar"
              >
                <X className="w-5 h-5 text-gray-800" />
              </button>
        
              {/* Botões navegação */}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow flex items-center justify-center z-30"
                    aria-label="Foto anterior"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-800" />
                  </button>
        
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow flex items-center justify-center z-30"
                    aria-label="Próxima foto"
                    title="Próxima"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-800" />
                  </button>
                </>
              )}
        
              {/* Área útil da imagem (não encosta no X nem no contador) */}
              <div className="relative flex-1 min-h-0 w-full">
                <div
                  className="absolute inset-0 z-10 px-2 md:px-4 pt-16 md:pt-20 pb-24 md:pb-28 flex items-center justify-center select-none"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <img
                    key={`lightbox-${imgIndex}`}
                    src={displayImage}
                    alt={product?.descricao || 'Produto'}
                    className={`max-h-full max-w-full object-contain ${
                      slideDir === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'
                    }`}
                    draggable={false}
                  />
                </div>
              </div>
        
              {/* Contador */}
              {gallery.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/90 text-sm bg-black/30 px-3 py-1 rounded-full z-20">
                  {imgIndex + 1} / {gallery.length}
                </div>
              )}
            </div>
          </div>
        )}

        
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
              <span className="text-xs text-gray-400 font-bold uppercase">/ {isPctSale ? 'PCT' : 'KG'}</span>
            </div>

            <div className="h-5">
              {showDiscount && (
                <div className="flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded w-fit border border-green-100 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  <Tag size={10} className="flex-shrink-0" />
                  <span>{discountPercent.toFixed(0)}% abaixo do preço público</span>
                </div>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded text-[10px] font-bold text-gray-500 uppercase mt-1">
            <Scale size={10} />
            {displayWeightLabel} {formatWeight(displayWeightValue)} kg
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
                        <p className="font-bold">Disponível: {Number(stock.qty || 0)} {unit}</p>
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
              <span className="font-bold text-[#FF6B35]">{canShowSubtotal ? formatMoney(estimatedSubtotal) : '--'}</span>
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

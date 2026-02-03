import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Package, ShoppingCart, Loader2, Save, History, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import ProductCard from '@/components/ProductCard';
import SearchBar from '@/components/SearchBar';
import CartStockValidator from '@/components/CartStockValidator';
import ClientSelector from '@/components/ClientSelector';
import CitySelector from '@/components/CitySelector';
import CheckoutModal from '@/components/CheckoutModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { schlosserApi } from '@/services/schlosserApi';
import { useToast } from '@/components/ui/use-toast';
import { useProducts } from '@/hooks/useProducts';

const ClienteDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clientData, publicCity, selectClient, selectCity, role, isPublic } = useAuth();
  const { products, loading, error, refreshProducts } = useProducts();
  
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog'); 
  const [showSelector, setShowSelector] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    // Initial selector check
    if (isPublic) {
        if (!publicCity) setShowSelector(true);
    } else {
        if (!clientData) setShowSelector(true);
    }

    const saved = localStorage.getItem('schlosser_client_orders');
    if (saved) setOrders(JSON.parse(saved));
  }, [clientData, publicCity, isPublic]);

  useEffect(() => {
    if (products) setFilteredProducts(products);
  }, [products]);

  const handleSelection = (data) => {
      if (isPublic) {
          selectCity(data);
          toast({ title: "Cidade Selecionada", description: `Mostrando rotas para ${data.name}` });
      } else {
          selectClient(data);
          toast({ title: `Bem-vindo, ${data.nome}!`, description: `Rota identificada: ${data.rota}` });
      }
      setShowSelector(false);
  };

  const handleSearch = useCallback((term) => {
    if (!term) {
      setFilteredProducts(products);
      return;
    }
    if (!products) return;
    const lowerTerm = term.toLowerCase();
    const filtered = products.filter(p => 
      (p.sku && p.sku.toString().toLowerCase().includes(lowerTerm)) || 
      (p.descricao && p.descricao.toLowerCase().includes(lowerTerm))
    );
    setFilteredProducts(filtered);
  }, [products]);

  const handleAddToCart = (product, quantity) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.sku === product.sku);
      if (existing) {
        return prev.map(item => item.product.sku === product.sku ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { product, quantity }];
    });
    toast({ title: "Adicionado ao Carrinho", description: `${quantity}x ${product.descricao}` });
  };

  const updateCartQuantity = (sku, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => item.product.sku !== sku));
    } else {
      setCart(prev => prev.map(item => item.product.sku === sku ? { ...item, quantity: newQty } : item));
    }
  };

  const removeFromCart = (sku) => setCart(prev => prev.filter(item => item.product.sku !== sku));

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + schlosserApi.calculateLineItem(item.product, item.quantity).total, 0);
  };

  const handleProceedCheckout = () => {
      if (cart.length === 0 || !selectedDate) return;
      
      if (isPublic) {
          setShowCheckoutModal(true);
      } else {
          // Direct submission for vendors
          handleSubmitOrder(clientData);
      }
  };

  const handleSubmitOrder = async (finalClientData) => {
    // Validate stock one last time
    let stockOk = true;
    for (const item of cart) {
         const data = await schlosserApi.calculateStockForDates(item.product.sku, item.product.estoque, [selectedDate]);
         if (data[0].available < item.quantity) stockOk = false;
    }

    if (!stockOk) {
        toast({ title: "Estoque Alterado", description: "O estoque mudou enquanto você comprava. Verifique os itens.", variant: "destructive" });
        return;
    }

    // Use shared creation logic
    const order = await schlosserApi.createOrder({
        items: cart,
        clientData: { 
            ...finalClientData, 
            municipio: isPublic ? publicCity.name : finalClientData.municipio 
        },
        deliveryDate: selectedDate.toISOString(),
        total: calculateTotal()
    });
    
    // Update local state
    const saved = localStorage.getItem('schlosser_client_orders');
    if (saved) setOrders(JSON.parse(saved));
    
    setCart([]);
    navigate(`/pedido-reservado/${order.id}`);
  };

  return (
    <>
      <Helmet><title>Catálogo Inteligente - Schlosser</title></Helmet>
      
      {/* Dynamic Selector based on Role */}
      {isPublic ? (
          <CitySelector isOpen={showSelector} onSelect={handleSelection} />
      ) : (
          <ClientSelector isOpen={showSelector} onSelect={handleSelection} />
      )}
      
      <CheckoutModal 
          isOpen={showCheckoutModal} 
          onClose={() => setShowCheckoutModal(false)}
          onConfirm={handleSubmitOrder}
          totalValue={calculateTotal()}
      />

      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          
          <div className="flex justify-center py-2 sm:py-4 mb-2 sm:mb-4">
             <img src="https://horizons-cdn.hostinger.com/f5e592ff-4b11-4a06-90fa-42f9bf225481/397ded07bc0d16ac56be08a6f09b61d9.png" alt="Schlosser Logo" className="w-[140px] sm:w-[180px] h-auto object-contain"/>
          </div>

          <div className="sticky top-16 sm:top-20 z-30 bg-gray-50/95 backdrop-blur-sm pt-2 pb-2 -mx-4 px-4 shadow-sm mb-4 transition-all border-b border-gray-100">
             <div className="max-w-7xl mx-auto">
                <div className="mb-3 flex items-center justify-between bg-white p-2.5 rounded-lg border border-orange-100 shadow-sm">
                    <div className="flex-1 min-w-0 mr-2">
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">
                            {isPublic ? 'Cidade Selecionada' : 'Cliente Selecionado'}
                        </p>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base truncate">
                            {isPublic ? (
                                <>
                                  <span className="truncate">{publicCity ? publicCity.name : 'Selecione...'}</span>
                                  {publicCity && <span className="text-[10px] font-normal bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full whitespace-nowrap hidden sm:inline-block">Rota Publica</span>}
                                </>
                            ) : (
                                <>
                                  <span className="truncate">{clientData ? clientData.nome : 'Selecione...'}</span>
                                  {clientData && <span className="text-[10px] font-normal bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full whitespace-nowrap hidden sm:inline-block">{clientData.rota?.split(' - ')[0]}</span>}
                                </>
                            )}
                        </h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowSelector(true)} className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 text-xs sm:text-sm h-8">Trocar</Button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="flex bg-white p-1 rounded-lg shadow-sm border border-gray-100 w-full md:w-auto overflow-x-auto no-scrollbar">
                      <button onClick={() => setActiveTab('catalog')} className={`flex-1 md:flex-none whitespace-nowrap px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'catalog' ? 'bg-[#FF8C42] text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                        <Package className="w-3.5 h-3.5 inline mr-2" /> Catálogo
                      </button>
                      <button onClick={() => setActiveTab('cart')} className={`flex-1 md:flex-none whitespace-nowrap px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'cart' ? 'bg-[#FF8C42] text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                        <ShoppingCart className="w-3.5 h-3.5 inline mr-2" /> Carrinho ({cart.reduce((a, b) => a + b.quantity, 0)})
                      </button>
                      <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none whitespace-nowrap px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'history' ? 'bg-[#FF8C42] text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                        <History className="w-3.5 h-3.5 inline mr-2" /> Histórico
                      </button>
                    </div>
                </div>

                {activeTab === 'catalog' && (
                  <div className="mt-3 flex gap-2">
                    <div className="flex-1"><SearchBar onSearch={handleSearch} /></div>
                    <Button onClick={refreshProducts} variant="outline" disabled={loading} className="border-gray-200 bg-white shadow-sm">
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                )}
             </div>
          </div>

          {activeTab === 'catalog' && (
            <div className="space-y-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 animate-spin text-[#FF8C42] mb-4" />
                  <p className="text-gray-500 animate-pulse">Carregando catálogo e disponibilidade...</p>
                </div>
              ) : filteredProducts && filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {filteredProducts.map((product, index) => (
                    <ProductCard 
                      key={`${product.sku}-${index}`} 
                      product={product} 
                      role="public" 
                      onAddToCart={handleAddToCart}
                      selectedDate={selectedDate} 
                      reservedQuantity={0}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500 bg-white rounded-lg border border-dashed border-gray-200">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  Nenhum produto encontrado.
                </div>
              )}
            </div>
          )}

          {activeTab === 'cart' && (
            <div className="max-w-5xl mx-auto">
              {cart.length > 0 ? (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                    <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Finalizar Pedido</h2>
                    </div>
                    
                    <div className="p-4 sm:p-6">
                        <CartStockValidator 
                            cart={cart}
                            routeName={isPublic ? publicCity?.routeId : clientData?.rota}
                            city={isPublic ? publicCity?.name : null}
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                            onUpdateQuantity={updateCartQuantity}
                            onRemove={removeFromCart}
                        />
                        
                        <div className="mt-8 pt-6 border-t border-gray-100 sticky bottom-0 bg-white pb-safe z-10">
                            <div className="flex justify-between items-end mb-4 sm:mb-6">
                                <span className="text-gray-600 font-medium text-sm sm:text-base">Total Estimado:</span>
                                <span className="text-2xl sm:text-3xl font-bold text-[#FF8C42]">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}
                                </span>
                            </div>
                            
                            <Button 
                                onClick={handleProceedCheckout} 
                                className="w-full bg-[#FF8C42] hover:bg-[#E67E22] text-white py-4 sm:py-6 text-base sm:text-lg shadow-lg hover:shadow-xl transition-all rounded-xl font-bold"
                                disabled={!selectedDate}
                            >
                                <Save className="w-5 h-5 mr-2" /> 
                                {selectedDate ? (isPublic ? 'Continuar para Dados' : 'Confirmar Reserva') : 'Selecione uma data acima'}
                            </Button>
                        </div>
                    </div>
                </div>
              ) : (
                <div className="p-12 sm:p-20 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                    <ShoppingCart className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-500 text-base sm:text-lg">Seu carrinho está vazio.</p>
                    <Button onClick={() => setActiveTab('catalog')} variant="outline" className="mt-4">
                        Voltar ao Catálogo
                    </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              {orders.length > 0 ? orders.map(order => (
                <div key={order.id} onClick={() => navigate(`/pedido-reservado/${order.id}`)} className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 cursor-pointer hover:border-orange-200 transition-colors group">
                   <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold flex items-center gap-2 group-hover:text-orange-600 transition-colors">
                           Pedido #{order.id}
                           <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase font-bold">Reservado</span>
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Entrega: <strong>{new Date(order.deliveryDate).toLocaleDateString()}</strong> - {order.client?.nome || 'Cliente'}
                        </p>
                      </div>
                      <div className="text-right">
                          <span className="block font-bold text-gray-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                          </span>
                          <span className="text-xs text-gray-400">{order.items.length} itens</span>
                      </div>
                   </div>
                </div>
              )) : (
                  <div className="text-center py-20 text-gray-500 bg-white rounded-lg border border-dashed border-gray-200">
                      <History className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      Nenhum pedido realizado.
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ClienteDashboard;
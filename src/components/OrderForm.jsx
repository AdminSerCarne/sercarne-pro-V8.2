import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatters } from '@/utils/formatters';
import { useToast } from '@/components/ui/use-toast';

const OrderForm = ({ products, priceTable, onSubmit, loading }) => {
  const [cart, setCart] = useState({});
  const { toast } = useToast();

  const addToCart = (product) => {
    setCart(prev => ({
      ...prev,
      [product.codigo]: {
        ...product,
        quantidade: (prev[product.codigo]?.quantidade || 0) + 1,
        valor_unitario: product[`tabela_${priceTable}`],
      }
    }));
  };

  const updateQuantity = (codigo, quantidade) => {
    if (quantidade <= 0) {
      removeFromCart(codigo);
      return;
    }
    
    setCart(prev => ({
      ...prev,
      [codigo]: {
        ...prev[codigo],
        quantidade,
      }
    }));
  };

  const removeFromCart = (codigo) => {
    setCart(prev => {
      const newCart = { ...prev };
      delete newCart[codigo];
      return newCart;
    });
  };

  const cartItems = useMemo(() => Object.values(cart), [cart]);

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      return sum + (item.quantidade * item.valor_unitario);
    }, 0);
  }, [cartItems]);

  const handleSubmit = async () => {
    if (cartItems.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar o pedido.",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      items: cartItems.map(item => ({
        codigo: item.codigo,
        nome: item.nome,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.quantidade * item.valor_unitario,
      })),
      total,
    };

    const result = await onSubmit(orderData);
    
    if (result.success) {
      setCart({});
    }
  };

  return (
    <div className="space-y-6">
      {/* Products Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-dark)' }}>
          Produtos Disponíveis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <motion.div
              key={product.codigo}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-lg p-4 shadow-sm border card-hover"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <h4 className="font-medium mb-1" style={{ color: 'var(--text-dark)' }}>
                {product.nome}
              </h4>
              <p className="text-xs mb-2" style={{ color: 'var(--text-light)' }}>
                Código: {product.codigo}
              </p>
              <p className="text-lg font-bold mb-3" style={{ color: 'var(--orange-primary)' }}>
                {formatters.currency(product[`tabela_${priceTable}`])}
              </p>
              <Button
                onClick={() => addToCart(product)}
                className="w-full orange-button"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cart */}
      {cartItems.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center mb-4">
            <ShoppingCart className="w-6 h-6 mr-2" style={{ color: 'var(--orange-primary)' }} />
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-dark)' }}>
              Carrinho ({cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'})
            </h3>
          </div>

          <div className="space-y-3">
            {cartItems.map(item => (
              <div
                key={item.codigo}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-light)' }}
              >
                <div className="flex-1">
                  <p className="font-medium" style={{ color: 'var(--text-dark)' }}>{item.nome}</p>
                  <p className="text-sm" style={{ color: 'var(--text-light)' }}>
                    {formatters.currency(item.valor_unitario)} x {item.quantidade}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.codigo, item.quantidade - 1)}
                      className="p-1 rounded hover:bg-white"
                    >
                      <Minus className="w-4 h-4" style={{ color: 'var(--orange-primary)' }} />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantidade}</span>
                    <button
                      onClick={() => updateQuantity(item.codigo, item.quantidade + 1)}
                      className="p-1 rounded hover:bg-white"
                    >
                      <Plus className="w-4 h-4" style={{ color: 'var(--orange-primary)' }} />
                    </button>
                  </div>
                  <p className="font-bold w-24 text-right" style={{ color: 'var(--orange-primary)' }}>
                    {formatters.currency(item.quantidade * item.valor_unitario)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.codigo)}
                    className="p-2 rounded hover:bg-white"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--error)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold" style={{ color: 'var(--text-dark)' }}>Total:</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--orange-primary)' }}>
                {formatters.currency(total)}
              </span>
            </div>
            <Button
              onClick={handleSubmit}
              className="w-full orange-button"
              disabled={loading}
            >
              {loading ? 'Finalizando...' : 'Finalizar Pedido'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderForm;
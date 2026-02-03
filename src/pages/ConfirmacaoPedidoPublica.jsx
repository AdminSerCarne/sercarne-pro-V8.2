import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { CheckCircle2, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { schlosserApi } from '@/services/schlosserApi';
import { Button } from '@/components/ui/button';

const ConfirmacaoPedidoPublica = () => {
  const { orderId, token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const processConfirmation = async () => {
      try {
        // Attempt to confirm the order via API
        const result = await schlosserApi.confirmOrder(orderId, token);
        setOrder(result.order);
        setConfirmed(true);
      } catch (err) {
        setError(err.message || 'Link inválido ou expirado.');
      } finally {
        setLoading(false);
      }
    };

    processConfirmation();
  }, [orderId, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Confirmação de Pedido - Schlosser Pro</title>
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          {error ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro na Confirmação</h2>
              <p className="text-gray-500 mb-6">{error}</p>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Voltar ao Início
              </Button>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Confirmado!</h2>
              <p className="text-gray-500 mb-6">
                Seu pedido <b>#{orderId.slice(-6)}</b> foi processado com sucesso e a reserva foi efetivada.
              </p>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-2">Resumo</p>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">Total</span>
                  <span className="font-bold text-gray-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Itens</span>
                  <span className="font-medium text-gray-900">{order.items.length}</span>
                </div>
              </div>

              <Button 
                onClick={() => navigate('/login')} 
                className="w-full bg-[#FF8C42] hover:bg-[#E67E22] text-white"
              >
                Acessar minha conta
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ConfirmacaoPedidoPublica;
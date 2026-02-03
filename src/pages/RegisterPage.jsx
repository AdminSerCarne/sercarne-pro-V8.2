import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, UserCircle, MapPin, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { validators } from '@/utils/validators';
import { Button } from '@/components/ui/button';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    confirmPassword: '',
    tipo: 'Cliente', // Default to Cliente
    rota: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const tiposUsuario = ['Admin', 'Vendedor', 'Cliente'];
  const rotas = ['Missões', 'Cultura', 'Fronteira', 'Local', 'Celeiro'];

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    const nomeError = validators.nome(formData.nome);
    if (nomeError) newErrors.nome = nomeError;
    
    const emailError = validators.email(formData.email);
    if (emailError) newErrors.email = emailError;
    
    const passwordError = validators.password(formData.password);
    if (passwordError) newErrors.password = passwordError;
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }
    
    const tipoError = validators.tipo(formData.tipo);
    if (tipoError) newErrors.tipo = tipoError;
    
    // Only validate rota if user is a Cliente
    if (formData.tipo === 'Cliente') {
      const rotaError = validators.rota(formData.rota);
      if (rotaError) newErrors.rota = rotaError;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    
    // Ensure rota is sent even if empty (for non-clients)
    const result = await register(formData.email, formData.password, {
      nome: formData.nome,
      tipo: formData.tipo,
      rota: formData.tipo === 'Cliente' ? formData.rota : '', 
    });
    
    setLoading(false);
    
    if (result.success) {
      setTimeout(() => navigate('/login'), 1000);
    }
  };

  return (
    <>
      <Helmet>
        <title>Cadastro - Sistema de Vendas</title>
        <meta name="description" content="Crie sua conta no sistema de vendas" />
      </Helmet>
      
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#FF8C42]">
                <UserCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Criar Conta</h1>
              <p className="text-gray-500 mt-2">Junte-se à nossa plataforma de vendas</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="input-styled pl-10 text-gray-900"
                    style={{ borderColor: errors.nome ? 'var(--error)' : '' }}
                    placeholder="Seu nome completo"
                  />
                </div>
                {errors.nome && <p className="text-sm mt-1 text-red-500">{errors.nome}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-styled pl-10 text-gray-900"
                    style={{ borderColor: errors.email ? 'var(--error)' : '' }}
                    placeholder="seu@email.com"
                  />
                </div>
                {errors.email && <p className="text-sm mt-1 text-red-500">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="input-styled pl-10 text-gray-900"
                      style={{ borderColor: errors.password ? 'var(--error)' : '' }}
                      placeholder="••••••"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Confirmar
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="input-styled px-4 text-gray-900"
                      style={{ borderColor: errors.confirmPassword ? 'var(--error)' : '' }}
                      placeholder="••••••"
                    />
                  </div>
                </div>
              </div>
              {(errors.password || errors.confirmPassword) && (
                <p className="text-sm text-red-500">{errors.password || errors.confirmPassword}</p>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Tipo de Usuário
                </label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  className="input-styled px-4 text-gray-900 cursor-pointer"
                  style={{ borderColor: errors.tipo ? 'var(--error)' : '' }}
                >
                  <option value="">Selecione...</option>
                  {tiposUsuario.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
                {errors.tipo && <p className="text-sm mt-1 text-red-500">{errors.tipo}</p>}
              </div>

              {formData.tipo === 'Cliente' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Selecione sua Rota
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      name="rota"
                      value={formData.rota}
                      onChange={handleChange}
                      className="input-styled pl-10 text-gray-900 cursor-pointer"
                      style={{ borderColor: errors.rota ? 'var(--error)' : '' }}
                    >
                      <option value="">Selecione a rota...</option>
                      {rotas.map(rota => (
                        <option key={rota} value={rota}>{rota}</option>
                      ))}
                    </select>
                  </div>
                  {errors.rota && <p className="text-sm mt-1 text-red-500">{errors.rota}</p>}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full orange-button flex items-center justify-center mt-6"
                disabled={loading}
              >
                {loading ? 'Processando...' : (
                  <>
                    Criar Conta <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 text-center border-t border-gray-100 pt-6">
              <p className="text-sm text-gray-600">
                Já tem uma conta?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="font-bold text-[#FF8C42] hover:text-[#E67E22] transition-colors"
                >
                  Faça login
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default RegisterPage;
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Mail, UserCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validators } from '@/utils/validators';
import { useToast } from '@/components/ui/use-toast';

const UserManagementModal = ({ isOpen, onClose, onSave, editUser = null }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nome: editUser?.nome || '',
    email: editUser?.email || '',
    tipo: editUser?.tipo || '',
    rota: editUser?.rota || '',
  });
  const [errors, setErrors] = useState({});

  const tiposUsuario = ['Admin', 'Vendedor', 'Cliente'];
  const rotas = ['Missões', 'Cultura', 'Fronteira', 'Local', 'Celeiro'];

  if (!isOpen) return null;

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
    
    const tipoError = validators.tipo(formData.tipo);
    if (tipoError) newErrors.tipo = tipoError;
    
    const rotaError = validators.rota(formData.rota);
    if (rotaError) newErrors.rota = rotaError;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    await onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-dark)' }}>
            {editUser ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button onClick={onClose} className="hover:bg-gray-100 p-1 rounded">
            <X className="w-6 h-6" style={{ color: 'var(--text-light)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dark)' }}>
              Nome
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-light)' }} />
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border rounded-lg input-focus text-gray-900"
                style={{ borderColor: errors.nome ? 'var(--error)' : 'var(--border-color)' }}
              />
            </div>
            {errors.nome && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{errors.nome}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dark)' }}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-light)' }} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border rounded-lg input-focus text-gray-900"
                style={{ borderColor: errors.email ? 'var(--error)' : 'var(--border-color)' }}
                disabled={!!editUser}
              />
            </div>
            {errors.email && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dark)' }}>
              Tipo
            </label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-light)' }} />
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border rounded-lg input-focus text-gray-900"
                style={{ borderColor: errors.tipo ? 'var(--error)' : 'var(--border-color)' }}
              >
                <option value="">Selecione...</option>
                {tiposUsuario.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
            {errors.tipo && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{errors.tipo}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dark)' }}>
              Rota
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-light)' }} />
              <select
                name="rota"
                value={formData.rota}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border rounded-lg input-focus text-gray-900"
                style={{ borderColor: errors.rota ? 'var(--error)' : 'var(--border-color)' }}
              >
                <option value="">Selecione...</option>
                {rotas.map(rota => (
                  <option key={rota} value={rota}>{rota}</option>
                ))}
              </select>
            </div>
            {errors.rota && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{errors.rota}</p>}
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 orange-button">
              Salvar
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default UserManagementModal;
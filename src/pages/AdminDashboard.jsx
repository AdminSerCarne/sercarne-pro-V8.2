
import React from 'react';
import { Helmet } from 'react-helmet';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Package, CalendarDays, DollarSign } from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useSupabaseAuth();

  const stats = [
    { title: "Usuários", icon: <Users className="h-6 w-6 text-blue-500"/>, value: "Gestão", desc: "Administrar acessos" },
    { title: "Estoque", icon: <Package className="h-6 w-6 text-orange-500"/>, value: "Controle", desc: "Entradas e Saídas" },
    { title: "Reservas", icon: <CalendarDays className="h-6 w-6 text-green-500"/>, value: "Pedidos", desc: "Acompanhar status" },
    { title: "Preços", icon: <DollarSign className="h-6 w-6 text-purple-500"/>, value: "Tabelas", desc: "Atualizar valores" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Helmet>
        <title>Dashboard Admin - Sistema Schlosser</title>
      </Helmet>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
        <p className="text-gray-500">Bem-vindo, {user?.usuario}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <Card key={idx} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder sections for required functionalities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-64 flex items-center justify-center border-dashed">
          <p className="text-gray-400">Área de Gestão de Usuários (Em desenvolvimento)</p>
        </Card>
        <Card className="h-64 flex items-center justify-center border-dashed">
          <p className="text-gray-400">Área de Visualização de Estoque (Em desenvolvimento)</p>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;

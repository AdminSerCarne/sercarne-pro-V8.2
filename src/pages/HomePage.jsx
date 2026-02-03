import React from 'react';
import { Helmet } from 'react-helmet';
import HeroSection from '@/components/HeroSection';
import { motion } from 'framer-motion';
import { Package, Truck, Award, Clock, MapPin, Phone, Mail, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
const HomePage = () => {
  const features = [{
    icon: <Award className="w-8 h-8 text-[#FF6B35]" />,
    title: "Qualidade Premium",
    desc: "Cortes selecionados com rigoroso padrão de qualidade."
  }, {
    icon: <Truck className="w-8 h-8 text-[#FF6B35]" />,
    title: "Logística Própria",
    desc: "Frota moderna garantindo entrega na temperatura ideal."
  }, {
    icon: <Package className="w-8 h-8 text-[#FF6B35]" />,
    title: "Estoque em Tempo Real",
    desc: "Integração direta com nosso centro de distribuição."
  }, {
    icon: <Clock className="w-8 h-8 text-[#FF6B35]" />,
    title: "Entrega Agendada",
    desc: "Receba seu pedido com pontualidade e segurança."
  }];
  return <div className="min-h-screen bg-[#0a0a0a]">
      <Helmet>
        <title>Schlosser - Frigorífico da Carne Gaúcha</title>
      </Helmet>
      
      {/* Task 2: Responsive Hero Video Component */}
      <HeroSection />

      {/* Task 3: Contact Information Section */}
      <section className="relative -mt-20 z-20 px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{
          opacity: 0,
          y: 50
        }} whileInView={{
          opacity: 1,
          y: 0
        }} viewport={{
          once: true
        }} className="bg-[#121212] border border-white/10 rounded-xl shadow-2xl p-8 md:p-12 overflow-hidden relative">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B35]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {/* Address */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center border border-white/5 mb-2">
                  <MapPin className="text-[#FF6B35] w-6 h-6" />
                </div>
                <h3 className="text-white font-serif font-semibold text-lg">Nossa Localização Tchê</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Estrada Municipal RS 342, KM20, nº 101<br />
                  Zona Rural, Horizontina - RS<br />
                  CEP: 98920-000
                </p>
              </div>

              {/* Contact */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 border-t md:border-t-0 md:border-l border-white/5 pt-8 md:pt-0 md:pl-8">
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center border border-white/5 mb-2">
                  <Phone className="text-[#FF6B35] w-6 h-6" />
                </div>
                <h3 className="text-white font-serif font-semibold text-lg">Precisar, prende o grito</h3>
                <div className="flex flex-col gap-1">
                  <a href="tel:+5555996517131" className="text-gray-400 text-sm hover:text-white transition-colors flex items-center gap-2 justify-center md:justify-start">
                    +55 (55) 9-9651-7131
                  </a>
                  <a href="mailto:contato@frigorificoschlosser.com.br" className="text-gray-400 text-sm hover:text-white transition-colors flex items-center gap-2 justify-center md:justify-start">
                    <Mail size={14} /> contato@frigorificoschlosser.com.br
                  </a>
                </div>
              </div>

              {/* Certification */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 border-t md:border-t-0 md:border-l border-white/5 pt-8 md:pt-0 md:pl-8">
                <div className="w-12 h-12 rounded-full bg-[#8B0000]/20 flex items-center justify-center border border-[#8B0000]/30 mb-2">
                  <FileCheck className="text-[#8B0000] w-6 h-6" />
                </div>
                <h3 className="text-white font-serif font-semibold text-lg">Certificação</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Garantia de procedência e segurança alimentar.
                </p>
                <div className="inline-block px-3 py-1 bg-[#8B0000]/10 border border-[#8B0000]/30 rounded text-[#FF6B35] text-xs font-bold tracking-wider uppercase">
                  CISPOA 951 / SISBI Nacional
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">A Excelência Schlosser</h2>
            <div className="w-24 h-1 bg-[#FF6B35] mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, idx) => <motion.div key={idx} initial={{
            opacity: 0,
            y: 20
          }} whileInView={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: idx * 0.1,
            duration: 0.5
          }} viewport={{
            once: true
          }} className="bg-[#121212] p-8 rounded-xl border border-white/5 hover:border-[#FF6B35]/30 transition-all duration-300 group hover:bg-[#1a1a1a]">
                <div className="mb-6 p-4 bg-black rounded-full w-fit group-hover:bg-[#FF6B35]/10 transition-colors border border-white/5">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-serif font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-sans">{feature.desc}</p>
              </motion.div>)}
          </div>
        </div>
      </section>
    </div>;
};
export default HomePage;
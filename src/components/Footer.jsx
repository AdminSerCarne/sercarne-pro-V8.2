import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Linkedin, Mail, Phone, MapPin, ShieldCheck, FileCheck } from 'lucide-react';
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const LOGO_URL = "https://horizons-cdn.hostinger.com/f5e592ff-4b11-4a06-90fa-42f9bf225481/e979c9ad073c28cd8ccd3102f1dd9c56.jpg";
  return <footer className="bg-[#0a0a0a] border-t border-white/5 text-gray-400 font-sans print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          {/* Brand Column */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-black p-2 rounded-md border border-white/5">
                 <img src={LOGO_URL} alt="Schlosser" className="h-14 w-auto" />
              </div>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500">Frigorífico da carne gaúcha, Especialista em prestação de serviço de desossa em cortes embalados para maior rentabilidade dos clientes. Excelência em cortes nobres e distribuição logística de ponta a ponta.</p>
            <div className="flex space-x-4">
              <a
                href="https://www.instagram.com/frigorificoschlosser?igsh=MWEzN2tlbGJqZGNweg=="
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-[#FF6B35] hover:bg-white/10 transition-all"
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>
              <a
                href="https://www.facebook.com/FrigorificoSchlosser"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-[#FF6B35] hover:bg-white/10 transition-all"
                aria-label="Facebook"
              >
                <Facebook size={18} />
              </a>
              <a
                href="https://www.linkedin.com/company/frigor%C3%ADficoschlosser/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-[#FF6B35] hover:bg-white/10 transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin size={18} />
              </a>
            </div>
          </div>
          {/* Contact Info */}
          <div className="lg:col-span-2">
            <h3 className="text-white font-serif font-semibold text-lg mb-6 flex items-center gap-2">
              <MapPin className="text-[#FF6B35] w-5 h-5" /> Contato e Localização
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-sm leading-relaxed">
                    <strong className="text-gray-300 block mb-1">Endereço Principal</strong>
                    Estrada Municipal RS 342, KM20, nº 101<br />
                    Zona Rural, Horizontina - RS<br />
                    CEP: 98920-000
                  </span>
                </li>
                <li className="flex items-center gap-3 pt-2">
                  <ShieldCheck className="w-5 h-5 text-[#8B0000]" />
                  <span className="text-sm font-medium text-gray-300">CISPOA 951 / SISBI Nacional</span>
                </li>
              </ul>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-[#FF6B35]" />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Telefone / WhatsApp</span>
                    <span className="text-sm text-white font-medium hover:text-[#FF6B35] transition-colors cursor-pointer">
                      +55 (55) 9-9651-7131
                    </span>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#FF6B35]" />
                  <div className="flex flex-col">
                     <span className="text-xs text-gray-500 uppercase tracking-wider">Email Comercial</span>
                     <span className="text-sm text-white break-all hover:text-[#FF6B35] transition-colors cursor-pointer">
                        contato@frigorificoschlosser.com.br
                     </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Certifications & Hours */}
          <div>
             <h3 className="text-white font-serif font-semibold text-lg mb-6">Atendimento</h3>
             <ul className="space-y-3 text-sm border-l-2 border-[#FF6B35] pl-4">
                <li className="flex flex-col">
                   <span className="text-gray-500 text-xs uppercase">Segunda - Sexta</span>
                   <span className="text-white font-medium">08:00 - 18:00</span>
                </li>
                <li className="flex flex-col">
                   <span className="text-gray-500 text-xs uppercase">Sábado</span>
                   <span className="text-white font-medium">08:00 - 12:00</span>
                </li>
             </ul>
             
             <div className="mt-8 pt-6 border-t border-white/5">
                <div className="flex items-center gap-2 text-[#8B0000]">
                  <FileCheck size={20} />
                  <span className="text-xs font-bold tracking-widest uppercase">Certificação Garantida</span>
                </div>
             </div>
          </div>
        </div>

        <div className="border-t border-white/5 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-600">
            © {currentYear} Schlosser Frigorífico. Todos os direitos reservados.
          </p>
          <div className="flex space-x-6 text-xs text-gray-600">
             <Link to="/login" className="hover:text-[#FF6B35]">Área do Colaborador</Link>
             <a href="#" className="hover:text-gray-400">Termos de Uso</a>
             <a href="#" className="hover:text-gray-400">Privacidade</a>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;

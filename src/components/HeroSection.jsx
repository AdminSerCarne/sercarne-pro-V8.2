
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

const HeroSection = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Updates state on resize to switch between video (desktop) and image (mobile)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Assets
  const HERO_IMAGE_URL = "https://horizons-cdn.hostinger.com/f5e592ff-4b11-4a06-90fa-42f9bf225481/3ad1dc4d2742d5ad8c0ed9b5ea708c7f.jpg";
  
  // YouTube Embed URL with autoplay, mute, loop, and playlist for continuous background video (Task 1)
  const YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/NVvHTm4e-N4?controls=0&modestbranding=1&rel=0&showinfo=0&autoplay=1&mute=1&loop=1&playlist=NVvHTm4e-N4";

  return (
    <div className="relative h-[600px] md:h-screen w-full overflow-hidden bg-black">
      
      {/* Background Media Layer */}
      <div className="absolute inset-0 w-full h-full">
        {isMobile ? (
          // Mobile: Static Banner Image
          <div 
            className="w-full h-[240px] sm:h-[300px] md:h-full bg-no-repeat transition-opacity duration-500"
            style={{
              backgroundImage: `url(${HERO_IMAGE_URL})`,
              backgroundPosition: isMobile ? '50% 50%' : 'center',
              backgroundSize: isMobile ? '110% auto' : 'cover',
            }}
          />
        ) : (
          // Desktop: YouTube Embed
          // Use padding-bottom technique for aspect ratio (16:9 for YouTube)
          <div className="relative w-full h-full pb-[56.25%] overflow-hidden">
            <iframe 
              className="absolute top-0 left-0 w-full h-full object-cover" 
              src={YOUTUBE_EMBED_URL} 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              title="Schlosser PRO - Frigorífico Gaúcho/Grupo Zaleski"
            ></iframe>
          </div>
        )}
      </div>

      {/* Dark Overlay for Text Legibility */}
      <div className="absolute inset-0 bg-black/40 bg-gradient-to-t from-[#0a0a0a] via-black/20 to-black/50"></div>

      {/* Content Layer */}
      <div className="relative z-10 h-full flex flex-col justify-start md:justify-center items-center text-center px-4 sm:px-6 lg:px-8 pt-24 md:pt-0">
          <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-5xl"
          >
          {/* Main Headline */}
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight tracking-tight drop-shadow-2xl">
            Schlosser PRO
          </h1>
          
          {/* Subheadline */}
          <p className="font-sans text-lg md:text-2xl text-gray-100 mb-2 font-light tracking-[0.2em] uppercase drop-shadow-lg">
            Frigorífico Gaucho/ Grupo Zaleski
          </p>
          <div className="w-24 h-1 bg-[#FF6B35] mx-auto mb-8 rounded-full shadow-[0_0_10px_rgba(255,107,53,0.5)]"></div>

          <p className="font-sans text-base md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto font-light leading-relaxed drop-shadow-md hidden sm:block">
            Uma experiência completa em sabor e qualidade.
          </p>
          
          {/* CTA Button */}
          <Link to="/catalog" className="mt-16 sm:mt-10 md:mt-6 border-4 border-lime-400">
            <Button 
              className="h-14 px-10 bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold text-lg rounded-sm uppercase tracking-widest transition-all duration-300 hover:scale-105 shadow-xl border-none ring-offset-2 focus:ring-2 ring-[#FF6B35]"
            >
                Acessar Catálogo
            </Button>
          </Link>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1, y: [0, 10, 0] }} 
          transition={{ delay: 2, duration: 1.5, repeat: Infinity }} 
          className="hidden md:block absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50"
          className="max-w-5xl flex flex-col items-center"
        >
          <ChevronDown size={32} />
        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;


import React from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const CatalogBanner = () => {
  const { user } = useSupabaseAuth();

  // B2B Image (3 people) - Displayed when Logged In
  const THREE_PERSON_IMAGE = "https://horizons-cdn.hostinger.com/f5e592ff-4b11-4a06-90fa-42f9bf225481/2ad8a9efde43631da3856874f30b8cc8.jpg";
  
  // B2C Image (4 people) - Displayed when NOT Logged In
  const FOUR_PERSON_IMAGE = "https://horizons-cdn.hostinger.com/f5e592ff-4b11-4a06-90fa-42f9bf225481/6b3b53e21f60a788c8f225887b3a52bd.jpg";

  // Logic: User Logged In (B2B) ? 3 Person : 4 Person
  const bannerImage = user ? THREE_PERSON_IMAGE : FOUR_PERSON_IMAGE;
  const bannerKey = user ? 'b2b-banner' : 'b2c-banner';

  return (
    <div className="relative w-full h-[300px] md:h-[400px] overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={bannerKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Background Image */}
          <img
            src={bannerImage}
            alt={user ? "Equipe B2B Schlosser" : "Equipe Schlosser"}
            className="w-full h-full object-cover object-top"
            loading="eager"
          />
          
          {/* Overlay Gradient for better integration with dark theme */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#0a0a0a]"></div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CatalogBanner;

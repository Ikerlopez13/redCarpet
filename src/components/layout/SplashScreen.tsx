import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 500); // Wait a bit after 100% before unmounting
          return 100;
        }
        return prev + 2; // Increment speed
      });
    }, 30);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#0f0808] text-white overflow-hidden font-sans">
      {/* Background Gradient */}
      <div
        className="absolute inset-0 z-0 opacity-40 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 30%, #520000 0%, #0f0808 70%)'
        }}
      />

      <div className="z-10 flex flex-col items-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6 relative"
        >
          {/* Glow effect behind logo */}
          <div className="absolute inset-0 bg-red-600 blur-2xl opacity-20 rounded-full scale-150"></div>
          <img src="/logo.png" alt="RedCarpet Logo" className="w-32 h-32 object-contain relative z-10 drop-shadow-2xl" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold mb-2 tracking-tight"
        >
          RedCarpet
        </motion.h1>

        {/* Slogan */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-slate-400 text-lg mb-20"
        >
          Ve siempre segur@
        </motion.p>
      </div>

      {/* Loading Bar Section at Bottom */}
      <div className="absolute bottom-16 w-full px-12 flex flex-col items-center">
        <p className="text-xs text-slate-500 mb-4 tracking-wide">Iniciando protocolos de seguridad...</p>

        {/* Progress Bar Container */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary shadow-[0_0_10px_#FF3131]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[10px] text-slate-700 mt-8 font-mono tracking-widest">VERSIÓN 3.0.1</p>
      </div>
    </div>
  );
};

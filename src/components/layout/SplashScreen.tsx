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
          setTimeout(onFinish, 200); // Wait a bit after 100% before unmounting
          return 100;
        }
        return prev + 10; // Increment speed (faster)
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
          className="mb-8 relative"
        >
          {/* Glow effect behind logo */}
          <div className="absolute inset-0 bg-red-600 blur-2xl opacity-20 rounded-full scale-150"></div>
          <img src="/logo.png" alt="RedCarpet Logo" className="w-16 h-auto object-contain relative z-10 drop-shadow-2xl" />
        </motion.div>
      </div>

      {/* Loading Bar Section at Bottom */}
      <div className="absolute bottom-32 w-full px-20 flex flex-col items-center">
        {/* Progress Bar Container */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

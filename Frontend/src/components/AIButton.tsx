import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAIButton } from '../contexts/AIButtonContext';

interface AIButtonProps {
  onClick: () => void;
  hidden?: boolean;
}

export function AIButton({ onClick, hidden = false }: AIButtonProps) {
  const { position } = useAIButton();

  if (position === 'hidden' || hidden) {
    return null;
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-6 left-6';
      case 'top-right':
        return 'top-6 right-6';
      case 'bottom-left':
        return 'bottom-6 left-6';
      case 'bottom-right':
      default:
        return 'bottom-6 right-6';
    }
  };

  return (
    <motion.button
      onClick={onClick}
      className={`fixed ${getPositionClasses()} z-30 group`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-[#DDEF00] blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />

      {/* Button */}
      <div className="relative w-8 h-8 rounded-full bg-linear-to-br from-[#DDEF00] to-[#DDEF00]/80 shadow-lg flex items-center justify-center border border-[#DDEF00]/30 overflow-hidden">
        {/* Animated background */}
        <motion.div
          className="absolute inset-0 bg-linear-to-tr from-transparent via-white/20 to-transparent"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            repeat: Infinity,
            duration: 3,
            ease: 'linear',
          }}
        />

        {/* Icon */}
        <motion.div
          animate={{
            rotate: [0, 10, -10, 10, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 4,
            ease: 'easeInOut',
          }}
        >
          <Sparkles className="w-4 h-4 text-black relative z-10" />
        </motion.div>

        {/* Pulse rings */}
        <motion.div
          className="absolute inset-0 rounded-full border border-[#DDEF00]"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0, 0.4],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Tooltip */}
      <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-black text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
          Ask AI Assistant
          <div className="absolute -top-1 right-4 border-4 border-transparent border-b-black" />
        </div>
      </div>
    </motion.button>
  );
}

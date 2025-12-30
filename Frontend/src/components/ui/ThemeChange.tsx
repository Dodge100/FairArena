import { motion } from 'motion/react';
import { useId } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../libs/utils';

export default function ThemeToggleButton({ className }: { className: string }) {
  return (
    <div className={cn('p-2 rounded-xl', className)}>
      {/* {theme === "light" ? <MoonIcon size={20} /> : <Sun size={20} />} */}
      <motion.div layout>
        <ThemeToggleButton3 className={cn('size-10 p-2')} />
      </motion.div>
    </div>
  );
}

const ThemeToggleButton3 = ({ className = '' }: { className?: string }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const id = useId();
  const clipPathId = `skiper-btn-${id}`;

  return (
    <button
      type="button"
      className={cn(
        'rounded-full transition-all duration-300 cursor-pointer active:scale-95',
        isDark ? 'bg-black text-[#DDFF00]' : 'bg-[#DDFF00] text-black',
        className,
      )}
      onClick={toggleTheme}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        fill="currentColor"
        strokeLinecap="round"
        viewBox="0 0 32 32"
      >
        <clipPath id={clipPathId}>
          <motion.path
            animate={{ y: isDark ? 14 : 0, x: isDark ? -11 : 0 }}
            transition={{ ease: 'easeInOut', duration: 0.35 }}
            d="M0-11h25a1 1 0 0017 13v30H0Z"
          />
        </clipPath>
        <g clipPath={`url(#${clipPathId})`}>
          <motion.circle
            initial={{ r: 8 }}
            animate={{ r: isDark ? 10 : 8 }}
            transition={{ ease: 'easeInOut', duration: 0.35 }}
            cx="16"
            cy="16"
          />
          <motion.g
            initial={{ scale: 1, opacity: 1 }}
            animate={{
              scale: isDark ? 0.5 : 1,
              opacity: isDark ? 0 : 1,
            }}
            transition={{ ease: 'easeInOut', duration: 0.35 }}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M18.3 3.2c0 1.3-1 2.3-2.3 2.3s-2.3-1-2.3-2.3S14.7.9 16 .9s2.3 1 2.3 2.3zm-4.6 25.6c0-1.3 1-2.3 2.3-2.3s2.3 1 2.3 2.3-1 2.3-2.3 2.3-2.3-1-2.3-2.3zm15.1-10.5c-1.3 0-2.3-1-2.3-2.3s1-2.3 2.3-2.3 2.3 1 2.3 2.3-1 2.3-2.3 2.3zM3.2 13.7c1.3 0 2.3 1 2.3 2.3s-1 2.3-2.3 2.3S.9 17.3.9 16s1-2.3 2.3-2.3zm5.8-7C9 7.9 7.9 9 6.7 9S4.4 8 4.4 6.7s1-2.3 2.3-2.3S9 5.4 9 6.7zm16.3 21c-1.3 0-2.3-1-2.3-2.3s1-2.3 2.3-2.3 2.3 1 2.3 2.3-1 2.3-2.3 2.3zm2.4-21c0 1.3-1 2.3-2.3 2.3S23 7.9 23 6.7s1-2.3 2.3-2.3 2.4 1 2.4 2.3zM6.7 23C8 23 9 24 9 25.3s-1 2.3-2.3 2.3-2.3-1-2.3-2.3 1-2.3 2.3-2.3z" />
          </motion.g>
        </g>
      </svg>
    </button>
  );
};

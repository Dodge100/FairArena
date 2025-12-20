import { Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataSaverUtils } from '../hooks/useDataSaverUtils';
import { useTheme } from '../hooks/useTheme';
import { useAuthState } from '../lib/auth';
import { Spotlight } from './ui/Spotlight';

function Header() {
  const { theme } = useTheme();
  const { dataSaverSettings } = useDataSaverUtils();
  const [isDark, setIsDark] = useState(false);
  const { isSignedIn } = useAuthState();

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  return (
    <div
      data-scroll
      data-scroll-speed="1"
      className="w-full sm:h-screen h-[80vh] flex relative flex-col items-center justify-center"
    >
      <Spotlight className="top-0 left-20" fill="#DDFF00" />

      {/* Heading Wrapper */}
      {dataSaverSettings.enabled && dataSaverSettings.reduceAnimations ? (
        <h1
          className={`
            text-4xl md:text-6xl lg:text-8xl font-semibold text-center lg:mt-30 xl:mt-20
            transition-colors cursor-default duration-300
            ${isDark ? 'text-white' : 'text-black'}
          `}
        >
          {/* Line 1 */}
          <span className="block">
            Platform that makes
          </span>

          {/* Line 2 – highlighted text */}
          <span className="block text-[#d9ff00] [-webkit-text-stroke:1px_black]">
            Fair Decision
          </span>
        </h1>
      ) : (
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9, ease: 'easeOut' }}
          className={`
            text-4xl md:text-6xl lg:text-8xl font-semibold text-center lg:mt-30 xl:mt-20
            transition-colors cursor-default duration-300
            ${isDark ? 'text-white' : 'text-black'}
          `}
        >
          {/* Line 1 */}
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
            className="block"
          >
            Platform that makes
          </motion.span>

          {/* Line 2 – highlighted text */}
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6, ease: 'easeOut' }}
            className="block text-[#d9ff00] [-webkit-text-stroke:1px_black]"
          >
            Fair Decision
          </motion.span>
        </motion.h1>
      )}
      {dataSaverSettings.enabled && dataSaverSettings.reduceAnimations ? (
        <p className="
    text-center mt-6 text-neutral-400
    text-sm sm:text-base md:text-lg
    px-4 md:px-0
    max-w-[90%] sm:max-w-[80%] md:max-w-[60%] lg:max-w-[50%] xl:max-w-[60%]
    mx-auto
  ">
          Fair Arena Helps Hackathon Judges to Score Perfectly with Website Insights and Uniqueness.
        </p>
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 1.2, ease: 'easeOut' }}
          className="
    text-center mt-6 text-neutral-400
    text-sm sm:text-base md:text-lg
    px-4 md:px-0
    max-w-[90%] sm:max-w-[80%] md:max-w-[60%] lg:max-w-[50%] xl:max-w-[60%]
    mx-auto
  "
        >
          Fair Arena Helps Hackathon Judges to Score Perfectly with Website Insights and Uniqueness.
        </motion.p>
      )}

      {!isSignedIn ? (
        <Link to={'/waitlist'}>
          {dataSaverSettings.enabled && dataSaverSettings.reduceAnimations ? (
            <button className="mt-10 text-xl md:text-2xl font-semibold px-6 py-3 rounded-full
          bg-[#d9ff00] flex items-center gap-2 text-neutral-800 shadow-[0_0_15px_4px_rgba(217,255,0,0.4)]
          hover:shadow-[0_0_25px_10px_rgba(217,255,0,0.6)]
          transition-all duration-300 cursor-pointer">
              <Zap /> Join WaitList
            </button>
          ) : (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.6, ease: 'easeOut' }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              className="mt-10 text-xl md:text-2xl font-semibold px-6 py-3 rounded-full
          bg-[#d9ff00] flex items-center gap-2 text-neutral-800 shadow-[0_0_15px_4px_rgba(217,255,0,0.4)]
          hover:shadow-[0_0_25px_10px_rgba(217,255,0,0.6)]
          transition-all duration-300 cursor-pointer"
            >
              <Zap /> Join WaitList
            </motion.button>
          )}
        </Link>
      ) : (
        <Link to={'/dashboard'}>
          {dataSaverSettings.enabled && dataSaverSettings.reduceAnimations ? (
            <button className="mt-10 text-xl md:text-2xl font-semibold px-6 py-3 rounded-full
          bg-[#d9ff00] flex items-center gap-2 text-neutral-800 shadow-[0_0_15px_4px_rgba(217,255,0,0.4)]
          hover:shadow-[0_0_25px_10px_rgba(217,255,0,0.6)]
          transition-all duration-300 cursor-pointer">
              <Zap /> Go to Dashboard
            </button>
          ) : (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.6, ease: 'easeOut' }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              className="mt-10 text-xl md:text-2xl font-semibold px-6 py-3 rounded-full
          bg-[#d9ff00] flex items-center gap-2 text-neutral-800 shadow-[0_0_15px_4px_rgba(217,255,0,0.4)]
          hover:shadow-[0_0_25px_10px_rgba(217,255,0,0,0.6)]
          transition-all duration-300 cursor-pointer"
            >
              <Zap /> Go to Dashboard
            </motion.button>
          )}
        </Link>
      )}
    </div>
  );
}

export default Header;

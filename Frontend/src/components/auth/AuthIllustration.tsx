/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { type LucideIcon, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface Feature {
  icon: LucideIcon;
  text: string;
  desc: string;
}

interface AuthIllustrationProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  features: Feature[];
}

export const AuthIllustration: React.FC<AuthIllustrationProps> = ({
  title,
  subtitle,
  icon,
  features,
}) => {
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="hidden md:flex w-1/2 relative bg-[#050505] items-center justify-center overflow-hidden border-l border-white/5">
      <AnimatePresence mode="wait">
        {showWelcome ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            transition={{ duration: 0.6, ease: 'circOut' }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]"
          >
            <div className="relative">
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-7xl md:text-9xl font-black text-[#DDEF00] tracking-tighter italic z-10 relative"
              >
                WELCOME
              </motion.div>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4, duration: 1, ease: 'expoOut' }}
                className="absolute -bottom-2 left-0 right-0 h-4 bg-[#DDEF00] origin-left -rotate-1"
              />

              {/* Background Text Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] bg-[#DDEF00]/10 rounded-full blur-[120px] pointer-events-none" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="relative w-full h-full flex items-center justify-center overflow-y-auto no-scrollbar py-12"
          >
            {/* Ambient Animated Glows */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.15, 0.1],
              }}
              transition={{ duration: 8, repeat: Infinity }}
              className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#DDEF00]/20 rounded-full blur-[140px] pointer-events-none"
            />
            <motion.div
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.05, 0.1, 0.05],
              }}
              transition={{ duration: 10, repeat: Infinity }}
              className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"
            />

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-125 brightness-100 mix-blend-overlay"></div>

            {/* Main Content Card */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 1, ease: 'easeOut' }}
              className="relative z-30 w-full max-w-lg lg:max-w-xl px-8"
            >
              <div className="relative bg-neutral-900/40 border border-white/10 rounded-[3rem] p-10 lg:p-12 shadow-2xl backdrop-blur-3xl overflow-hidden backdrop-saturate-150">
                <div className="flex flex-col gap-10">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="w-16 h-16 bg-[#DDEF00] rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(221,239,0,0.5)]"
                  >
                    {icon || <Zap className="w-10 h-10 text-black font-bold" />}
                  </motion.div>

                  <div className="space-y-6">
                    <motion.h2
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tighter"
                    >
                      {title.split(' ').map((word, i) => (
                        <span
                          key={i}
                          className={word.toLowerCase() === 'fairarena' ? 'text-[#DDEF00]' : ''}
                        >
                          {word}{' '}
                        </span>
                      ))}
                    </motion.h2>
                    <motion.p
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="text-neutral-400 text-lg lg:text-xl leading-relaxed max-w-md font-medium"
                    >
                      {subtitle}
                    </motion.p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:gap-5">
                    {features.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 + i * 0.1 }}
                        className="group/item flex flex-col gap-2 p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-[#DDEF00]/40 hover:bg-[#DDEF00]/5 transition-all duration-300"
                      >
                        <item.icon className="w-6 h-6 text-[#DDEF00]" />
                        <div className="space-y-0.5">
                          <div className="text-sm font-bold text-white line-clamp-1">
                            {item.text}
                          </div>
                          <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-black leading-none line-clamp-1">
                            {item.desc}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="flex items-center justify-between pt-8 border-t border-white/5 mt-2"
                  >
                    <div className="flex -space-x-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`w-10 h-10 rounded-full border-2 border-[#0d0d0d] bg-neutral-800 flex items-center justify-center overflow-hidden`}
                        >
                          <div
                            className={`w-full h-full bg-gradient-to-br ${i === 1 ? 'from-yellow-400' : i === 2 ? 'from-[#DDEF00]' : i === 3 ? 'from-white' : 'from-neutral-400'} opacity-20`}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

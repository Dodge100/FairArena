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

import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

import { useTranslation } from 'react-i18next';

function Faq() {
  const { t } = useTranslation();
  const faqs = t('home.faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>;

  const { isDark } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const cardBG = isDark
    ? 'bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border-white/5'
    : 'bg-white border-neutral-300 shadow-[0_0_18px_-6px_rgba(0,0,0,0.08)]';

  const textPrimary = isDark ? 'text-white' : 'text-black';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`w-full min-h-screen flex flex-col items-center py-24 px-4 transition-colors `}
    >
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className={`px-4 py-1 rounded-full text-[#d9ff00] text-sm font-medium mb-6 ${
          isDark ? 'bg-[#111]/90' : 'bg-black/90'
        }`}
      >
        {t('home.faq.badge')}
      </motion.div>

      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={`text-4xl md:text-5xl font-bold tracking-tight ${textPrimary}`}
      >
        {t('home.faq.title')}
      </motion.h1>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className={`${textSecondary} text-center max-w-xl mt-4 text-lg`}
      >
        {t('home.faq.subtitle')}
      </motion.p>

      {/* FAQ List */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.07, delayChildren: 0.45 } },
        }}
        className="w-full max-w-2xl mt-12 space-y-4"
      >
        {faqs.map((item, index) => (
          <motion.div
            key={index}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.4, ease: 'easeOut' },
              },
            }}
          >
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className={`w-full px-6 py-5 rounded-2xl cursor-pointer select-none border transition-colors ${cardBG}`}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <div className="flex items-center justify-between gap-4">
                <span className={`text-lg font-medium flex-1 text-left ${textPrimary}`}>
                  {item.q}
                </span>

                {/* Animated Icon */}
                <motion.div
                  animate={{ rotate: openIndex === index ? 45 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="
                    w-8 h-8 rounded-full bg-[#d9ff00] shrink-0
                    flex items-center justify-center
                  "
                >
                  <Plus size={20} className="text-black" />
                </motion.div>
              </div>

              {/* Accordion Body */}
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    key="answer"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p className={`${textSecondary} text-sm mt-3 pb-1 leading-relaxed`}>
                      {item.a || 'Your answer goes here…'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export default Faq;

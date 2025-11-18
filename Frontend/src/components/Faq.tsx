import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';

function Faq() {
  const faqs = [
    { q: 'What is Fair Arena?', a: '' },
    { q: 'What it do for Hackathon Judges?', a: '' },
    { q: 'What it do for Hackthon Members? ', a: '' },
    { q: 'How Fair Arena Makes Best Decision?', a: '' },
  ];

  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

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
        Questions? We Have Answers
      </motion.div>

      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={`text-4xl md:text-5xl font-bold tracking-tight ${textPrimary}`}
      >
        Frequently Asked <span className="text-neutral-400">Questions</span>
      </motion.h1>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className={`${textSecondary} text-center max-w-xl mt-4 text-lg`}
      >
        Find quick answers to some of the most common questions about Increasy.
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
              <div className="flex items-center justify-between">
                <span className={`text-lg ${textPrimary}`}>{item.q}</span>

                {/* Animated Icon */}
                <motion.div
                  animate={{ rotate: openIndex === index ? 45 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="
                    w-8 h-8 rounded-full bg-[#d9ff00]
                    flex items-center justify-center
                  "
                >
                  <Plus size={20} className="text-black" />
                </motion.div>
              </div>

              {/* Accordion Body */}
              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.p
                    key="answer"
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={`${textSecondary} text-sm mt-3 pb-1`}
                  >
                    {item.a || 'Your answer goes here…'}
                  </motion.p>
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

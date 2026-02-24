import { MessageSquarePlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';

export default function GptPromotion() {
    const { isDark } = useTheme();
    const { t } = useTranslation();

    return (
        <section className="w-full py-16 md:py-20 px-4 relative overflow-hidden">
            {/* Advanced Decorative background elements */}
            <motion.div
               animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.15, 0.25, 0.15],
                  x: [0, 20, 0],
                  y: [0, -20, 0]
               }}
               transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
               className={cn(
                "absolute top-[-10%] left-[-10%] w-[500px] h-[500px] blur-[120px] rounded-full pointer-events-none z-0",
                isDark ? "bg-[#d9ff00]/20" : "bg-[#d9ff00]/40"
            )} />

            <motion.div
               animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                  x: [0, -30, 0],
                  y: [0, 40, 0]
               }}
               transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
               className={cn(
                "absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] blur-[120px] rounded-full pointer-events-none z-0",
                isDark ? "bg-[#d9ff00]/10" : "bg-[#d9ff00]/30"
            )} />

            <div className="max-w-6xl mx-auto relative z-10 perspective-2000">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 40 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                        "rounded-[3rem] border p-6 md:p-14 flex flex-col lg:flex-row items-center gap-10 lg:gap-16 relative overflow-hidden group",
                        isDark
                          ? "bg-neutral-900/40 border-neutral-800/50 backdrop-blur-3xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)]"
                          : "bg-white/70 border-white backdrop-blur-3xl shadow-[0_30px_70px_-15px_rgba(217,255,0,0.12)]"
                    )}
                >
                    {/* Corner Accent */}
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-25 transition-opacity">
                       <MessageSquarePlus className="w-24 h-24 text-[#d9ff00] -mr-8 -mt-8 rotate-12" />
                    </div>

                    {/* Left Side: Interactive Chat Mockup */}
                    <div className="flex-1 w-full max-w-[380px] relative order-2 lg:order-1 perspective-1000">
                        <motion.div
                           whileHover={{
                              rotateY: -5,
                              rotateX: 3,
                              scale: 1.02,
                              z: 40
                           }}
                           transition={{ type: "spring", stiffness: 200, damping: 25 }}
                           className={cn(
                            "aspect-[4/5] rounded-[2.5rem] border-4 overflow-hidden flex flex-col p-5 shadow-2xl relative preserve-3d",
                            isDark ? "bg-[#050505] border-neutral-800/80 shadow-[#d9ff00]/5" : "bg-neutral-50/80 border-white shadow-xl shadow-[#d9ff00]/5"
                          )}
                        >
                            {/* GPT Header with Glass Effect */}
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800/10">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                       <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center font-[1000] text-neutral-950 text-xl shadow-lg shadow-[#d9ff00]/20 transform -rotate-3 hover:rotate-0 transition-transform"><img className="w-8 h-8" src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin" alt="FA" /></div>
                                       <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-[3px] border-[#0a0a0a]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className={cn("text-sm font-[900] tracking-tight", isDark ? "text-white" : "text-neutral-950")}>FairArena AI</div>
                                        <div className="text-[10px] text-[#d9ff00] font-black flex items-center gap-1.5 uppercase tracking-[1.5px]">
                                            Expert AI
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 opacity-30">
                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                                </div>
                            </div>

                            <div className="space-y-5 overflow-y-auto pr-2 flex-1 scrollbar-hide py-1">
                                {/* AI Welcome */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                                    whileInView={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ delay: 0.5, type: "spring", bounce: 0.4 }}
                                    className={cn(
                                        "p-4 rounded-[1.75rem] rounded-tl-none text-[13px] max-w-[95%] leading-relaxed font-semibold shadow-sm border",
                                        isDark ? "bg-neutral-900 text-neutral-200 border-neutral-800/50" : "bg-white text-neutral-800 border-neutral-100"
                                    )}
                                >
                                    Hey! I'm your FairArena AI. Ready to boost your hackathon? 🚀
                                </motion.div>

                                {/* User Question 1 */}
                                <motion.div
                                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                                    whileInView={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ delay: 1.2, type: "spring", bounce: 0.4 }}
                                    className="flex flex-col items-end gap-1.5 ml-auto max-w-[95%]"
                                >
                                    <div className={cn(
                                        "p-4 rounded-[1.75rem] rounded-tr-none text-[13px] leading-relaxed font-[800] shadow-xl",
                                        isDark ? "bg-[#d9ff00] text-neutral-950" : "bg-neutral-950 text-white"
                                    )}>
                                        How do I automate judging for 100+ projects?
                                    </div>
                                    <div className="flex items-center gap-2 px-2">
                                        <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Admin</span>
                                        <div className="flex gap-0.5">
                                           <div className="w-1 h-1 rounded-full bg-green-500" />
                                           <div className="w-1 h-1 rounded-full bg-green-500" />
                                        </div>
                                    </div>
                                </motion.div>

                                {/* AI Power Response */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                                    whileInView={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ delay: 1.8, type: "spring", bounce: 0.4 }}
                                    className={cn(
                                        "p-4 rounded-[1.75rem] rounded-tl-none text-[13px] max-w-[95%] leading-relaxed font-semibold border-2 transition-all",
                                        isDark ? "bg-neutral-800/50 text-neutral-100 border-[#d9ff00]/20" : "bg-white text-neutral-800 border-[#d9ff00]/10"
                                    )}
                                >
                                    Define your <span className="text-[#d9ff00] font-[1000] underline decoration-2 underline-offset-4">Weighting Rubrics</span> in Settings. I'll then auto-calculate rankings instantly.
                                </motion.div>

                                {/* System Feedback */}
                                <motion.div
                                   initial={{ opacity: 0 }}
                                   whileInView={{ opacity: 1 }}
                                   transition={{ delay: 2.6, duration: 0.8 }}
                                   className="flex justify-center"
                                >
                                   <div className="px-3 py-1.5 rounded-full bg-neutral-800/30 text-[9px] uppercase font-bold tracking-[2px] text-neutral-500 border border-neutral-800/50">
                                      AI is writing...
                                   </div>
                                </motion.div>
                            </div>

                            {/* Premium Input Bridge */}
                            <div className="mt-6 pt-5 border-t border-neutral-800/10">
                                <div className={cn(
                                    "h-12 rounded-[1.25rem] px-5 flex items-center justify-between text-[12px] transition-all duration-300",
                                    isDark ? "bg-neutral-900 text-neutral-500 border border-neutral-800" : "bg-white text-neutral-400 border border-neutral-200 shadow-inner"
                                )}>
                                    <span className="font-bold tracking-tight">Ask about Plagiarism...</span>
                                    <motion.div
                                       whileHover={{ scale: 1.1, rotate: 10 }}
                                       className="w-8 h-8 rounded-xl bg-[#d9ff00] flex items-center justify-center shadow-lg shadow-[#d9ff00]/20 cursor-pointer"
                                    >
                                        <MessageSquarePlus className="w-4 h-4 text-neutral-950" />
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Side: Content */}
                    <div className="flex-1 text-left order-1 lg:order-2 z-10">
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                        >
                            <div className={cn(
                                "inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-[10px] font-[1000] uppercase tracking-[0.2em] mb-6 shadow-lg",
                                isDark ? "bg-[#d9ff00]/10 text-[#d9ff00] border border-[#d9ff00]/30" : "bg-neutral-950 text-white"
                            )}>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d9ff00] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d9ff00]"></span>
                                </span>
                                {t('home.gptPromotion.badge')}
                            </div>

                            <h2 className={cn(
                                "text-5xl md:text-6xl lg:text-7xl font-[1000] mb-8 leading-[0.95] tracking-[-0.03em]",
                                isDark ? "text-white" : "text-neutral-950"
                            )}>
                                {t('home.gptPromotion.title').split(' ').map((word, i) => (
                                   <span key={i} className={cn("inline-block", word === 'AI' || word === 'ChatGPT' || word === 'FairArena' ? "text-[#d9ff00] italic" : "")}>
                                     {word}{' '}&nbsp;
                                   </span>
                                ))}
                            </h2>

                            <p className={cn(
                                "text-lg md:text-xl mb-10 leading-relaxed max-w-xl font-[600] opacity-90 tracking-tight",
                                isDark ? "text-neutral-300" : "text-neutral-500"
                            )}>
                                {t('home.gptPromotion.subtitle')}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                                <motion.a
                                    href="https://chatgpt.com/share/699aa58e-6094-8006-8a3e-4e6a80e45dfb"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ scale: 1.05, boxShadow: "0 15px 30px rgba(217,255,0,0.3)" }}
                                    whileTap={{ scale: 0.98 }}
                                    className="inline-flex items-center justify-center gap-4 px-10 h-16 rounded-[1.5rem] bg-[#d9ff00] text-neutral-950 font-[950] text-xl transition-all duration-300 group"
                                >
                                    <MessageSquarePlus className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                    {t('home.gptPromotion.cta')}
                                </motion.a>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

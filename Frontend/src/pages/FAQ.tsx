import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

interface FAQItem {
    q: string;
    a: string;
    category: string;
}


function FAQ() {
    const { isDark } = useTheme();
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

    const faqData = t('faq.items', { returnObjects: true }) as FAQItem[];

    const uniqueCategories = Array.from(new Set(faqData.map((faq) => faq.category)));
    const categories = ['all', ...uniqueCategories];

    const getCategoryLabel = (catKey: string) => {
        return t(`faq.categories.${catKey}`);
    }

    const filteredFAQs = faqData.filter((faq) => {
        const question = faq.q || '';
        const answer = faq.a || '';
        const matchesSearch =
            question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            answer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const toggleQuestion = (index: number) => {
        setExpandedQuestions((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    useEffect(() => {
        document.title = 'FAQ - FairArena | Frequently Asked Questions';
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute(
                'content',
                'Find answers to frequently asked questions about FairArena, the AI-powered hackathon management platform. Learn about features, pricing, security, and more.'
            );
        }
    }, []);

    return (
        <div
            className={`
        w-full min-h-screen flex flex-col items-center pt-20 pb-20 px-6
        ${isDark ? 'bg-[#0b0b0b] text-neutral-300' : 'bg-white text-neutral-800'}
        transition-colors duration-300
      `}
        >
            {/* Header */}
            <motion.header
                className="max-w-4xl w-full mt-20 mb-12 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="flex items-center justify-center gap-3 mb-4">
                    <HelpCircle className="w-12 h-12 text-[#ddef00]" />
                    <h1
                        className={`
              text-5xl sm:text-6xl font-bold
              bg-gradient-to-r from-[#ddef00] via-[#c4d600] to-[#ddef00]
              bg-clip-text text-transparent
            `}
                    >
                        {t('faq.title')}
                    </h1>
                </div>
                <p
                    className={`
            text-lg sm:text-xl mt-4
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
                >
                    {t('faq.subtitle')}
                </p>
            </motion.header>

            {/* Search Bar */}
            <motion.div
                className="max-w-4xl w-full mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <div className="relative">
                    <Search
                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}
                    />
                    <input
                        type="text"
                        placeholder={t('faq.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`
              w-full pl-12 pr-4 py-4 rounded-xl border
              ${isDark
                                ? 'bg-neutral-900/50 border-neutral-800 text-neutral-100 placeholder-neutral-500'
                                : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400'
                            }
              focus:outline-none focus:ring-2 focus:ring-[#ddef00] focus:border-transparent
              transition-all duration-200
            `}
                    />
                </div>
            </motion.div>

            {/* Category Filter */}
            <motion.div
                className="max-w-4xl w-full mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`
                px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                ${selectedCategory === category
                                    ? 'bg-[#ddef00] text-black'
                                    : isDark
                                        ? 'bg-neutral-900/50 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                                        : 'bg-neutral-100 border border-neutral-200 text-neutral-700 hover:bg-neutral-200'
                                }
              `}
                        >
                            {getCategoryLabel(category)}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* FAQ List */}
            <div className="max-w-4xl w-full space-y-4">
                {filteredFAQs.length === 0 ? (
                    <motion.div
                        className={`
              text-center py-12 rounded-xl border
              ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}
            `}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <p className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
                            {t('faq.noResults')}
                        </p>
                    </motion.div>
                ) : (
                    filteredFAQs.map((faq, index) => {
                        const isExpanded = expandedQuestions.has(index);
                        return (
                            <motion.div
                                key={index}
                                className={`
                  rounded-xl border p-6 cursor-pointer
                  ${isDark
                                        ? 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                                        : 'bg-neutral-50/50 border-neutral-200 hover:border-neutral-300'
                                    }
                  transition-all duration-200
                `}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                onClick={() => toggleQuestion(index)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <span
                                            className={`
                        inline-block px-2.5 py-1 rounded-md text-xs font-medium mb-2
                        ${isDark ? 'bg-[#ddef00]/10 text-[#ddef00]' : 'bg-[#ddef00]/20 text-[#9db000]'}
                      `}
                                        >
                                            {getCategoryLabel(faq.category)}
                                        </span>
                                        <h3
                                            className={`
                        text-lg font-semibold
                        ${isDark ? 'text-neutral-100' : 'text-neutral-900'}
                      `}
                                        >
                                            {faq.q}
                                        </h3>
                                    </div>
                                    <ChevronDown
                                        className={`
                      w-5 h-5 flex-shrink-0 mt-1 transition-transform duration-200
                      ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
                      ${isExpanded ? 'rotate-180' : 'rotate-0'}
                    `}
                                    />
                                </div>

                                <motion.div
                                    initial={false}
                                    animate={{
                                        height: isExpanded ? 'auto' : 0,
                                        opacity: isExpanded ? 1 : 0,
                                    }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                >
                                    <p
                                        className={`
                      mt-4 leading-relaxed
                      ${isDark ? 'text-neutral-300' : 'text-neutral-700'}
                    `}
                                    >
                                        {faq.a}
                                    </p>
                                </motion.div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Contact CTA */}
            <motion.div
                className={`
          max-w-4xl w-full mt-16 p-8 rounded-xl text-center
          ${isDark
                        ? 'bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700'
                        : 'bg-gradient-to-br from-neutral-100 to-neutral-50 border border-neutral-200'
                    }
        `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                <h3
                    className={`text-2xl font-semibold mb-3 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
                >
                    {t('faq.contact.title')}
                </h3>
                <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {t('faq.contact.subtitle')}
                </p>
                <a
                    href="/support"
                    className={`
            px-6 py-3 rounded-lg font-medium
            bg-[#ddef00] text-black
            hover:bg-[#c4d600]
            transition-all duration-200
            inline-flex items-center justify-center gap-2
          `}
                >
                    {t('faq.contact.button')}
                </a>
            </motion.div>
        </div>
    );
}

export default FAQ;

import { motion } from 'framer-motion';
import { Award, Calendar, ChevronRight, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface Acknowledgment {
    name: string;
    date: string;
    vulnerability: string;
    link?: string;
}

const acknowledgments: Record<string, Acknowledgment[]> = {
    '2026': [
        // Example entry
        // { name: "Security Researcher Name", date: "Jan 15, 2026", vulnerability: "XSS in Profile Page", link: "https://twitter.com/..." }
    ],
    '2025': []
};

export default function SecurityAcknowledgments() {
    const { t } = useTranslation();
    const [activeYear, setActiveYear] = useState('2026');

    return (
        <>
            <Helmet>
                <title>{t('securityAcknowledgments.title')} - FairArena</title>
                <meta name="description" content={t('securityAcknowledgments.subtitle')} />
            </Helmet>

            <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white">
                <div className="max-w-5xl mx-auto px-6 py-20">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <div className="inline-block p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-2xl mb-6">
                            <Award className="w-12 h-12 text-yellow-400" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                            {t('securityAcknowledgments.title')}
                        </h1>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                            {t('securityAcknowledgments.subtitle')}
                        </p>
                    </motion.div>

                    {/* Year Selector */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex justify-center gap-4 mb-12"
                    >
                        {Object.keys(acknowledgments).sort((a, b) => b.localeCompare(a)).map((year) => (
                            <button
                                key={year}
                                onClick={() => setActiveYear(year)}
                                className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${activeYear === year
                                        ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {year}
                            </button>
                        ))}
                    </motion.div>

                    {/* Content */}
                    <motion.div
                        key={activeYear}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4 }}
                        className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden min-h-[400px]"
                    >
                        {acknowledgments[activeYear].length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/5">
                                            <th className="p-6 font-semibold text-yellow-400 w-1/3">{t('securityAcknowledgments.columns.researcher')}</th>
                                            <th className="p-6 font-semibold text-yellow-400 w-1/4">{t('securityAcknowledgments.columns.date')}</th>
                                            <th className="p-6 font-semibold text-yellow-400 w-1/3">{t('securityAcknowledgments.columns.reported')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {acknowledgments[activeYear].map((entry, index) => (
                                            <tr key={index} className="hover:bg-white/5 transition-colors">
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white/10 rounded-full">
                                                            <User className="w-4 h-4 text-gray-300" />
                                                        </div>
                                                        {entry.link ? (
                                                            <a href={entry.link} target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:text-yellow-400 transition-colors">
                                                                {entry.name}
                                                            </a>
                                                        ) : (
                                                            <span className="font-medium text-white">{entry.name}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-gray-500" />
                                                        {entry.date}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-gray-300">{entry.vulnerability}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                    <Shield className="w-8 h-8 text-gray-500" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">{t('securityAcknowledgments.empty')}</h3>
                                <p className="text-gray-400 max-w-md">
                                    {t('securityAcknowledgments.cta.text')}
                                </p>
                            </div>
                        )}
                    </motion.div>

                    {/* Footer CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="mt-16 text-center"
                    >
                        <Link
                            to="/security-policy"
                            className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300 font-semibold transition-colors group"
                        >
                            {t('securityAcknowledgments.cta.button')}
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                </div>
            </div>
        </>
    );
}

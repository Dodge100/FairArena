import { useTheme } from '@/hooks/useTheme';
import { motion, useInView } from 'framer-motion';
import {
    AlertCircle,
    Bug,
    CheckCircle2,
    ChevronDown,
    Sparkles,
    Wrench,
    Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    changes: {
        type: 'feature' | 'improvement' | 'bugfix' | 'security' | 'breaking';
        description: string;
    }[];
}


const getChangeIcon = (type: ChangelogEntry['changes'][0]['type']) => {
    switch (type) {
        case 'feature':
            return <Sparkles className="w-4 h-4" />;
        case 'improvement':
            return <Zap className="w-4 h-4" />;
        case 'bugfix':
            return <Bug className="w-4 h-4" />;
        case 'security':
            return <CheckCircle2 className="w-4 h-4" />;
        case 'breaking':
            return <AlertCircle className="w-4 h-4" />;
        default:
            return <Wrench className="w-4 h-4" />;
    }
};

const getChangeBadgeColor = (
    type: ChangelogEntry['changes'][0]['type'],
    isDark: boolean
): string => {
    const colors = {
        feature: isDark
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        improvement: isDark
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : 'bg-blue-50 text-blue-700 border-blue-200',
        bugfix: isDark
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : 'bg-amber-50 text-amber-700 border-amber-200',
        security: isDark
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : 'bg-purple-50 text-purple-700 border-purple-200',
        breaking: isDark
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : 'bg-red-50 text-red-700 border-red-200',
    };
    return colors[type];
};

function Changelog() {
    const { isDark } = useTheme();
    const { t } = useTranslation();
    const changelogData = t('changelog.entries', { returnObjects: true }) as ChangelogEntry[];
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

    const isInitialized = useRef(false);

    useEffect(() => {
        if (!isInitialized.current && changelogData && changelogData.length > 0) {
            setExpandedVersions(new Set([changelogData[0].version]));
            isInitialized.current = true;
        }
    }, [changelogData]);

    useEffect(() => {
        document.title = 'Changelog - FairArena | Product Updates & Release Notes';
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute(
                'content',
                'Stay updated with the latest FairArena features, improvements, and bug fixes. View our complete product changelog and release history.'
            );
        }
    }, []);

    const toggleVersion = (version: string) => {
        setExpandedVersions((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(version)) {
                newSet.delete(version);
            } else {
                newSet.add(version);
            }
            return newSet;
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date);
    };

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
                <h1
                    className={`
            text-5xl sm:text-6xl font-bold mb-4
            bg-gradient-to-r from-[#ddef00] via-[#c4d600] to-[#ddef00]
            bg-clip-text text-transparent
          `}
                >
                    {t('changelog.title')}
                </h1>
                <p
                    className={`
            text-lg sm:text-xl mt-4
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
                >
                    {t('changelog.subtitle')}
                </p>
            </motion.header>

            {/* Timeline */}
            <div className="max-w-4xl w-full relative">
                {/* Vertical line - fixed positioning */}
                <div
                    className={`
            absolute left-0 sm:left-8 top-0 bottom-0 w-0.5
            ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}
            hidden sm:block
          `}
                    style={{ height: '100%' }}
                />

                {/* Changelog entries */}
                <div className="space-y-8">
                    {changelogData.map((entry, index) => {
                        const isExpanded = expandedVersions.has(entry.version);

                        return (
                            <ChangelogCard
                                key={entry.version}
                                entry={entry}
                                index={index}
                                isExpanded={isExpanded}
                                toggleVersion={toggleVersion}
                                formatDate={formatDate}
                                isDark={isDark}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Footer CTA */}
            <motion.div
                className={`
          max-w-4xl w-full mt-16 p-8 rounded-xl text-center
          ${isDark
                        ? 'bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700'
                        : 'bg-gradient-to-br from-neutral-100 to-neutral-50 border border-neutral-200'
                    }
        `}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
            >
                <h3
                    className={`text-2xl font-semibold mb-3 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
                >
                    {t('changelog.stayUpdated.title')}
                </h3>
                <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {t('changelog.stayUpdated.text')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                        href="https://github.com/FairArena/FairArena"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
              px-6 py-3 rounded-lg font-medium
              bg-[#ddef00] text-black
              hover:bg-[#c4d600]
              transition-all duration-200
              inline-flex items-center justify-center gap-2
            `}
                    >
                        <Sparkles className="w-4 h-4" />
                        {t('changelog.stayUpdated.github')}
                    </a>
                    <a
                        href="/support"
                        className={`
              px-6 py-3 rounded-lg font-medium border
              ${isDark
                                ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                                : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                            }
              transition-all duration-200
              inline-flex items-center justify-center gap-2
            `}
                    >
                        {t('changelog.stayUpdated.request')}
                    </a>
                </div>
            </motion.div>
        </div>
    );
}

// Optimized changelog card component
const ChangelogCard = ({
    entry,
    index,
    isExpanded,
    toggleVersion,
    formatDate,
    isDark,
}: {
    entry: ChangelogEntry;
    index: number;
    isExpanded: boolean;
    toggleVersion: (version: string) => void;
    formatDate: (date: string) => string;
    isDark: boolean;
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(cardRef, { once: true, margin: '-50px' });

    return (
        <motion.article
            ref={cardRef}
            className="relative pl-0 sm:pl-20"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
        >
            {/* Timeline dot */}
            <div
                className={`
          absolute left-0 sm:left-[26px] top-6 w-4 h-4 rounded-full
          border-4 hidden sm:block
          ${isDark ? 'bg-[#ddef00] border-[#0b0b0b]' : 'bg-[#ddef00] border-white'}
        `}
            />

            {/* Card */}
            <div
                className={`
          rounded-xl border p-6
          ${isDark
                        ? 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                        : 'bg-neutral-50/50 border-neutral-200 hover:border-neutral-300'
                    }
          backdrop-blur-sm
          transition-all duration-200
          cursor-pointer
        `}
                onClick={() => toggleVersion(entry.version)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleVersion(entry.version);
                    }
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span
                                className={`
                  inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold
                  ${isDark ? 'bg-[#ddef00]/10 text-[#ddef00]' : 'bg-[#ddef00]/20 text-[#9db000]'}
                `}
                            >
                                v{entry.version}
                            </span>
                            <time
                                className={`text-sm ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}
                                dateTime={entry.date}
                            >
                                {formatDate(entry.date)}
                            </time>
                        </div>
                        <h2
                            className={`
                text-xl sm:text-2xl font-semibold mt-3
                ${isDark ? 'text-neutral-100' : 'text-neutral-900'}
              `}
                        >
                            {entry.title}
                        </h2>
                    </div>
                    <ChevronDown
                        className={`
              w-5 h-5 flex-shrink-0 mt-1 transition-transform duration-200
              ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
              ${isExpanded ? 'rotate-180' : 'rotate-0'}
            `}
                    />
                </div>

                {/* Changes list */}
                <motion.div
                    initial={false}
                    animate={{
                        height: isExpanded ? 'auto' : 0,
                        opacity: isExpanded ? 1 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                >
                    <ul className="space-y-3 mt-6">
                        {entry.changes.map((change, changeIndex) => (
                            <li
                                key={changeIndex}
                                className={`
                  flex items-start gap-3 p-3 rounded-lg
                  ${isDark
                                        ? 'bg-neutral-800/30 hover:bg-neutral-800/50'
                                        : 'bg-white/50 hover:bg-white/80'
                                    }
                  transition-colors duration-150
                `}
                            >
                                <span
                                    className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
                    text-xs font-medium border flex-shrink-0
                    ${getChangeBadgeColor(change.type, isDark)}
                  `}
                                >
                                    {getChangeIcon(change.type)}
                                    <span className="capitalize">{change.type}</span>
                                </span>
                                <p
                                    className={`
                    text-sm leading-relaxed pt-0.5
                    ${isDark ? 'text-neutral-300' : 'text-neutral-700'}
                  `}
                                >
                                    {change.description}
                                </p>
                            </li>
                        ))}
                    </ul>
                </motion.div>
            </div>
        </motion.article>
    );
};

export default Changelog;

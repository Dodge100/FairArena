import { useTheme } from '@/hooks/useTheme';
import { Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
];

export function LanguageSelector() {
    const { i18n } = useTranslation();
    const { isDark } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        setIsOpen(false);
    };

    const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center gap-2 px-4 py-2 rounded-lg border
          ${isDark
                        ? 'bg-neutral-900/50 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                        : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                    }
          transition-all duration-200
        `}
                aria-label="Select language"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <Globe className="w-4 h-4" aria-hidden="true" />
                <span className="text-sm font-medium">{currentLanguage.nativeName}</span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className={`
            absolute right-0 mt-2 w-48 rounded-lg border shadow-lg
            ${isDark
                            ? 'bg-neutral-900 border-neutral-800'
                            : 'bg-white border-neutral-200'
                        }
            animate-in fade-in zoom-in-95 duration-200 z-50
            `}
                    role="menu"
                    aria-label="Language options"
                >
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={`
                w-full text-left px-4 py-3 text-sm
                ${i18n.language === lang.code
                                    ? isDark
                                        ? 'bg-[#ddef00]/10 text-[#ddef00]'
                                        : 'bg-[#ddef00]/20 text-[#9db000]'
                                    : isDark
                                        ? 'text-neutral-300 hover:bg-neutral-800'
                                        : 'text-neutral-700 hover:bg-neutral-50'
                                }
                transition-colors duration-150
                first:rounded-t-lg last:rounded-b-lg
                `}
                            role="menuitem"
                            lang={lang.code}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{lang.nativeName}</span>
                                {i18n.language === lang.code && (
                                    <span className="text-xs" aria-label="Currently selected">✓</span>
                                )}
                            </div>
                            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                                {lang.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/hooks/useTheme';
import { AlertCircle, FileText, Mail, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const RefundPage = () => {
    const { isDark } = useTheme();
    const { t } = useTranslation();

    return (
        <div className={`min-h-screen pt-32 pb-20 px-4 transition-colors duration-300 ${isDark ? 'bg-[#0a0a0a]' : 'bg-neutral-50'}`}>
            <div className="container mx-auto max-w-4xl relative z-10">
                {/* Header */}
                <div className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-red-500/10 text-red-500 mb-4 border border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <h1 className={`text-4xl md:text-6xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                        {t('refund.title')}
                    </h1>
                    <p className={`text-lg md:text-xl max-w-2xl mx-auto ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {t('refund.subtitle')}
                    </p>
                </div>

                {/* Main Content Grid */}
                <div className="grid gap-8">
                    {/* Policy Card */}
                    <Card className={`border-0 shadow-xl overflow-hidden ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-neutral-200'}`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 opacity-80" />
                        <CardHeader className="pb-2">
                            <CardTitle className={`text-2xl flex items-center gap-3 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                <FileText className="w-6 h-6 text-red-500" />
                                {t('refund.policyTitle')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            <div className={`p-6 rounded-xl border ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                                <p className={`text-lg leading-relaxed font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                                    {t('refund.policyText')}
                                </p>
                            </div>

                            <div className="ml-4 border-l-2 border-red-500 pl-6 py-2">
                                <p className={`italic ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {t('refund.disclaimer')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Criteria Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className={`border ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-neutral-200'}`}>
                            <CardHeader>
                                <CardTitle className={`text-xl ${isDark ? 'text-white' : 'text-neutral-900'}`}>{t('refund.criteria.h1')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {(t('refund.criteria.list', { returnObjects: true }) as string[]).map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <span className="text-red-500 mt-1">•</span>
                                            <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className={`border ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-neutral-200'}`}>
                            <CardHeader>
                                <CardTitle className={`text-xl ${isDark ? 'text-white' : 'text-neutral-900'}`}>{t('refund.exceptions.h1')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {(t('refund.exceptions.list', { returnObjects: true }) as string[]).map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <span className="text-[#ddef00] mt-1">•</span>
                                            <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Contact Section */}
                    <div className={`rounded-2xl p-8 text-center border relative overflow-hidden group ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r ${isDark ? 'from-neutral-800/50 to-transparent' : 'from-neutral-100 to-transparent'}`} />
                        <div className="relative z-10 flex flex-col items-center gap-6">
                            <div className="p-4 rounded-full bg-[#ddef00]/10 text-[#ddef00]">
                                <Mail className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>{t('refund.contact.title')}</h3>
                                <p className={`max-w-md mx-auto ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {t('refund.contact.desc')}
                                </p>
                            </div>
                            <Button
                                onClick={() => window.open('mailto:fairarena.contact@gmail.com?subject=Refund Request', '_blank')}
                                className="bg-[#ddef00] text-black hover:bg-[#ddef00]/90 font-semibold rounded-full px-8 py-6 text-lg transition-transform hover:scale-105"
                            >
                                {t('refund.contact.button')}
                            </Button>
                        </div>
                    </div>

                    {/* Footer Note */}
                    <div className="text-center pt-8 border-t border-neutral-200 dark:border-neutral-800">
                        <div className="flex items-center justify-center gap-2 mb-2 text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm font-semibold uppercase tracking-wider">{t('refund.date')}</span>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                            {t('refund.footer')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundPage;

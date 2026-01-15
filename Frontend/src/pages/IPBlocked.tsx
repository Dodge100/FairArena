import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Mail, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IPBlockedPageProps {
    reasons?: string[];
    onRetry?: () => void;
}

const IPBlockedPage = ({ reasons = [], onRetry }: IPBlockedPageProps) => {
    const [countdown, setCountdown] = useState(30);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleRetry = () => {
        if (onRetry) {
            onRetry();
        } else {
            window.location.reload();
        }
    };

    const handleContactSupport = () => {
        window.location.href = 'mailto:fairarena.contact@gmail.com?subject=IP%20Security%20Block%20Appeal';
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -inset-[10px] opacity-50">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse" />
                    <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse delay-1000" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-pink-500 rounded-full blur-3xl opacity-20 animate-pulse delay-2000" />
                </div>
            </div>

            <Card className="relative z-10 w-full max-w-2xl border-slate-700 bg-slate-800/90 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
                        <Shield className="h-10 w-10 text-white" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">
                        Access Restricted
                    </CardTitle>
                    <CardDescription className="text-slate-300 text-lg">
                        Our security system has detected unusual activity from your connection
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Security Flags */}
                    {reasons.length > 0 && (
                        <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="h-5 w-5 text-red-400" />
                                <h3 className="text-sm font-semibold text-red-300 uppercase tracking-wide">
                                    Security Flags Detected
                                </h3>
                            </div>
                            <ul className="space-y-2">
                                {reasons.map((reason, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                                        <span className="text-red-400 mt-0.5">•</span>
                                        <span>{reason}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Resolution Steps */}
                    <div className="rounded-lg border border-blue-500/30 bg-blue-950/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="h-5 w-5 text-blue-400" />
                            <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
                                How to Resolve This
                            </h3>
                        </div>
                        <ul className="space-y-2">
                            <li className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-blue-400 mt-0.5">→</span>
                                <span>Disable VPN or proxy if active</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-blue-400 mt-0.5">→</span>
                                <span>Avoid using Tor or anonymous browsers</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-blue-400 mt-0.5">→</span>
                                <span>Ensure your browser is not flagged as an automation tool</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-blue-400 mt-0.5">→</span>
                                <span>Try using a standard, residential network</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-slate-300">
                                <span className="text-blue-400 mt-0.5">→</span>
                                <span>Clear your browser cache and cookies</span>
                            </li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                            onClick={handleRetry}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold shadow-lg"
                            size="lg"
                        >
                            Retry Connection
                            {countdown > 0 && (
                                <span className="ml-2 text-xs opacity-80">({countdown}s)</span>
                            )}
                        </Button>
                        <Button
                            onClick={handleContactSupport}
                            variant="outline"
                            className="flex-1 border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white font-semibold"
                            size="lg"
                        >
                            <Mail className="mr-2 h-4 w-4" />
                            Contact Support
                        </Button>
                    </div>

                    {/* Footer */}
                    <div className="text-center pt-4 border-t border-slate-700">
                        <p className="text-xs text-slate-400">
                            If you believe this is an error, please contact our support team at{' '}
                            <a
                                href="mailto:fairarena.contact@gmail.com"
                                className="text-blue-400 hover:text-blue-300 underline"
                            >
                                fairarena.contact@gmail.com
                            </a>
                        </p>
                    </div>

                    {/* Auto-retry countdown */}
                    {countdown === 0 && (
                        <div className="text-center">
                            <p className="text-sm text-slate-400 animate-pulse">
                                Auto-retrying connection...
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default IPBlockedPage;

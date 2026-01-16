import { ArrowLeft, CheckCircle2, Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface OAuthBannerProps {
    appName?: string;
    appLogoUrl?: string;
    isVerified?: boolean;
    onCancel?: () => void;
}

export function OAuthBanner({ appName, appLogoUrl, isVerified, onCancel }: OAuthBannerProps) {
    const navigate = useNavigate();
    const [oauthRequestId, setOauthRequestId] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestId = params.get('oauth_request') || sessionStorage.getItem('oauth_request_id');
        setOauthRequestId(requestId);
    }, []);

    if (!oauthRequestId || !isVisible) return null;

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            sessionStorage.removeItem('oauth_request_id');
            navigate('/dashboard');
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
            {/* Backdrop blur */}
            <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800" />

            {/* Content */}
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: App Info */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* App Logo */}
                        <div className="flex-shrink-0">
                            {appLogoUrl ? (
                                <div className="relative">
                                    <img
                                        src={appLogoUrl}
                                        alt={appName || 'App'}
                                        className="w-12 h-12 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 shadow-sm"
                                    />
                                    {isVerified && (
                                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-black p-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                                            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 fill-blue-100 dark:fill-blue-900" />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-neutral-400" />
                                </div>
                            )}
                        </div>

                        {/* Text Content */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                                    {appName ? (
                                        <>Sign in to continue to <span className="text-blue-600 dark:text-blue-400">{appName}</span></>
                                    ) : (
                                        'Sign in to continue'
                                    )}
                                </h2>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                You'll review permissions on the next screen
                            </p>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleCancel}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Cancel</span>
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                            aria-label="Dismiss banner"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Mobile Cancel Button */}
                <button
                    onClick={handleCancel}
                    className="sm:hidden mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Cancel Authorization</span>
                </button>
            </div>
        </div>
    );
}

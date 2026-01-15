import { AlertCircle, ArrowLeft, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface OAuthBannerProps {
    appName?: string;
    appLogoUrl?: string;
    onCancel?: () => void;
}

export function OAuthBanner({ appName, appLogoUrl, onCancel }: OAuthBannerProps) {
    const navigate = useNavigate();
    const [oauthRequestId, setOauthRequestId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestId = params.get('oauth_request') || sessionStorage.getItem('oauth_request_id');
        setOauthRequestId(requestId);
    }, []);

    if (!oauthRequestId) return null;

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            // Clear OAuth context and navigate away
            sessionStorage.removeItem('oauth_request_id');
            navigate('/dashboard');
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5" />
                        <div className="flex items-center gap-2">
                            {appLogoUrl && (
                                <img
                                    src={appLogoUrl}
                                    alt={appName || 'App'}
                                    className="w-6 h-6 rounded"
                                />
                            )}
                            <span className="font-semibold">
                                {appName ? (
                                    <>Sign in to authorize <span className="font-bold">{appName}</span></>
                                ) : (
                                    'Sign in to authorize application'
                                )}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleCancel}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Cancel
                    </button>
                </div>

                <div className="mt-2 flex items-start gap-2 text-xs text-white/90">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>
                        You're being asked to sign in to FairArena to authorize access for this application.
                        After signing in, you'll be asked to approve what data to share.
                    </p>
                </div>
            </div>
        </div>
    );
}

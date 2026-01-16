import { AlertTriangle, ArrowLeft, ExternalLink, HelpCircle, RefreshCw, Shield } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface ErrorInfo {
    title: string;
    description: string;
    solutions: string[];
    technicalDetails?: string;
}

const ERROR_MESSAGES: Record<string, ErrorInfo> = {
    invalid_request: {
        title: 'Invalid Request',
        description: 'The authorization request is missing required parameters or contains invalid values.',
        solutions: [
            'Check that the application is using the correct authorization URL',
            'Ensure all required parameters (client_id, redirect_uri, scope) are included',
            'Verify that the redirect_uri matches exactly what was registered',
        ],
    },
    invalid_client: {
        title: 'Invalid Client',
        description: 'The application could not be verified or is not authorized to make this request.',
        solutions: [
            'Contact the application developer to verify their OAuth configuration',
            'Ensure the application is registered with FairArena',
            'Check that the client_id is correct',
        ],
    },
    access_denied: {
        title: 'Access Denied',
        description: 'You denied the authorization request or the request was cancelled.',
        solutions: [
            'Try authorizing again if this was a mistake',
            'Contact the application support if you believe this is an error',
        ],
    },
    invalid_scope: {
        title: 'Invalid Scope',
        description: 'The application requested permissions that are not available or not allowed.',
        solutions: [
            'Contact the application developer about the requested permissions',
            'The application may need to update its OAuth configuration',
        ],
    },
    server_error: {
        title: 'Server Error',
        description: 'An unexpected error occurred on our servers while processing your request.',
        solutions: [
            'Try again in a few moments',
            'If the problem persists, contact FairArena support',
            'Check our status page for any ongoing incidents',
        ],
    },
    temporarily_unavailable: {
        title: 'Service Temporarily Unavailable',
        description: 'Our authorization service is temporarily unavailable due to maintenance or high load.',
        solutions: [
            'Wait a few minutes and try again',
            'Check our status page for maintenance updates',
        ],
    },
    expired: {
        title: 'Request Expired',
        description: 'This authorization request has expired and is no longer valid.',
        solutions: [
            'Return to the application and start the sign-in process again',
            'Authorization requests expire after 10 minutes for security',
        ],
    },
    already_used: {
        title: 'Request Already Used',
        description: 'This authorization request has already been completed.',
        solutions: [
            'If you need to authorize again, start a new sign-in from the application',
            'Check if you already have an active session with the application',
        ],
    },
};

export default function OAuthError() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const error = searchParams.get('error') || 'server_error';
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');

    const errorInfo = ERROR_MESSAGES[error] || {
        title: 'Authorization Error',
        description: errorDescription || 'An error occurred during the authorization process.',
        solutions: [
            'Try starting the authorization process again',
            'Contact the application support if the problem persists',
        ],
    };

    const handleRetry = () => {
        // If there's a state parameter, we might be able to retry
        if (state) {
            navigate(`/oauth/authorize?${searchParams.toString().replace(/&?error[^&]*/g, '')}`);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-50 dark:from-neutral-950 dark:via-black dark:to-neutral-950 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Main Error Card */}
                <div className="bg-white dark:bg-black rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
                    {/* Header with Icon */}
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-b border-red-100 dark:border-red-900/30 p-8">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                                    {errorInfo.title}
                                </h1>
                                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                    {errorInfo.description}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Solutions Section */}
                    <div className="p-8 space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <HelpCircle className="w-5 h-5 text-neutral-500" />
                                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                                    How to fix this
                                </h2>
                            </div>
                            <ul className="space-y-3">
                                {errorInfo.solutions.map((solution, index) => (
                                    <li key={index} className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                                            {index + 1}
                                        </span>
                                        <span className="pt-0.5">{solution}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Technical Details (if available) */}
                        {errorDescription && (
                            <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
                                <details className="group">
                                    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                                        <span>Technical details</span>
                                        <ExternalLink className="w-4 h-4" />
                                    </summary>
                                    <div className="mt-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                                        <code className="text-xs text-neutral-600 dark:text-neutral-400 font-mono break-all">
                                            {errorDescription}
                                        </code>
                                    </div>
                                </details>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                onClick={handleRetry}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all active:scale-[0.99] shadow-sm"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-white dark:bg-black text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-xl font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all active:scale-[0.99]"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 flex items-center justify-center gap-2 text-neutral-400">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">Secured by FairArena OAuth</span>
                </div>
            </div>
        </div>
    );
}

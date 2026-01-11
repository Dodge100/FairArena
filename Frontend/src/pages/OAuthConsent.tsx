import { useAuthState } from '@/contexts/AuthContext';
import { type AuthorizationRequest, getAuthorizationRequest, type OAuthScope, submitConsent } from '@/services/oauthService';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    ExternalLink,
    Loader2,
    Lock,
    Mail,
    Shield,
    User,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export default function OAuthConsent() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isSignedIn, user } = useAuthState();

    const requestId = searchParams.get('request_id');

    const [authRequest, setAuthRequest] = useState<AuthorizationRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!requestId) {
            setError('Missing authorization request ID');
            setLoading(false);
            return;
        }

        if (!isSignedIn) {
            // Redirect to login with return URL
            navigate(`/signin?oauth_request=${requestId}`);
            return;
        }

        loadAuthorizationRequest();
    }, [requestId, isSignedIn]);

    async function loadAuthorizationRequest() {
        try {
            const data = await getAuthorizationRequest(requestId!);
            setAuthRequest(data);
            // Select all scopes by default
            setSelectedScopes(new Set(data.scopes.map((s) => s.name)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load authorization request');
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove() {
        if (!requestId) return;

        setSubmitting(true);
        try {
            await submitConsent({
                request_id: requestId,
                action: 'approve',
                scopes: Array.from(selectedScopes),
            });
            // The endpoint redirects on success
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to authorize');
            setSubmitting(false);
        }
    }

    async function handleDeny() {
        if (!requestId) return;

        setSubmitting(true);
        try {
            await submitConsent({
                request_id: requestId,
                action: 'deny',
            });
            // The endpoint redirects on success
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to deny authorization');
            setSubmitting(false);
        }
    }

    function toggleScope(scopeName: string) {
        // openid is required and cannot be deselected
        if (scopeName === 'openid') return;

        const newScopes = new Set(selectedScopes);
        if (newScopes.has(scopeName)) {
            newScopes.delete(scopeName);
        } else {
            newScopes.add(scopeName);
        }
        setSelectedScopes(newScopes);
    }

    function getScopeIcon(scope: OAuthScope) {
        switch (scope.name) {
            case 'openid':
                return <Lock className="w-5 h-5 text-blue-500" />;
            case 'profile':
                return <User className="w-5 h-5 text-green-500" />;
            case 'email':
                return <Mail className="w-5 h-5 text-purple-500" />;
            case 'offline_access':
                return <Clock className="w-5 h-5 text-orange-500" />;
            default:
                return <Shield className="w-5 h-5 text-gray-500" />;
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-gray-400">Loading authorization request...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
                <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full border border-red-500/20">
                    <div className="flex flex-col items-center gap-4">
                        <XCircle className="w-16 h-16 text-red-500" />
                        <h1 className="text-xl font-semibold text-white">Authorization Error</h1>
                        <p className="text-gray-400 text-center">{error}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!authRequest) {
        return null;
    }

    const { application, scopes, expiresAt } = authRequest;
    const expiresIn = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000 / 60));

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full border border-gray-700/50 shadow-2xl">
                {/* Header */}
                <div className="flex flex-col items-center mb-6">
                    {application.logoUrl ? (
                        <img
                            src={application.logoUrl}
                            alt={application.name}
                            className="w-16 h-16 rounded-xl mb-4 object-cover"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-xl mb-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                    )}

                    <h1 className="text-xl font-bold text-white text-center">{application.name}</h1>

                    {application.isVerified && (
                        <span className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                        </span>
                    )}
                </div>

                {/* Description */}
                <p className="text-gray-400 text-center mb-6">
                    <span className="text-white font-medium">{application.name}</span> wants to access your FairArena account
                </p>

                {/* User info */}
                <div className="bg-gray-700/30 rounded-lg p-3 mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <p className="text-white text-sm font-medium">
                            {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-gray-400 text-xs">{user?.email}</p>
                    </div>
                </div>

                {/* Scopes */}
                <div className="mb-6">
                    <h2 className="text-sm font-medium text-gray-300 mb-3">This will allow {application.name} to:</h2>
                    <div className="space-y-2">
                        {scopes.map((scope) => (
                            <label
                                key={scope.name}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${selectedScopes.has(scope.name)
                                    ? 'bg-gray-700/50 border-gray-600'
                                    : 'bg-gray-800/30 border-gray-700/50'
                                    } ${scope.name === 'openid' ? 'cursor-not-allowed opacity-75' : 'hover:bg-gray-700/30'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedScopes.has(scope.name)}
                                    onChange={() => toggleScope(scope.name)}
                                    disabled={scope.name === 'openid'}
                                    className="mt-1 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {getScopeIcon(scope)}
                                        <span className="text-white text-sm font-medium">{scope.displayName}</span>
                                        {scope.isDangerous && (
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        )}
                                    </div>
                                    <p className="text-gray-400 text-xs mt-1">{scope.description}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Warning */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6">
                    <p className="text-amber-400 text-xs">
                        Make sure you trust {application.name}. By allowing access, this app will be able to use the selected
                        permissions on your behalf.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleDeny}
                        disabled={submitting}
                        className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Deny'}
                    </button>
                    <button
                        onClick={handleApprove}
                        disabled={submitting || selectedScopes.size === 0}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Allow'}
                    </button>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-700/50">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Expires in {expiresIn} minutes</span>
                        <div className="flex gap-3">
                            {application.privacyPolicyUrl && (
                                <a
                                    href={application.privacyPolicyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-gray-400 inline-flex items-center gap-1"
                                >
                                    Privacy <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                            {application.termsOfServiceUrl && (
                                <a
                                    href={application.termsOfServiceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-gray-400 inline-flex items-center gap-1"
                                >
                                    Terms <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

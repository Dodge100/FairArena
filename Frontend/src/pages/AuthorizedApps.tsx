/**
 * Authorized Applications Page
 *
 * Shows users which apps they've authorized and allows them to revoke access.
 */

import { listConsents, type OAuthConsent, revokeConsent } from '@/services/oauthService';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Clock,
    ExternalLink,
    Loader2,
    Lock,
    Mail,
    Shield,
    ShieldCheck,
    Trash2,
    User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function AuthorizedApps() {
    const [consents, setConsents] = useState<OAuthConsent[]>([]);
    const [loading, setLoading] = useState(true);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [showRevokeConfirm, setShowRevokeConfirm] = useState<OAuthConsent | null>(null);

    useEffect(() => {
        loadConsents();
    }, []);

    async function loadConsents() {
        try {
            const data = await listConsents();
            setConsents(data.consents);
        } catch (err) {
            toast.error('Failed to load authorized applications');
        } finally {
            setLoading(false);
        }
    }

    async function handleRevoke(consent: OAuthConsent) {
        setRevoking(consent.id);
        try {
            await revokeConsent(consent.application.id);
            toast.success(`Access revoked for ${consent.application.name}`);
            setConsents((c) => c.filter((item) => item.id !== consent.id));
            setShowRevokeConfirm(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to revoke access');
        } finally {
            setRevoking(null);
        }
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    function getScopeIcon(scope: string) {
        switch (scope) {
            case 'openid':
                return <Lock className="w-4 h-4" />;
            case 'profile':
                return <User className="w-4 h-4" />;
            case 'email':
                return <Mail className="w-4 h-4" />;
            case 'offline_access':
                return <Clock className="w-4 h-4" />;
            default:
                return <Shield className="w-4 h-4" />;
        }
    }

    function getScopeName(scope: string) {
        const names: Record<string, string> = {
            openid: 'OpenID',
            profile: 'Profile',
            email: 'Email',
            offline_access: 'Offline Access',
        };
        return names[scope] || scope;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-400">Loading authorized applications...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Authorized Applications</h1>
                            <p className="text-gray-400 mt-1">
                                Manage third-party applications that have access to your FairArena account
                            </p>
                        </div>
                    </div>

                    {consents.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-6">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-blue-300 font-medium">Security Tip</p>
                                    <p className="text-sm text-blue-200/80 mt-1">
                                        Regularly review and revoke access for applications you no longer use to keep your account secure.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Consents List */}
                {consents.length === 0 ? (
                    <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-16 text-center border border-gray-700/50">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mx-auto mb-6">
                            <ShieldCheck className="w-12 h-12 text-gray-500" />
                        </div>
                        <h2 className="text-2xl font-semibold text-white mb-3">No Authorized Applications</h2>
                        <p className="text-gray-400 max-w-md mx-auto">
                            You haven't authorized any third-party applications to access your account yet. When you do, they'll appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {consents.map((consent) => (
                            <div
                                key={consent.id}
                                className="group bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 hover:shadow-xl"
                            >
                                <div className="flex items-start gap-5">
                                    {/* App Logo */}
                                    {consent.application.logoUrl ? (
                                        <img
                                            src={consent.application.logoUrl}
                                            alt={consent.application.name}
                                            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                            <Shield className="w-8 h-8 text-white" />
                                        </div>
                                    )}

                                    {/* App Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-lg font-semibold text-white truncate">{consent.application.name}</h3>
                                            {consent.application.isVerified && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full flex-shrink-0">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Verified
                                                </span>
                                            )}
                                        </div>

                                        {consent.application.description && (
                                            <p className="text-gray-400 text-sm mb-4 line-clamp-1">{consent.application.description}</p>
                                        )}

                                        {/* Granted Scopes */}
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-500 font-medium mb-2">GRANTED PERMISSIONS</p>
                                            <div className="flex flex-wrap gap-2">
                                                {consent.grantedScopes.map((scope) => (
                                                    <span
                                                        key={scope}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 text-gray-300 text-sm rounded-lg border border-gray-600/30"
                                                    >
                                                        {getScopeIcon(scope)}
                                                        {getScopeName(scope)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Authorized {formatDate(consent.createdAt)}
                                            </span>
                                            {consent.application.websiteUrl && (
                                                <a
                                                    href={consent.application.websiteUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 hover:text-gray-400 transition-colors"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    Visit Website
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Revoke Button */}
                                    <button
                                        onClick={() => setShowRevokeConfirm(consent)}
                                        className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-all duration-200 inline-flex items-center gap-2 flex-shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Revoke Access
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Revoke Confirmation Modal */}
                {showRevokeConfirm && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-2xl">
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Revoke Access</h2>
                            </div>

                            <p className="text-gray-400 text-center mb-6">
                                Are you sure you want to revoke access for{' '}
                                <span className="text-white font-medium">{showRevokeConfirm.application.name}</span>? The application
                                will no longer be able to access your account.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowRevokeConfirm(null)}
                                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleRevoke(showRevokeConfirm)}
                                    disabled={revoking === showRevokeConfirm.id}
                                    className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                                >
                                    {revoking === showRevokeConfirm.id ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    ) : (
                                        'Revoke Access'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

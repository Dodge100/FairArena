import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import { useAuthState } from '@/contexts/AuthContext';
import {
  type AuthorizationRequest,
  getAuthorizationRequest,
  type OAuthScope,
  submitConsent,
} from '@/services/oauthService';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe,
  Info,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  User,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export default function OAuthConsent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuthState();

  const requestId = searchParams.get('request_id');

  const [authRequest, setAuthRequest] = useState<AuthorizationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError('Missing authorization request ID');
      setLoading(false);
      return;
    }

    if (!isSignedIn) {
      navigate(`/signin?oauth_request=${requestId}`);
      return;
    }

    loadAuthorizationRequest();
  }, [requestId, isSignedIn]);

  async function loadAuthorizationRequest() {
    try {
      const data = await getAuthorizationRequest(requestId!);
      setAuthRequest(data);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deny authorization');
      setSubmitting(false);
    }
  }

  function toggleScope(scopeName: string) {
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
    // Monochrome icons
    switch (scope.name) {
      case 'openid':
        return <Lock className="w-5 h-5" />;
      case 'profile':
        return <User className="w-5 h-5" />;
      case 'email':
        return <Mail className="w-5 h-5" />;
      case 'offline_access':
        return <Clock className="w-5 h-5" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-900 dark:text-neutral-100" />
          <p className="text-sm font-medium text-neutral-500">Securely loading request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-black rounded-xl p-8 max-w-md w-full border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-neutral-900 dark:text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Authorization Error
              </h1>
              <p className="text-sm text-neutral-500">{error}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!authRequest) return null;

  const { application, scopes } = authRequest;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-300">
      {/* Main Card */}
      <div className="w-full max-w-[440px] bg-white dark:bg-black rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="p-8 pb-6 flex flex-col items-center text-center border-b border-neutral-100 dark:border-neutral-900">
          <div className="mb-6 relative">
            {application?.logoUrl ? (
              <img
                src={application.logoUrl}
                alt={application.name || 'Application'}
                className="w-20 h-20 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-800 shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                <Shield className="w-8 h-8 text-neutral-400" />
              </div>
            )}
            {application?.isVerified && (
              <div className="absolute -bottom-2 -right-2 bg-white dark:bg-black p-1 rounded-full border border-neutral-100 dark:border-neutral-800 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-neutral-900 dark:text-white fill-neutral-100 dark:fill-neutral-800" />
              </div>
            )}
          </div>

          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
            {application?.name || 'FairArena'} wants access
          </h1>

          {application?.description && (
            <p className="text-sm text-neutral-500 mb-4">{application.description}</p>
          )}

          {/* Account Switcher */}
          <div className="w-full mt-4">
            <AccountSwitcher requestId={requestId || undefined} />
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-6">
          {/* Permission List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Requested Permissions
              </h2>
            </div>

            <div className="space-y-2">
              {scopes.map((scope) => {
                const isSelected = selectedScopes.has(scope.name);
                const isLocked = scope.name === 'openid';

                return (
                  <label
                    key={scope.name}
                    className={`group relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none
                                            ${
                                              isSelected
                                                ? 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                                                : 'bg-transparent border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
                                            }
                                            ${isLocked ? 'cursor-not-allowed opacity-80' : ''}
                                        `}
                  >
                    <div
                      className={`mt-0.5 ${isSelected ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}
                    >
                      {getScopeIcon(scope)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${isSelected ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'}`}
                        >
                          {scope.displayName}
                        </span>
                        {scope.isDangerous && (
                          <ShieldAlert className="w-3.5 h-3.5 text-neutral-500" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                        {scope.description}
                      </p>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleScope(scope.name)}
                        disabled={isLocked}
                        className="peer sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                                                ${
                                                  isSelected
                                                    ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white'
                                                    : 'border-neutral-300 dark:border-neutral-700'
                                                }
                                            `}
                      >
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-black" />
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* App Details Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              {showDetails ? 'Hide application details' : 'Show application details'}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              />
            </button>

            {showDetails && (
              <div className="mt-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 space-y-3 animate-in fade-in slide-in-from-top-1">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-neutral-400 mb-1">Developer</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-200">
                      {application.isVerified ? 'Verified Developer' : 'Unverified Developer'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-neutral-400 mb-1">Homepage</span>
                    {application.websiteUrl ? (
                      <a
                        href={application.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-200 hover:underline"
                      >
                        <Globe className="w-3 h-3" />
                        Visit website
                      </a>
                    ) : (
                      <span className="text-neutral-500">Not provided</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex gap-4 text-xs text-neutral-500">
                  {application.privacyPolicyUrl && (
                    <a
                      href={application.privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-neutral-900 dark:hover:text-neutral-300 hover:underline"
                    >
                      Privacy Policy
                    </a>
                  )}
                  {application.termsOfServiceUrl && (
                    <a
                      href={application.termsOfServiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-neutral-900 dark:hover:text-neutral-300 hover:underline"
                    >
                      Terms of Service
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="p-6 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-col gap-3">
            <button
              onClick={handleApprove}
              disabled={submitting || selectedScopes.size === 0}
              className="w-full py-3.5 px-4 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black rounded-xl font-semibold shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authorize Access'}
            </button>
            <button
              onClick={handleDeny}
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-white dark:bg-black hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded-xl font-medium transition-all active:scale-[0.99] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <p className="mt-4 text-center text-[10px] text-neutral-400">
            You will be redirected to{' '}
            <span className="font-mono text-neutral-500">
              {(() => {
                try {
                  return new URL(authRequest.redirectUri).hostname;
                } catch {
                  return authRequest.redirectUri;
                }
              })()}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 text-neutral-400">
        <Shield className="w-3 h-3" />
        <span className="text-xs font-medium tracking-wide">SECURED BY FAIRARENA</span>
      </div>
    </div>
  );
}

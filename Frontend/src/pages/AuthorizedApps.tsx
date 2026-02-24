/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

/**
 * Authorized Applications Page
 *
 * Shows users which apps they've authorized and allows them to revoke access.
 */

import { listConsents, type OAuthConsent, revokeConsent } from '@/services/oauthService';
import {
  Activity,
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
        return <Lock className="w-3.5 h-3.5" />;
      case 'profile':
        return <User className="w-3.5 h-3.5" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5" />;
      case 'offline_access':
        return <Clock className="w-3.5 h-3.5" />;
      default:
        return <Shield className="w-3.5 h-3.5" />;
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
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-900 dark:text-neutral-100 mx-auto mb-4" />
          <p className="text-sm font-medium text-neutral-500">Loading authorized applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-4 sm:p-6 md:p-10 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
              <ShieldCheck className="w-6 h-6 text-neutral-900 dark:text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
                Authorized Apps
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
                Manage third-party applications that have access to your FairArena account.
              </p>
            </div>
          </div>

          {consents.length > 0 && (
            <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-xl p-4 mt-6 flex items-start gap-3">
              <Shield className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                  Security Tip
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Regularly review and revoke access for applications you no longer use to keep your
                  account secure.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Consents List */}
        {consents.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8 text-neutral-400" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              No Authorized Applications
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              You haven't authorized any third-party applications to access your account yet. When
              you do, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {consents.map((consent) => (
              <div
                key={consent.id}
                className="group bg-white dark:bg-black rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                  {/* App Logo */}
                  <div className="flex-shrink-0">
                    {consent.application.logoUrl ? (
                      <img
                        src={consent.application.logoUrl}
                        alt={consent.application.name}
                        className="w-16 h-16 rounded-xl object-cover border border-neutral-100 dark:border-neutral-800"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                        <Activity className="w-8 h-8 text-neutral-400" />
                      </div>
                    )}
                  </div>

                  {/* App Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
                        {consent.application.name}
                      </h3>
                      {consent.application.isVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-[10px] font-medium uppercase tracking-wide rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>

                    {consent.application.description ? (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 line-clamp-2">
                        {consent.application.description}
                      </p>
                    ) : (
                      <p className="text-sm text-neutral-400 italic mb-4">
                        No description provided.
                      </p>
                    )}

                    {/* Granted Scopes */}
                    <div className="mb-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                      <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-3">
                        Granted Permissions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {consent.grantedScopes.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-800"
                          >
                            {getScopeIcon(scope)}
                            {getScopeName(scope)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Authorized {formatDate(consent.createdAt)}
                      </span>
                      {consent.application.websiteUrl && (
                        <a
                          href={consent.application.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Visit Website
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Revoke Button */}
                  <div className="flex-shrink-0 pt-1">
                    <button
                      onClick={() => setShowRevokeConfirm(consent)}
                      className="px-4 py-2 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/10 text-neutral-600 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 rounded-lg text-sm font-medium transition-all duration-200 inline-flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Revoke Access
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Revoke Confirmation Modal */}
        {showRevokeConfirm && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-black rounded-2xl p-6 max-w-sm w-full border border-neutral-200 dark:border-neutral-800 shadow-xl">
              <div className="flex flex-col items-center mb-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Revoke Access
                </h2>
                <p className="text-sm text-neutral-500 mt-2">
                  Are you sure you want to revoke access for{' '}
                  <strong className="text-neutral-900 dark:text-white">
                    {showRevokeConfirm.application.name}
                  </strong>
                  ?
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRevokeConfirm(null)}
                  className="flex-1 px-4 py-3 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-900 dark:text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRevoke(showRevokeConfirm)}
                  disabled={revoking === showRevokeConfirm.id}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {revoking === showRevokeConfirm.id ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Revoke'
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

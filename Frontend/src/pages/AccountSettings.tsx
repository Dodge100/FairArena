import { ApiKeyManager } from '@/components/ApiKeyManager';
import { ImageUploader } from '@/components/ImageUploader';
import { MFASetup } from '@/components/MFASetup';
import { OTPVerification } from '@/components/OTPVerification';
import { PasskeyManager } from '@/components/PasskeyManager';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { apiRequest } from '@/lib/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Chrome,
  Clock,
  Copy,
  Download,
  Globe,
  Key,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  Smartphone,
  Tablet,
  User,
  X
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import AccountSettingsComponent from '../components/AccountSettings';
import { SecurityKeyManager } from '../components/SecurityKeyManager';

interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface ActivityLog {
  id: string;
  action: string;
  level: string;
  metadata?: {
    deviceName?: string;
    deviceType?: string;
    ipAddress?: string;
    timestamp?: string;
  };
  createdAt: string;
}

interface MFAStatus {
  enabled: boolean;
  enabledAt?: string;
  backupCodesRemaining: number;
}

// function to format time ago
const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 30) return 'just now';
  if (diffInSeconds < 60) return 'less than a minute ago';

  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

function AccountSettings() {
  const { isDark } = useTheme();
  const { user, logout, refreshUser, activeSessionId } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'settings'>('overview');

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Security State
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  // Backup Code Regeneration State
  const [showRegenerateMfa, setShowRegenerateMfa] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);


  const [updatingMfaPrefs, setUpdatingMfaPrefs] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState<'email' | 'notification' | null>(null);
  const [showAdvancedSecurityWarning, setShowAdvancedSecurityWarning] = useState<'disableOtp' | 'superSecure' | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
  const queryClient = useQueryClient();

  // Queries
  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: fetchSessions
  } = useQuery({
    queryKey: ['sessions', user?.userId],
    queryFn: () => apiRequest<{ data: Session[] }>(`${API_BASE}/api/v1/auth/sessions`).then(res => res.data),
    enabled: !!user && isVerified && activeTab === 'overview',
  });

  const {
    data: activityLogs = [],
    isLoading: loadingLogs,
    refetch: fetchActivityLogs
  } = useQuery({
    queryKey: ['activityLogs', user?.userId],
    queryFn: () => apiRequest<{ data: ActivityLog[] }>(`${API_BASE}/api/v1/auth/recent-activity`).then(res => res.data),
    enabled: !!user && isVerified && activeTab === 'overview',
  });

  // Fetch MFA Status
  const { data: mfaStatus = null, isLoading: loadingMfa, refetch: fetchMfaStatus } = useQuery({
    queryKey: ['mfa-status', user?.userId],
    queryFn: () => apiRequest<{ success: boolean, data: MFAStatus }>(`${API_BASE}/api/v1/mfa/status`).then(res => res.data),
    enabled: !!user && isVerified && activeTab === 'security',
  });

  // Fetch MFA Preferences
  const { data: mfaPreferences = null, refetch: fetchMfaPreferences } = useQuery({
    queryKey: ['mfa-preferences', user?.userId],
    queryFn: () => apiRequest<{ success: boolean, data: any }>(`${API_BASE}/api/v1/auth/mfa/preferences`).then(res => res.data),
    enabled: !!user && isVerified && activeTab === 'security',
  });

  // Update MFA Preferences
  const updateMfaPreferenceMutation = useMutation({
    mutationFn: async ({ type, enabled }: { type: 'email' | 'notification', enabled: boolean }) => {
      const body = type === 'email'
        ? { emailMfaEnabled: enabled, acknowledgeSecurityRisk: enabled }
        : { notificationMfaEnabled: enabled, acknowledgeSecurityRisk: enabled };

      return apiRequest<{ success: boolean, data: any, message?: string }>(`${API_BASE}/api/v1/auth/mfa/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data, variables) => {
      // Optimistically update or refetch
      queryClient.setQueryData(['mfa-preferences', user?.userId], data.data);
      toast.success(`${variables.type === 'email' ? 'Email' : 'Notification'} MFA ${variables.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update preferences');
    },
    onSettled: () => {
      setUpdatingMfaPrefs(false);
      setShowSecurityWarning(null);
    }
  });

  const updateMfaPreference = (type: 'email' | 'notification', enabled: boolean) => {
    setUpdatingMfaPrefs(true);
    updateMfaPreferenceMutation.mutate({ type, enabled });
  };

  // Update Advanced Security Settings
  const updateAdvancedSecurityMutation = useMutation({
    mutationFn: async ({ setting, enabled }: { setting: 'disableOTPReverification' | 'superSecureAccountEnabled', enabled: boolean }) => {
      const body = { [setting]: enabled };
      return apiRequest<{ success: boolean, data: any, message?: string }>(`${API_BASE}/api/v1/auth/mfa/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['mfa-preferences', user?.userId], data.data);
      const settingName = variables.setting === 'disableOTPReverification'
        ? 'OTP Re-verification'
        : 'Super Secure Account';
      toast.success(`${settingName} ${variables.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update security setting');
    },
    onSettled: () => {
      setUpdatingMfaPrefs(false);
      setShowAdvancedSecurityWarning(null);
    }
  });

  const updateAdvancedSecuritySetting = (
    setting: 'disableOTPReverification' | 'superSecureAccountEnabled',
    enabled: boolean
  ) => {
    setUpdatingMfaPrefs(true);
    updateAdvancedSecurityMutation.mutate({ setting, enabled });
  };

  // Removed manual useEffect for sessions/logs as it is handled by useQuery enabled flag
  // Removed manual useEffect for fetchMfaStatus and fetchMfaPreferences as it is handled by useQuery enabled flag
  // Removed empty useEffect or kept if needed for other things?
  // The original useEffect:
  /*
  useEffect(() => {
    if (activeTab === 'security' && isVerified) {
      fetchMfaStatus();
      fetchMfaPreferences();
    }
  }, [activeTab]);
  */
  // This is now redundant essentially because useQuery uses activeTab and isVerified in enablement, but queries automatically fetch when enabled becomes true.
  // So no useEffect needed.

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    } finally {
      setIsLoading(false);
    }
  };

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest(`${API_BASE}/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Session revoked successfully');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: () => {
      toast.error('Failed to revoke session');
    }
  });

  const handleRevokeSession = (sessionId: string) => {
    setRevokingSession(sessionId);
    revokeSessionMutation.mutate(sessionId, {
      onSettled: () => setRevokingSession(null)
    });
  };

  const handleRevokeAllOtherSessions = async () => {
    const otherSessions = sessions.filter(s => !s.isCurrent && s.id !== activeSessionId);
    if (otherSessions.length === 0) {
      toast.info('No other sessions to revoke');
      return;
    }

    setIsLoading(true);
    try {
      await Promise.all(otherSessions.map(session =>
        apiRequest(`${API_BASE}/api/v1/auth/sessions/${session.id}`, { method: 'DELETE' })
      ));
      toast.success(`Revoked ${otherSessions.length} session(s)`);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch (error) {
      toast.error('Failed to revoke some sessions');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } finally {
      setIsLoading(false);
    }
  };

  const disableMfaMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ success: boolean, message?: string }>(`${API_BASE}/api/v1/mfa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode
        })
      });
    },
    onSuccess: () => {
      toast.success('MFA disabled successfully');
      setShowDisableMfa(false);
      setDisablePassword('');
      setDisableCode('');
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to disable MFA');
    }
  });

  const handleDisableMfa = () => {
    if (!disablePassword || !disableCode) {
      toast.error('Please enter your password and a verification code');
      return;
    }
    disableMfaMutation.mutate();
  };

  const regenerateBackupCodesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ success: boolean, data: { backupCodes: string[] }, message?: string }>(`${API_BASE}/api/v1/mfa/regenerate-backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: regenerateCode
        })
      });
    },
    onSuccess: (data) => {
      toast.success('Backup codes regenerated successfully');
      setNewBackupCodes(data.data.backupCodes);
      setRegenerateCode('');
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to regenerate backup codes');
    }
  });

  const handleRegenerateBackupCodes = () => {
    if (!regenerateCode) {
      toast.error('Please enter a verification code');
      return;
    }
    regenerateBackupCodesMutation.mutate();
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(newBackupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
    toast.success('Backup codes copied to clipboard');
  };

  const downloadBackupCodes = () => {
    const element = document.createElement('a');
    const file = new Blob([newBackupCodes.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'fairarena-backup-codes.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const closeRegenerateModal = () => {
    setShowRegenerateMfa(false);
    setNewBackupCodes([]);
    setRegenerateCode('');
  };

  const passwordResetMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest<{ success: boolean, message?: string }>(`${API_BASE}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    },
    onSuccess: () => {
      toast.success('Password reset email sent! Check your inbox.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send password reset email');
    }
  });

  const sendingPasswordReset = passwordResetMutation.isPending;

  const handlePasswordChange = () => {
    if (!user?.email) {
      toast.error('Unable to send password reset email');
      return;
    }
    passwordResetMutation.mutate(user.email);
  };

  const getDeviceIcon = (deviceType: string) => {
    const iconClass = "w-5 h-5";
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
      case 'phone':
      case 'android':
      case 'iphone':
        return <Smartphone className={iconClass} />;
      case 'tablet':
      case 'ipad':
        return <Tablet className={iconClass} />;
      case 'desktop':
      case 'laptop':
      case 'computer':
        return <Laptop className={iconClass} />;
      case 'browser':
        return <Chrome className={iconClass} />;
      default:
        return <Laptop className={iconClass} />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'login': 'Signed in',
      'logout': 'Signed out',
      'register': 'Account created',
      'password-changed': 'Password changed',
      'email-verified': 'Email verified',
      'profile-updated': 'Profile updated',
      'session-revoked': 'Session ended',
      'mfa-enabled': 'Two-factor auth enabled',
      'mfa-disabled': 'Two-factor auth disabled',
      'backup-codes-regenerated': 'Backup codes regenerated',
    };
    return labels[action] || action.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
  };

  const getActionIcon = (action: string) => {
    const iconClass = "w-4 h-4";
    switch (action) {
      case 'login': return <LogOut className={iconClass} style={{ transform: 'rotate(180deg)' }} />;
      case 'logout': return <LogOut className={iconClass} />;
      case 'register': return <User className={iconClass} />;
      case 'password-changed': return <Lock className={iconClass} />;
      case 'mfa-enabled':
      case 'mfa-disabled': return <Shield className={iconClass} />;
      case 'backup-codes-regenerated': return <RefreshCw className={iconClass} />;
      default: return <Clock className={iconClass} />;
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Security Verification Check
  if (!isVerified) {
    return (
      <OTPVerification
        onVerified={() => setIsVerified(true)}
        fullScreen={true}
        title="Security Verification"
        description="Please verify your identity to access account settings."
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Profile Header Card */}
      <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg overflow-hidden`}>
        <div className={`p-6 ${isDark ? 'bg-gradient-to-r from-[#DDEF00]/10 to-transparent' : 'bg-gradient-to-r from-primary/10 to-transparent'}`}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <ImageUploader
              currentImageUrl={user.profileImageUrl}
              onUploadComplete={() => {
                refreshUser();
                toast.success('Profile photo updated!');
              }}
              showUserDetails={false}
              className="shrink-0"
            />
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-foreground">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-600">
                    <Check className="w-3 h-3" /> Email verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-600">
                    <AlertTriangle className="w-3 h-3" /> Email not verified
                  </span>
                )}
                {mfaStatus?.enabled && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-600">
                    <Shield className="w-3 h-3" /> 2FA Enabled
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${isDark
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-red-100 text-red-600 hover:bg-red-200'
                } disabled:opacity-50`}
            >
              <LogOut className="w-4 h-4" />
              {isLoading ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`flex border-b ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'overview'
              ? isDark
                ? 'border-[#DDEF00] text-[#DDEF00]'
                : 'border-black text-black'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'security'
              ? isDark
                ? 'border-[#DDEF00] text-[#DDEF00]'
                : 'border-black text-black'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'settings'
              ? isDark
                ? 'border-[#DDEF00] text-[#DDEF00]'
                : 'border-black text-black'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Active Sessions Card */}
          <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg overflow-hidden`}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${isDark ? 'text-[#DDEF00]' : 'text-primary'}`} />
                <h2 className="text-lg font-semibold text-foreground">Active Sessions</h2>
                <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                  {sessions.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchSessions()}
                  disabled={loadingSessions}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="Refresh sessions"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin' : ''}`} />
                </button>
                {sessions.length > 1 && (
                  <button
                    onClick={handleRevokeAllOtherSessions}
                    disabled={isLoading}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                      } disabled:opacity-50`}
                  >
                    Sign out all other devices
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-border">
              {loadingSessions ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading sessions...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No active sessions found
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 flex items-center gap-4 ${session.isCurrent ? (isDark ? 'bg-[#DDEF00]/5' : 'bg-primary/5') : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-muted' : 'bg-gray-100'}`}>
                      {getDeviceIcon(session.deviceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {session.deviceName || 'Unknown Device'}
                        </span>
                        {(session.isCurrent || session.id === activeSessionId) && (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-[#DDEF00]/20 text-[#DDEF00]' : 'bg-green-100 text-green-700'}`}>
                            Current Session
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {session.ipAddress || 'Unknown IP'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.lastActiveAt
                            ? formatTimeAgo(new Date(session.lastActiveAt))
                            : 'Unknown'}
                        </span>
                      </div>
                    </div>
                    {!session.isCurrent && session.id !== activeSessionId && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={revokingSession === session.id}
                        className={`p-2 rounded-lg transition-colors ${isDark
                          ? 'hover:bg-red-500/20 text-red-400'
                          : 'hover:bg-red-100 text-red-600'
                          } disabled:opacity-50`}
                        title="Revoke session"
                      >
                        {revokingSession === session.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg overflow-hidden`}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${isDark ? 'text-[#DDEF00]' : 'text-primary'}`} />
                <h2 className="text-lg font-semibold text-foreground">Recent Security Activity</h2>
              </div>
              <button
                onClick={() => fetchActivityLogs()}
                disabled={loadingLogs}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Refresh activity"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="divide-y divide-border">
              {loadingLogs ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading activity...</p>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-muted' : 'bg-gray-100'}`}>
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">
                        {getActionLabel(log.action)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {log.metadata?.deviceName && (
                          <span className="flex items-center gap-1">
                            {getDeviceIcon(log.metadata.deviceType || 'unknown')}
                            {log.metadata.deviceName}
                          </span>
                        )}
                        {log.metadata?.ipAddress && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {log.metadata.ipAddress}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(new Date(log.createdAt))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Security Tips */}
          <div className={`rounded-xl border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'} p-4`}>
            <div className="flex items-start gap-3">
              <Shield className={`w-5 h-5 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <div>
                <h3 className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>Security Tip</h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-blue-200/80' : 'text-blue-700'}`}>
                  Review your active sessions regularly. If you see any device you don't recognize,
                  revoke that session immediately and consider changing your password.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <>
            {/* MFA Section */}
            <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg p-6`}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-[#DDEF00]/10 text-[#DDEF00]' : 'bg-primary/10 text-primary'}`}>
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                  </div>
                </div>
                {mfaStatus?.enabled ? (
                  <span className="bg-green-500/10 text-green-600 px-3 py-1 rounded-full text-sm font-medium border border-green-200">
                    Enabled
                  </span>
                ) : (
                  <span className="bg-yellow-500/10 text-yellow-600 px-3 py-1 rounded-full text-sm font-medium border border-yellow-200">
                    Disabled
                  </span>
                )}
              </div>

              {showMfaSetup ? (
                <MFASetup
                  onComplete={() => {
                    setShowMfaSetup(false);
                    fetchMfaStatus();
                  }}
                  onCancel={() => setShowMfaSetup(false)}
                />
              ) : showRegenerateMfa ? (
                <div className="max-w-md mx-auto space-y-4 p-6 border rounded-xl bg-muted/20">
                  <h4 className="font-semibold text-center text-lg">Regenerate Backup Codes</h4>

                  {newBackupCodes.length > 0 ? (
                    <div className="space-y-6">
                      <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 p-3 rounded-lg text-sm text-center">
                        Save these codes now. They will not be shown again.
                        Previous codes have been invalidated.
                      </div>
                      <div className="bg-background border rounded-lg p-4 grid grid-cols-2 gap-4 font-mono text-sm text-center">
                        {newBackupCodes.map((code) => (
                          <div key={code} className="p-1">{code}</div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={copyBackupCodes} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors">
                          {copiedCodes ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          Copy
                        </button>
                        <button onClick={downloadBackupCodes} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors">
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                      <button
                        onClick={closeRegenerateModal}
                        className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground text-center">
                        Generate a new set of backup codes. This will invalidate any unused backup codes you previously generated.
                        <br /><br />
                        Enter a current 6-digit code from your authenticator app to confirm.
                      </p>
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Verification Code</label>
                        <input
                          type="text"
                          placeholder="000 000"
                          value={regenerateCode}
                          onChange={e => setRegenerateCode(e.target.value.replace(/[^0-9]/g, ''))}
                          maxLength={6}
                          className="w-full px-3 py-2.5 rounded-lg border bg-background text-center text-xl tracking-widest font-mono"
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={closeRegenerateModal}
                          className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted transition-colors font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleRegenerateBackupCodes}
                          disabled={isLoading || regenerateCode.length !== 6}
                          className="flex-1 px-4 py-2 rounded-lg bg-[#DDEF00] text-black hover:bg-[#c7db00] transition-colors disabled:opacity-50 font-semibold"
                        >
                          {isLoading ? 'Generating...' : 'Regenerate'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : showDisableMfa ? (
                <div className="max-w-md mx-auto space-y-4 p-6 border rounded-xl bg-muted/20">
                  <h4 className="font-semibold text-center text-lg">Disable Two-Factor Authentication</h4>
                  <p className="text-sm text-muted-foreground text-center">
                    Are you sure? This will remove the extra layer of security from your account.
                    <br />
                    Enter your password and a current 2FA code to confirm.
                  </p>
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Current Password"
                      value={disablePassword}
                      onChange={e => setDisablePassword(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border bg-background"
                    />
                    <input
                      type="text"
                      placeholder="Verification Code (6 digits)"
                      value={disableCode}
                      maxLength={6}
                      onChange={e => setDisableCode(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border bg-background"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowDisableMfa(false)}
                      className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDisableMfa}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold"
                    >
                      {isLoading ? 'Disabling...' : 'Disable MFA'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {loadingMfa ? (
                    <div className="py-4 flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : mfaStatus?.enabled ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50/50 border border-green-100 dark:bg-green-950/20 dark:border-green-800">
                        <Check className="w-5 h-5 text-green-600" />
                        <div className="flex-1">
                          <p className="font-medium text-green-800 dark:text-green-300">
                            MFA is active since {new Date(mfaStatus.enabledAt || '').toLocaleDateString()}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-400">
                            Your account is protected.
                            {mfaStatus.backupCodesRemaining < 5 && (
                              <span className="block mt-1 font-medium text-orange-600 dark:text-orange-400">
                                {mfaStatus.backupCodesRemaining} backup codes remaining.
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => setShowDisableMfa(true)}
                          className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 transition-colors text-sm font-medium"
                        >
                          Disable 2FA
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-foreground hover:bg-muted border border-border transition-colors text-sm font-medium flex items-center gap-2"
                          onClick={() => setShowRegenerateMfa(true)}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Regenerate Backup Codes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        Protect your account from unauthorized access mainly by enabling Two-Factor Authentication.
                        You'll need a mobile authenticator app.
                      </p>
                      <button
                        onClick={() => setShowMfaSetup(true)}
                        className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${isDark ? 'bg-[#DDEF00] text-black hover:bg-[#DDEF00]/90' : 'bg-black text-white hover:bg-black/90'}`}
                      >
                        <Shield className="w-4 h-4" />
                        Enable MFA
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Passkeys Section */}
            <PasskeyManager />
            <SecurityKeyManager onDeviceChange={fetchMfaPreferences} />
            <ApiKeyManager />

            {/* MFA Preferences Section */}
            {mfaStatus?.enabled && (
              <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg p-6`}>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className={`w-6 h-6 ${isDark ? 'text-muted-foreground' : 'text-gray-500'}`} />
                  <h3 className="text-lg font-semibold text-foreground">Alternative MFA Methods</h3>
                </div>
                <p className="text-muted-foreground mb-4 text-sm">
                  Enable additional ways to verify your identity. Note: These methods are less secure than authenticator apps or passkeys.
                </p>

                <div className="space-y-4">
                  {/* Email Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-foreground">Email OTP</p>
                      <p className="text-sm text-muted-foreground">Receive verification codes via email</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!mfaPreferences?.emailMfaEnabled) {
                          setShowSecurityWarning('email');
                        } else {
                          updateMfaPreference('email', false);
                        }
                      }}
                      disabled={updatingMfaPrefs}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mfaPreferences?.emailMfaEnabled ? 'bg-green-500' : 'bg-gray-300'
                        } ${updatingMfaPrefs ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mfaPreferences?.emailMfaEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* Notification OTP Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-foreground">Push Notification OTP</p>
                      <p className="text-sm text-muted-foreground">Receive verification codes via push notifications</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!mfaPreferences?.notificationMfaEnabled) {
                          setShowSecurityWarning('notification');
                        } else {
                          updateMfaPreference('notification', false);
                        }
                      }}
                      disabled={updatingMfaPrefs}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mfaPreferences?.notificationMfaEnabled ? 'bg-green-500' : 'bg-gray-300'
                        } ${updatingMfaPrefs ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mfaPreferences?.notificationMfaEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Security Warning Modal */}
                {showSecurityWarning && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`rounded-xl p-6 max-w-md mx-4 ${isDark ? 'bg-card' : 'bg-white'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-yellow-500" />
                        <h3 className="text-lg font-semibold">Security Warning</h3>
                      </div>
                      <p className="text-muted-foreground mb-4">
                        {showSecurityWarning === 'email'
                          ? 'Email-based MFA is less secure than authenticator apps because emails can be intercepted or your email account could be compromised.'
                          : 'Push notification MFA is less secure than authenticator apps because notifications can be intercepted or your device could be compromised.'
                        }
                      </p>
                      <p className="text-muted-foreground mb-6">
                        We recommend using an authenticator app (TOTP) or passkeys for maximum security. Are you sure you want to enable this method?
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowSecurityWarning(null)}
                          className="flex-1 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => updateMfaPreference(showSecurityWarning, true)}
                          disabled={updatingMfaPrefs}
                          className="flex-1 px-4 py-2 rounded-lg bg-yellow-500 text-black font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
                        >
                          {updatingMfaPrefs ? 'Enabling...' : 'I Understand, Enable'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Security Settings */}
            {mfaStatus?.enabled && mfaPreferences && (
              <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg p-6`}>
                <div className="flex items-center gap-3 mb-4">
                  <Key className={`w-6 h-6 ${isDark ? 'text-[#DDEF00]' : 'text-primary'}`} />
                  <h3 className="text-lg font-semibold text-foreground">Advanced Security Settings</h3>
                </div>
                <p className="text-muted-foreground mb-4 text-sm">
                  Configure advanced security features for maximum account protection.
                </p>

                <div className="space-y-4">
                  {/* Disable OTP Reverification Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-foreground">Disable OTP Re-verification</p>
                      <p className="text-sm text-muted-foreground">
                        Force security key verification instead of email OTP for account settings
                      </p>
                      {(mfaPreferences.securityKeyCount || 0) === 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Requires at least 1 security key
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!mfaPreferences.disableOTPReverification) {
                          setShowAdvancedSecurityWarning('disableOtp');
                        } else {
                          updateAdvancedSecuritySetting('disableOTPReverification', false);
                        }
                      }}
                      disabled={updatingMfaPrefs || (mfaPreferences.securityKeyCount || 0) === 0}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mfaPreferences.disableOTPReverification ? 'bg-green-500' : 'bg-gray-300'
                        } ${updatingMfaPrefs || (mfaPreferences.securityKeyCount || 0) === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mfaPreferences.disableOTPReverification ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* Super Secure Account Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border-2 border-dashed border-yellow-500/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">Super Secure Account</p>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-600 border border-yellow-500/30">
                          Advanced
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Maximum security: Passkeys/OAuth + WebAuthn MFA only.
                      </p>
                      {(!mfaPreferences.disableOTPReverification && !mfaPreferences.superSecureAccountEnabled) && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Requires "Disable OTP Re-verification" first
                        </p>
                      )}
                      {(mfaPreferences.securityKeyCount || 0) === 0 && !mfaPreferences.superSecureAccountEnabled && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Requires at least 1 security key
                        </p>
                      )}
                      {(mfaPreferences.passkeyCount || 0) === 0 && !mfaPreferences.superSecureAccountEnabled && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Requires at least 1 passkey
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!mfaPreferences.superSecureAccountEnabled) {
                          setShowAdvancedSecurityWarning('superSecure');
                        } else {
                          updateAdvancedSecuritySetting('superSecureAccountEnabled', false);
                        }
                      }}
                      disabled={
                        updatingMfaPrefs ||
                        (!mfaPreferences.disableOTPReverification && !mfaPreferences.superSecureAccountEnabled) ||
                        ((mfaPreferences.securityKeyCount || 0) === 0 && !mfaPreferences.superSecureAccountEnabled) ||
                        ((mfaPreferences.passkeyCount || 0) === 0 && !mfaPreferences.superSecureAccountEnabled)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mfaPreferences.superSecureAccountEnabled ? 'bg-green-500' : 'bg-gray-300'
                        } ${updatingMfaPrefs ||
                          (!mfaPreferences.disableOTPReverification && !mfaPreferences.superSecureAccountEnabled) ||
                          ((mfaPreferences.securityKeyCount || 0) === 0 && !mfaPreferences.superSecureAccountEnabled) ||
                          ((mfaPreferences.passkeyCount || 0) === 0 && !mfaPreferences.superSecureAccountEnabled)
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mfaPreferences.superSecureAccountEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Advanced Security Warning Modal */}
                {showAdvancedSecurityWarning && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`rounded-xl p-6 max-w-md mx-4 ${isDark ? 'bg-card' : 'bg-white'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-6 h-6 text-green-500" />
                        <h3 className="text-lg font-semibold">
                          {showAdvancedSecurityWarning === 'disableOtp'
                            ? 'Disable OTP Re-verification?'
                            : 'Enable Super Secure Account?'
                          }
                        </h3>
                      </div>
                      <p className="text-muted-foreground mb-4">
                        {showAdvancedSecurityWarning === 'disableOtp'
                          ? 'This will require using your security key instead of email OTP for account settings verification.'
                          : 'Password-based login will be disabled. You must use passkeys or OAuth with WebAuthn MFA.'
                        }
                      </p>
                      {showAdvancedSecurityWarning === 'superSecure' && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 p-3 rounded-lg text-sm mb-4">
                          <strong>Warning:</strong> If you lose all security keys and passkeys, you may be locked out permanently.
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowAdvancedSecurityWarning(null)}
                          className="flex-1 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (showAdvancedSecurityWarning === 'disableOtp') {
                              updateAdvancedSecuritySetting('disableOTPReverification', true);
                            } else {
                              updateAdvancedSecuritySetting('superSecureAccountEnabled', true);
                            }
                          }}
                          disabled={updatingMfaPrefs}
                          className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-400 transition-colors disabled:opacity-50"
                        >
                          {updatingMfaPrefs ? 'Enabling...' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Password Change Info */}
            <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <Lock className={`w-6 h-6 ${isDark ? 'text-muted-foreground' : 'text-gray-500'}`} />
                <h3 className="text-lg font-semibold text-foreground">Password</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Manage your password and recovery settings.
              </p>
              <div className="flex items-center gap-4">
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50 flex items-center gap-2"
                  onClick={handlePasswordChange}
                  disabled={sendingPasswordReset}
                >
                  {sendingPasswordReset && <Loader2 className="w-4 h-4 animate-spin" />}
                  {sendingPasswordReset ? 'Sending...' : 'Change Password'}
                </button>
              </div>
            </div>
          </>
        </div>
      )}

      {activeTab === 'settings' && <AccountSettingsComponent />}

    </div>
  );
};

export default AccountSettings;

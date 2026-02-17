import { useAuth } from '@/lib/auth';
import { Check, ChevronDown, LogOut, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface AccountSwitcherProps {
  onSwitchAccount?: () => void;
  requestId?: string;
}

export function AccountSwitcher({ onSwitchAccount, requestId }: AccountSwitcherProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // Get request_id from props or URL
  const oauthRequestId = requestId || searchParams.get('request_id');

  const handleAddAccount = async () => {
    setIsOpen(false);

    // Store current OAuth context before logging out
    if (oauthRequestId) {
      sessionStorage.setItem('oauth_request_id', oauthRequestId);
      sessionStorage.setItem('oauth_add_account', 'true');
    }

    // Log out current user first, then redirect to sign in
    await logout();

    // Navigate to sign in with OAuth context preserved
    navigate(`/signin?oauth_request=${oauthRequestId}&add_account=true`);

    if (onSwitchAccount) onSwitchAccount();
  };

  const handleSignOutAndCancel = async () => {
    setIsOpen(false);

    // Clear OAuth context and sign out
    sessionStorage.removeItem('oauth_request_id');
    sessionStorage.removeItem('oauth_add_account');

    await logout();
    navigate('/');

    if (onSwitchAccount) onSwitchAccount();
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-all duration-200"
      >
        <div className="flex-shrink-0">
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={user.email}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-neutral-900"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white dark:ring-neutral-900">
              <span className="text-white font-semibold text-sm">
                {user.firstName?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.email?.split('@')[0]}
          </p>
          <p className="text-xs text-neutral-500 truncate">{user.email}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Signed in as label */}
            <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Signed in as
              </p>
            </div>

            {/* Current Account */}
            <div className="p-2">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                <div className="flex-shrink-0">
                  {user.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt={user.email}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {user.firstName?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                </div>
                <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-neutral-100 dark:border-neutral-800" />

            {/* Actions */}
            <div className="p-2 space-y-1">
              <button
                onClick={handleAddAccount}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <span className="block">Use another account</span>
                  <span className="text-xs text-neutral-500">Sign in with a different email</span>
                </div>
              </button>

              <button
                onClick={handleSignOutAndCancel}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-950/50 transition-colors">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <span className="block">Sign out</span>
                  <span className="text-xs text-red-500/70">Cancel this authorization</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

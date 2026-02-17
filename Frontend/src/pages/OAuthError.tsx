import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function OAuthError() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const error = searchParams.get('error') || 'server_error';
  const errorDescription = searchParams.get('error_description');
  const state = searchParams.get('state');

  // Helper to get translated error info
  const getErrorInfo = (errorCode: string) => {
    const baseKey = `oauthError.errors.${errorCode}`;
    // Verify if key exists by checking if it returns the key itself or default
    // i18next usually returns key if missing, so we can check that, or just trust the structure
    // But for safety, let's fallback to server_error if not found in our known list
    // A simple way is to check against the known keys in json, but since we just added them...
    // We can just try to translate title.

    const title = t(`${baseKey}.title`);
    // If translation is missing/returns key (simple check, though configured fallback is en)
    // We will assume if title equals key, it might be unknown custom error

    return {
      title: title,
      description:
        errorDescription || t(`${baseKey}.description`, t('oauthError.defaultDescription')),
      solutions: (t(`${baseKey}.solutions`, { returnObjects: true }) as string[]) || [
        t('oauthError.errors.server_error.solutions.0', 'Try again in a few moments'),
        t(
          'oauthError.errors.server_error.solutions.1',
          'If the problem persists, contact FairArena support',
        ),
      ],
    };
  };

  const errorInfo = getErrorInfo(error);

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
                  {t('oauthError.fixTitle')}
                </h2>
              </div>
              <ul className="space-y-3">
                {Array.isArray(errorInfo.solutions) &&
                  errorInfo.solutions.map((solution, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400"
                    >
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
                    <span>{t('oauthError.technicalDetails')}</span>
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
                {t('oauthError.tryAgain')}
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-white dark:bg-black text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-xl font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all active:scale-[0.99]"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('oauthError.goHome')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-neutral-400">
          <Shield className="w-4 h-4" />
          <span className="text-sm">{t('oauthError.securedBy')}</span>
        </div>
      </div>
    </div>
  );
}

import { DataSaverImage } from '@/components/ui/DataSaverImage';
import { useDataSaverUtils } from '@/hooks/useDataSaverUtils';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function Unsubscribe() {
  const { email } = useParams<{ email: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { cn, shouldLoadImage } = useDataSaverUtils();

  useEffect(() => {
    if (!email) {
      setTimeout(() => {
        setStatus('error');
        setMessage('Invalid email address');
      }, 0);
      return;
    }
    const unsubscribe = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/v1/newsletter/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setStatus('success');
          setMessage(
            data.message || 'You have been successfully unsubscribed from our newsletter.',
          );
        } else {
          setStatus('error');
          setMessage(data.message || 'Failed to unsubscribe. Please try again.');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again later.');
      }
    };
    unsubscribe();
  }, [email]);

  // Responsive + accessible styles
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      {/* Header with Logo */}
      <header className="w-full py-6 px-4 border-b border-gray-200 dark:border-transparent bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex justify-center">
          <div className="flex items-center space-x-3">
            <DataSaverImage
              src="/fairArenaLogo.png"
              alt="FairArena Logo"
              className="w-28 h-16 md:w-32 md:h-20 rounded-xl shadow-lg object-contain bg-white dark:bg-gray-900 p-2"
              width={128}
              height={80}
              loading="eager"
              draggable={false}
              fallback={
                <div className="w-28 h-16 md:w-32 md:h-20 rounded-xl shadow-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-400">FA</span>
                </div>
              }
            />
            <span className="sr-only">FairArena</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <section className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-transparent dark:shadow-none">
          <header className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Newsletter Unsubscribe
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">We're sorry to see you go</p>
          </header>

          <div className="text-center min-h-[120px] flex flex-col items-center justify-center">
            {status === 'loading' && (
              <div className="flex flex-col items-center space-y-4">
                <div className={cn("rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent", shouldLoadImage ? "animate-spin" : "")}></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  Processing your request...
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Successfully Unsubscribed
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{message}</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Unsubscribe Failed
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{message}</p>
                </div>
              </div>
            )}
          </div>

          <footer className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700/30 flex justify-center">
            <a
              href="/"
              className={cn(
                "inline-flex items-center px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              )}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Return to Home
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Return to Home
            </a>
          </footer>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 px-4 border-t border-gray-200 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © 2025 FairArena. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Unsubscribe;

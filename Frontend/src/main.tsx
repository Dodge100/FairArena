// import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ClarityManager } from './components/ClarityManager.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { FirebaseAnalyticsManager } from './components/FirebaseAnalyticsManager.tsx';
import { AIButtonProvider } from './contexts/AIButtonContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { CookieConsentProvider } from './contexts/CookieConsentContext.tsx';
import { DataSaverProvider } from './contexts/DataSaverContext.tsx';
import { SidebarCustomizationProvider } from './contexts/SidebarCustomizationContext.tsx';
import { SocketProvider } from './contexts/SocketContext.tsx';
import { StreamProvider } from './contexts/StreamContext.tsx';
import './i18n/config';
import './index.css';
import { ThemeProvider } from './theme-context.tsx';

// Initialize Sentry before rendering React
// Sentry.init({
//   dsn: import.meta.env.VITE_SENTRY_DSN,
//   sendDefaultPii: true,
//   integrations: [
//     Sentry.feedbackIntegration({
//       colorScheme: 'system',
//       isNameRequired: true,
//       isEmailRequired: true,
//     }),
//   ],
// });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StreamProvider>
          <CookieConsentProvider>
            <DataSaverProvider>
              <SidebarCustomizationProvider>
                <AIButtonProvider>
                  <SocketProvider>
                    <ClarityManager />
                    <FirebaseAnalyticsManager />
                    <ThemeProvider>
                      <BrowserRouter>
                        <ErrorBoundary>
                          <HelmetProvider>
                            <App />
                          </HelmetProvider>
                        </ErrorBoundary>
                      </BrowserRouter>
                    </ThemeProvider>
                  </SocketProvider>
                </AIButtonProvider>
              </SidebarCustomizationProvider>
            </DataSaverProvider>
          </CookieConsentProvider>
        </StreamProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

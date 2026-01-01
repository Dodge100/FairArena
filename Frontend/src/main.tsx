// import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
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
                      <App />
                    </ErrorBoundary>
                  </BrowserRouter>
                </ThemeProvider>
              </SocketProvider>
            </AIButtonProvider>
          </SidebarCustomizationProvider>
        </DataSaverProvider>
      </CookieConsentProvider>
    </AuthProvider>
  </StrictMode>,
);

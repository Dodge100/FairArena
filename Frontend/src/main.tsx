import { ClerkProvider } from '@clerk/clerk-react';
// import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ClarityManager } from './components/ClarityManager.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { FirebaseAnalyticsManager } from './components/FirebaseAnalyticsManager.tsx';
import { AIButtonProvider } from './contexts/AIButtonContext.tsx';
import { CookieConsentProvider } from './contexts/CookieConsentContext.tsx';
import { DataSaverProvider } from './contexts/DataSaverContext.tsx';
import { SidebarCustomizationProvider } from './contexts/SidebarCustomizationContext.tsx';
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

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key');
}



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      waitlistUrl="/waitlist"
      signUpUrl="/signup"
      signInUrl="/signin"
    >
      <CookieConsentProvider>
        <DataSaverProvider>
          <SidebarCustomizationProvider>
            <AIButtonProvider>
              <ClarityManager />
              <FirebaseAnalyticsManager />
              <ThemeProvider>
                <BrowserRouter>
                  <ErrorBoundary>
                    <App />
                  </ErrorBoundary>
                </BrowserRouter>
              </ThemeProvider>
            </AIButtonProvider>
          </SidebarCustomizationProvider>
        </DataSaverProvider>
      </CookieConsentProvider>
    </ClerkProvider>
  </StrictMode>,
);

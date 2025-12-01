import { ClerkProvider } from '@clerk/clerk-react';
import Clarity from '@microsoft/clarity';
// import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
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

const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;

Clarity.init(projectId);
Clarity.consent(true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      waitlistUrl="/waitlist"
      signUpUrl="/signup"
      signInUrl="/signin"
    >
      <ThemeProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>,
);

import { ClerkProvider } from '@clerk/clerk-react';
import Clarity from '@microsoft/clarity';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { ThemeProvider } from './theme-context.tsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key');
}

const projectId = 'u6uytcxpce';

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

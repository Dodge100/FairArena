import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import {
  LazyErrorBoundary,
  ModalLoadingFallback,
  PageLoadingFallback,
} from './components/LazyComponents';
import { useCookieConsent } from './contexts/CookieConsentContext';
import { OnboardingProvider } from './contexts/OnboardingContext';
import ProtectedLayout from './layout/ProtectedLayout';
import PublicLayout from './layout/PublicLayout';
import { registerAuth } from './lib/apiClient';
import { useAuth, useToken } from './lib/auth';
import { initializeCsrfToken } from './utils/csrfToken';

// Critical components - loaded immediately
import { FrontendMismatch } from './components/FrontendMismatch';
import NotFound from './components/NotFound';
import AnalyticsPage from './pages/Analytics';
import BannedAccount from './pages/BannedAccount';
import Calendar from './pages/Calendar';
import Hackathons from './pages/Hackathons';
import Home from './pages/Home';
import IPBlockedPage from './pages/IPBlocked';
import Maintenance from './pages/Maintenance';
import ProjectsPage from './pages/Projects';
import Signin from './pages/Signin';

// Defer analytics to reduce initial bundle
const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })),
);
const SpeedInsights = lazy(() =>
  import('@vercel/speed-insights/react').then((m) => ({ default: m.SpeedInsights })),
);

// Lazy load modals
const PricingModal = lazy(() => import('./components/PricingModal'));
const CookieConsentModal = lazy(() =>
  import('./components/CookieConsentModal').then((m) => ({ default: m.CookieConsentModal })),
);
const GoogleOneTap = lazy(() =>
  import('./components/GoogleOneTap').then((m) => ({ default: m.GoogleOneTap })),
);
const WaitList = lazy(() => import('./components/WaitList'));

// Lazy load public pages
const About = lazy(() => import('./pages/About'));
const Accessibility = lazy(() => import('./pages/Accessibility'));
const Changelog = lazy(() => import('./pages/Changelog'));
const CommunityGuidelines = lazy(() => import('./pages/CommunityGuidelines'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const DMCA = lazy(() => import('./pages/DMCA'));
const FAQ = lazy(() => import('./pages/FAQ'));
const HowItWorks = lazy(() => import('./pages/WhyChooseUsPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const RefundPage = lazy(() => import('./pages/RefundPage'));
const SecurityPolicy = lazy(() => import('./pages/SecurityPolicy'));
const SecurityAcknowledgments = lazy(() => import('./pages/SecurityAcknowledgments'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));

// Lazy load auth pages
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));

// Lazy load protected pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AccountLogs = lazy(() => import('./pages/AccountLogs'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const AuthorizedApps = lazy(() => import('./pages/AuthorizedApps'));
const CreditsPage = lazy(() => import('./pages/CreditsPage'));
const CreditsVerificationPage = lazy(() => import('./pages/CreditsVerificationPage'));
const DeviceAuthorization = lazy(() => import('./pages/DeviceAuthorization'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Inbox = lazy(() => import('./pages/Inbox'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const OAuthApplications = lazy(() => import('./pages/OAuthApplications'));
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'));
const ProfileStars = lazy(() => import('./pages/ProfileStars'));
const ProfileViews = lazy(() => import('./pages/ProfileViews'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const TeamInviteAcceptPage = lazy(() => import('./pages/TeamInviteAcceptPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const AiGatewayPage = lazy(() => import('./pages/AiGateway'));

// Lazy load other pages
const Feedback = lazy(() => import('./pages/Feedback'));
const Support = lazy(() => import('./pages/Support'));

function App() {
  const location = useLocation();
  const [showPricingModal, setShowPricingModal] = useState(false);
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const isNewSignupEnabled = import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true';
  const frontendUrl = import.meta.env.VITE_FRONTEND_URL;

  const { showModal, updateConsent, acceptAll, rejectAll } = useCookieConsent();
  const token = useToken();
  const { isBanned, isIPBlocked, ipBlockReasons } = useAuth();

  useEffect(() => {
    registerAuth(token);
    // Initialize CSRF token from sessionStorage on app load
    initializeCsrfToken();
  }, [token]);

  useEffect(() => {
    // Security warning for console users
    const titleStyle = [
      'color: #ef4444',
      'font-size: 60px',
      'font-weight: bold',
      'text-shadow: 2px 2px 0px #000',
      'padding: 10px',
    ].join(';');

    const textStyle = [
      'font-size: 18px',
      'font-family: sans-serif',
      'color: #605959ff',
      'padding: 5px',
      'line-height: 1.5',
    ].join(';');

    // Only clear if in production to avoid annoying devs
    if (!import.meta.env.DEV) {
      console.clear();
    }

    setTimeout(() => {
      console.log('%cSTOP!', titleStyle);
      console.log(
        '%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a "hidden feature" or "hack", it is a scam and will give them access to your FairArena account.',
        textStyle,
      );
      console.log('%cSee https://en.wikipedia.org/wiki/Self-XSS for more information.', textStyle);
    }, 1000);
  }, []);

  // Handle hash routing for pricing modal
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#pricing') {
        setShowPricingModal(true);
      } else if (hash === '') {
        setShowPricingModal(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check if frontend is running on allowed domain
  if (frontendUrl) {
    const normalize = (url: string) => url.replace(/\/$/, '').toLowerCase();
    if (normalize(window.location.origin) !== normalize(frontendUrl)) {
      return <FrontendMismatch expectedUrl={frontendUrl} />;
    }
  }

  // Redirect all routes to maintenance if enabled
  if (isMaintenanceMode && location.pathname !== '/maintenance') {
    return <Navigate to="/maintenance" replace />;
  }

  // Prevent access to maintenance page when not in maintenance mode
  if (!isMaintenanceMode && location.pathname === '/maintenance') {
    return <Navigate to="/" replace />;
  }

  // Show IP blocked screen if IP is blocked
  if (isIPBlocked) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <IPBlockedPage
          reasons={ipBlockReasons}
          onRetry={() => {
            window.location.reload();
          }}
        />
      </>
    );
  }

  // Show banned screen if user is banned
  if (isBanned) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <BannedAccount />
      </>
    );
  }

  return (
    <>
      <Toaster richColors position="top-right" />

      {/* Defer analytics - not critical for initial render */}
      <Suspense fallback={null}>
        <Analytics />
        <SpeedInsights />
      </Suspense>

      {/* Lazy load modals */}
      <Suspense fallback={<ModalLoadingFallback />}>
        <PricingModal
          isOpen={showPricingModal}
          onClose={() => {
            setShowPricingModal(false);
            window.location.hash = '';
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CookieConsentModal
          isOpen={showModal}
          onClose={updateConsent}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
        />
      </Suspense>

      <Suspense fallback={null}>
        <GoogleOneTap />
      </Suspense>

      <LazyErrorBoundary>
        <OnboardingProvider>
          <Routes>
            <Route path="/maintenance" element={<Maintenance />} />
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route
                path="/why-choose-us"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <HowItWorks />
                  </Suspense>
                }
              />
              <Route
                path="/about"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <About />
                  </Suspense>
                }
              />
              <Route
                path="/changelog"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Changelog />
                  </Suspense>
                }
              />
              <Route
                path="/faq"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <FAQ />
                  </Suspense>
                }
              />
              <Route
                path="/accessibility"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Accessibility />
                  </Suspense>
                }
              />
              <Route
                path="/community-guidelines"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <CommunityGuidelines />
                  </Suspense>
                }
              />
              <Route
                path="/security-policy"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <SecurityPolicy />
                  </Suspense>
                }
              />
              <Route
                path="/security-acknowledgments"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <SecurityAcknowledgments />
                  </Suspense>
                }
              />
              <Route
                path="/dmca"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <DMCA />
                  </Suspense>
                }
              />
              <Route
                path="/privacy-policy"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <PrivacyPolicy />
                  </Suspense>
                }
              />
              <Route
                path="/cookie-policy"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <CookiePolicy />
                  </Suspense>
                }
              />
              <Route
                path="/support"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Support />
                  </Suspense>
                }
              />
              <Route
                path="/refund"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <RefundPage />
                  </Suspense>
                }
              />
              <Route
                path="/terms-and-conditions"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <TermsAndConditions />
                  </Suspense>
                }
              />
            </Route>
            <Route path="/dashboard" element={<ProtectedLayout />}>
              <Route
                index
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/credits"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <CreditsPage />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/credits/verify"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <CreditsVerificationPage />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/subscription"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <SubscriptionPage />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/inbox"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Inbox />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/hackathons"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Hackathons />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/calendar"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Calendar />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/analytics"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <AnalyticsPage />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/projects"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ProjectsPage />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/teams"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <TeamsPage />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/profile/edit"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <EditProfile />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/profile/views"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ProfileViews />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/public-profile"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <MyProfile />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/account-settings"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <AccountSettings />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/account-settings/logs"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <AccountLogs />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/oauth/applications"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <OAuthApplications />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/oauth/authorized"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <AuthorizedApps />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/device"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <DeviceAuthorization />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/support"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Support />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard/ai-gateway"
                element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    <AiGatewayPage />
                  </Suspense>
                }
              />
            </Route>
            <Route
              path="/feedback/:feedbackCode"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <Feedback />
                </Suspense>
              }
            />
            <Route
              path="/invite/team/:inviteCode"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <TeamInviteAcceptPage />
                </Suspense>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <PublicProfile />
                </Suspense>
              }
            />
            <Route
              path="/profile/:userId/stars"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <ProfileStars />
                </Suspense>
              }
            />
            <Route
              path="/waitlist"
              element={
                isNewSignupEnabled ? (
                  <Navigate to="/signup" replace />
                ) : (
                  <Suspense fallback={<PageLoadingFallback />}>
                    <WaitList />
                  </Suspense>
                )
              }
            />
            <Route path="/signin" element={<Signin />} />
            <Route
              path="/signup"
              element={
                isNewSignupEnabled ? (
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Signup />
                  </Suspense>
                ) : (
                  <Navigate to="/waitlist" replace />
                )
              }
            />
            <Route
              path="/forgot-password"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <ForgotPassword />
                </Suspense>
              }
            />
            <Route
              path="/reset-password/:token"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <ResetPassword />
                </Suspense>
              }
            />
            <Route
              path="/verify-email/:token"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <VerifyEmail />
                </Suspense>
              }
            />
            <Route
              path="/unsubscribe/:email"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <Unsubscribe />
                </Suspense>
              }
            />
            <Route
              path="/oauth/consent"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <OAuthConsent />
                </Suspense>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </OnboardingProvider>
      </LazyErrorBoundary>
    </>
  );
}

export default App;

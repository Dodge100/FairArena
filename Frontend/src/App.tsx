import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { CookieConsentModal } from './components/CookieConsentModal';
import { FrontendMismatch } from "./components/FrontendMismatch";
import { GoogleOneTap } from './components/GoogleOneTap';
import NotFound from './components/NotFound';
import PricingModal from './components/PricingModal';
import WaitList from './components/WaitList';
import { useCookieConsent } from './contexts/CookieConsentContext';
import { OnboardingProvider } from './contexts/OnboardingContext';
import ProtectedLayout from './layout/ProtectedLayout';
import PublicLayout from './layout/PublicLayout';
import { registerAuth } from './lib/apiClient';
import { useAuth, useToken } from './lib/auth';
import About from './pages/About';
import AccountLogs from './pages/AccountLogs';
import AccountSettings from './pages/AccountSettings';
import AuthorizedApps from './pages/AuthorizedApps';
import BannedAccount from './pages/BannedAccount';
import CookiePolicy from './pages/CookiePolicy';
import CreditsPage from './pages/CreditsPage';
import CreditsVerificationPage from './pages/CreditsVerificationPage';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import Feedback from './pages/Feedback';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Maintenance from './pages/Maintenance';
import MyProfile from './pages/MyProfile';
import OAuthApplications from './pages/OAuthApplications';
import OAuthConsent from './pages/OAuthConsent';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ProfileStars from './pages/ProfileStars';
import ProfileViews from './pages/ProfileViews';
import PublicProfile from './pages/PublicProfile';
import RefundPage from './pages/RefundPage';
import ResetPassword from './pages/ResetPassword';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import Support from './pages/Support';
import TeamInviteAcceptPage from './pages/TeamInviteAcceptPage';
import TeamsPage from './pages/TeamsPage';
import TermsAndConditions from './pages/TermsAndConditions';
import Unsubscribe from './pages/Unsubscribe';
import VerifyEmail from './pages/VerifyEmail';
import HowItWorks from './pages/WhyChooseUsPage';
import { initializeCsrfToken } from './utils/csrfToken';

function App() {
  const location = useLocation();
  const [showPricingModal, setShowPricingModal] = useState(false);
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const isNewSignupEnabled = import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true';
  const frontendUrl = import.meta.env.VITE_FRONTEND_URL;

  const { showModal, updateConsent, acceptAll, rejectAll } = useCookieConsent();
  const token = useToken();
  const { isBanned } = useAuth();

  useEffect(() => {
    registerAuth(token);
    // Initialize CSRF token from sessionStorage on app load
    initializeCsrfToken();
  }, [token]);

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
      <Analytics />
      <SpeedInsights />
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => {
          setShowPricingModal(false);
          window.location.hash = '';
        }}
      />
      <CookieConsentModal
        isOpen={showModal}
        onClose={updateConsent}
        onAcceptAll={acceptAll}
        onRejectAll={rejectAll}
      />
      <GoogleOneTap />
      <OnboardingProvider>
        <Routes>
          <Route path="/maintenance" element={<Maintenance />} />
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/why-choose-us" element={<HowItWorks />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/refund" element={<RefundPage />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          </Route>
          <Route path="/dashboard" element={<ProtectedLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/dashboard/credits" element={<CreditsPage />} />
            <Route path="/dashboard/credits/verify" element={<CreditsVerificationPage />} />
            <Route path="/dashboard/inbox" element={<Inbox />} />
            <Route path="/dashboard/teams" element={<TeamsPage />} />
            <Route path="/dashboard/profile/edit" element={<EditProfile />} />
            <Route path="/dashboard/profile/views" element={<ProfileViews />} />
            <Route path="/dashboard/public-profile" element={<MyProfile />} />
            <Route path="/dashboard/account-settings" element={<AccountSettings />} />
            <Route path="/dashboard/account-settings/logs" element={<AccountLogs />} />
            <Route path="/dashboard/oauth/applications" element={<OAuthApplications />} />
            <Route path="/dashboard/oauth/authorized" element={<AuthorizedApps />} />
          </Route>
          <Route path="/feedback/:feedbackCode" element={<Feedback />} />
          <Route path="/invite/team/:inviteCode" element={<TeamInviteAcceptPage />} />
          <Route path="/profile/:userId" element={<PublicProfile />} />
          <Route path="/profile/:userId/stars" element={<ProfileStars />} />
          <Route path="/support" element={<Support />} />
          <Route path="/waitlist" element={isNewSignupEnabled ? <Navigate to="/signup" replace /> : <WaitList />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/signup" element={isNewSignupEnabled ? <Signup /> : <Navigate to="/waitlist" replace />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/unsubscribe/:email" element={<Unsubscribe />} />
          <Route path="/oauth/consent" element={<OAuthConsent />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </OnboardingProvider>
    </>
  );
}

export default App;

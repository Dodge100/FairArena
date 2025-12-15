import { GoogleOneTap } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { CookieConsentModal } from './components/CookieConsentModal';
import NotFound from './components/NotFound';
import PricingModal from './components/PricingModal';
import WaitList from './components/WaitList';
import { useCookieConsent } from './contexts/CookieConsentContext';
import ProtectedLayout from './layout/ProtectedLayout';
import PublicLayout from './layout/PublicLayout';
import About from './pages/About';
import AccountLogs from './pages/AccountLogs';
import AccountSettings from './pages/AccountSettings';
import CookiePolicy from './pages/CookiePolicy';
import CreditsPage from './pages/CreditsPage';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Maintenance from './pages/Maintenance';
import MyProfile from './pages/MyProfile';
import PricingPage from './pages/PricingPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Profile from './pages/Profile';
import ProfileStars from './pages/ProfileStars';
import ProfileViews from './pages/ProfileViews';
import PublicProfile from './pages/PublicProfile';
import RefundPage from './pages/RefundPage';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import Support from './pages/Support';
import TeamInviteAcceptPage from './pages/TeamInviteAcceptPage';
import TeamsPage from './pages/TeamsPage';
import TermsAndConditions from './pages/TermsAndConditions';
import Unsubscribe from './pages/Unsubscribe';
import HowItWorks from './pages/WhyChooseUsPage';

function App() {
  const location = useLocation();
  const [showPricingModal, setShowPricingModal] = useState(false);
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const { showModal, updateConsent, acceptAll, rejectAll } = useCookieConsent();

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

    // Check initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Redirect all routes to maintenance if enabled
  if (isMaintenanceMode && location.pathname !== '/maintenance') {
    return <Navigate to="/maintenance" replace />;
  }

  // Prevent access to maintenance page when not in maintenance mode
  if (!isMaintenanceMode && location.pathname === '/maintenance') {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <GoogleOneTap />
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
      <Routes>
        <Route path="/maintenance" element={<Maintenance />} />
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/why-choose-us" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        </Route>
        <Route path="/dashboard" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/dashboard/credits" element={<CreditsPage />} />
          <Route path="/dashboard/inbox" element={<Inbox />} />
          <Route path="/dashboard/teams" element={<TeamsPage />} />
          <Route path="/dashboard/profile" element={<Profile />} />
          <Route path="/dashboard/profile/edit" element={<EditProfile />} />
          <Route path="/dashboard/profile/views" element={<ProfileViews />} />
          <Route path="/dashboard/public-profile" element={<MyProfile />} />
          <Route path="/dashboard/account-settings" element={<AccountSettings />} />
          <Route path="/dashboard/account-settings/logs" element={<AccountLogs />} />
        </Route>
        <Route path="/feedback/:feedbackCode" element={<Feedback />} />
        <Route path="/invite/team/:inviteCode" element={<TeamInviteAcceptPage />} />
        <Route path="/profile/:userId" element={<PublicProfile />} />
        <Route path="/profile/:userId/stars" element={<ProfileStars />} />
        <Route path="/support" element={<Support />} />
        <Route path="/waitlist" element={<WaitList />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/unsubscribe/:email" element={<Unsubscribe />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;

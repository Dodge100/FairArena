import { GoogleOneTap } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import NotFound from './components/NotFound';
import PricingModal from './components/PricingModal';
import WaitList from './components/WaitList';
import ProtectedLayout from './layout/ProtectedLayout';
import PublicLayout from './layout/PublicLayout';
import About from './pages/About';
import AccountLogs from './pages/AccountLogs';
import AccountSettings from './pages/AccountSettings';
import CreateOrganization from './pages/CreateOrganization';
import CreditsPage from './pages/CreditsPage';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Maintenance from './pages/Maintenance';
import MyProfile from './pages/MyProfile';
import OrganizationDetails from './pages/OrganizationDetails';
import Organizations from './pages/Organizations';
import OrganizationSettings from './pages/OrganizationSettings';
import PricingPage from './pages/PricingPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Profile from './pages/Profile';
import ProfileStars from './pages/ProfileStars';
import ProfileViews from './pages/ProfileViews';
import PublicProfile from './pages/PublicProfile';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import Support from './pages/Support';
import TermsAndConditions from './pages/TermsAndConditions';
import Unsubscribe from './pages/Unsubscribe';
import HowItWorks from './pages/WhyChooseUsPage';

function App() {
  const location = useLocation();
  const [showPricingModal, setShowPricingModal] = useState(false);
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

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
      <Routes>
        <Route path="/maintenance" element={<Maintenance />} />
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/why-choose-us" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        </Route>
        <Route path="/dashboard" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/dashboard/credits" element={<CreditsPage />} />
          <Route path="/dashboard/inbox" element={<Inbox />} />
          <Route path="/dashboard/profile" element={<Profile />} />
          <Route path="/dashboard/profile/edit" element={<EditProfile />} />
          <Route path="/dashboard/profile/views" element={<ProfileViews />} />
          <Route path="/dashboard/public-profile" element={<MyProfile />} />
          <Route path="/dashboard/account-settings" element={<AccountSettings />} />
          <Route path="/dashboard/account-settings/logs" element={<AccountLogs />} />
          <Route path="/dashboard/organization" element={<Organizations />} />
          <Route path="/dashboard/organization/create" element={<CreateOrganization />} />
          <Route path="/dashboard/organization/:slug" element={<OrganizationDetails />} />
          <Route path="/dashboard/organization/:slug/settings" element={<OrganizationSettings />} />
        </Route>
        <Route path="/feedback/:feedbackCode" element={<Feedback />} />
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

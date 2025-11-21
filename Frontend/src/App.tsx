import { GoogleOneTap } from '@clerk/clerk-react';
import { Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import NotFound from './components/NotFound';
import WaitList from './components/WaitList';
import ProtectedLayout from './layout/ProtectedLayout';
import PublicLayout from './layout/PublicLayout';
import About from './pages/About';
import AccountLogs from './pages/AccountLogs';
import AccountSettings from './pages/AccountSettings';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import Home from './pages/Home';
import HowItWorks from './pages/WhyChooseUsPage';
import MyProfile from './pages/MyProfile';
import Profile from './pages/Profile';
import ProfileViews from './pages/ProfileViews';
import PublicProfile from './pages/PublicProfile';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import Support from './pages/Support';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import PricingPage from './pages/PricingPage';

function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <GoogleOneTap />
      <Routes>
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
          <Route path="/dashboard/profile" element={<Profile />} />
          <Route path="/dashboard/profile/edit" element={<EditProfile />} />
          <Route path="/dashboard/profile/views" element={<ProfileViews />} />
          <Route path="/dashboard/public-profile" element={<MyProfile />} />
          <Route path="/dashboard/account-settings" element={<AccountSettings />} />
          <Route path="/dashboard/account-settings/logs" element={<AccountLogs />} />
        </Route>
        <Route path="/profile/:userId" element={<PublicProfile />} />
        <Route path="/support" element={<Support />} />
        <Route path="/waitlist" element={<WaitList />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;

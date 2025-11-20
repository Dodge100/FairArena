import { Route, Routes } from 'react-router';
import NotFound from './components/NotFound';
import WaitList from './components/WaitList';
import ProtectedLayout from './layout/ProtectedLayout';
import PublicLayout from './layout/PublicLayout';
import About from './pages/About';
import Benefits from './pages/Benefits';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import Testimonials from './pages/Testimonials';
import Profile from './pages/Profile';
import Support from './pages/Support';
import { Protected } from '@/libs/protected';
import { GoogleOneTap } from '@clerk/clerk-react'

function App() {
  return (
    <>
    <GoogleOneTap />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/benefits" element={<Benefits />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/testimonials" element={<Testimonials />} />
          <Route path="/about" element={<About />} />
        </Route>
        <Route path="/dashboard" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
        </Route>
        <Route path="/dashboard/profile" element={<Protected><Profile /></Protected>} />
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

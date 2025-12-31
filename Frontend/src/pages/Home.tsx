import Header from '../components/Header';
import DemoVideo from '../components/ui/DemoVideo';
import WhyChooseUs from '../components/WhyChooseUs';
import Faq from '../components/Faq';
import Newsletter from '@/components/NewsLetter';
import { Navigate } from 'react-router';
import { useAuthState } from '@/lib/auth';

function Home() {
  const { isSignedIn } = useAuthState();

    if (
    isSignedIn &&
    localStorage.getItem('disableHomePage') === 'true'
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Header />
      <DemoVideo />
      <WhyChooseUs />
      <Faq />
      <Newsletter />
    </>
  );
}

export default Home;

import Newsletter from '@/components/NewsLetter';
import { useAuthState } from '@/lib/auth';
import { Navigate } from 'react-router';
import Faq from '../components/Faq';
import Hero from '../components/Hero';
import DemoVideo from '../components/ui/DemoVideo';
import WhyChooseUs from '../components/WhyChooseUs';

function Home() {
  const { isSignedIn } = useAuthState();

  if (
    isSignedIn &&
    localStorage.getItem('disableHomePage') === 'true'
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col w-full overflow-hidden">
      <Hero />

      <section id="demo" className="w-full py-10 md:py-20 bg-neutral-50 dark:bg-neutral-900/10">
        <DemoVideo />
      </section>

      <WhyChooseUs />

      <Faq />

      <Newsletter />
    </div>
  );
}

export default Home;

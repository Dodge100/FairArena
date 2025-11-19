import { Spotlight } from '../components/ui/Spotlight';
import Header from '../components/Header';
import DemoVideo from '../components/ui/DemoVideo';
import WhyChooseUs from '../components/WhyChooseUs';
import Faq from '../components/Faq';
import Pricing from '../components/Pricing';
import Footer from '@/components/Footer';

function Home() {
  return (
    <>
      
      <Header />
      <DemoVideo />
      <WhyChooseUs />
      <Pricing />
      <Faq />
      <Footer/>
    </>
  );
}

export default Home;

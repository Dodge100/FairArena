import Header from '../components/Header';
import DemoVideo from '../components/ui/DemoVideo';
import WhyChooseUs from '../components/WhyChooseUs';
import Faq from '../components/Faq';
import Newsletter from '@/components/NewsLetter';

function Home() {
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

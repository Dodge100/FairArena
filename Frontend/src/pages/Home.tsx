import { Spotlight } from '../components/ui/Spotlight'
import Header from '../components/Header'
import DemoVideo from '../components/ui/DemoVideo'
import WhyChooseUs from '../components/WhyChooseUs';
import Faq from '../components/Faq';
import Pricing from '../components/Pricing';

function Home() {


return (
    <>
    <Spotlight
        className="-top-40 left-0 md:-top-100 md:left-60"
        fill="#DDFF00"
      />
      <Header/>
      <DemoVideo/>
      <WhyChooseUs/>
      <Pricing/>
      <Faq/>
    </>
  )
}

export default Home
import { Spotlight } from '../components/ui/Spotlight'
import Header from '../components/Header'
import DemoVideo from '../components/ui/DemoVideo'
import WhyChooseUs from '../components/WhyChooseUs';

function Home() {


return (
    <>
    <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill="#DDFF00"
      />
      <Header/>
      <DemoVideo/>
      <WhyChooseUs/>
    </>
  )
}

export default Home
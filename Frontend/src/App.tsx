import './App.css'
import Header from './components/Header'
import Navbar from './components/Navbar'
import { Cover } from './components/ui/Cover'
import { DottedGlowBackground } from './components/ui/Dotted-background'
import { Spotlight } from './components/ui/Spotlight'



function App() {

  return (
    <>
    <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill="#DDFF00"
      />
     
      <DottedGlowBackground className='opacity-95 absolute -z-1' glowColor='#e8ff53' darkColor='#DDFF00' />
      <Navbar/>
      <Header/>
    </>
  )
}

export default App

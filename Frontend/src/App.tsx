import { Route, Routes } from 'react-router'
import './App.css'
import Home from './pages/Home'
import PublicLayout from './layout/PublicLayout'
import Benefits from './pages/Benefits'
import HowItWorks from './pages/HowItWorks'
import Testimonials from './pages/Testimonials'
import FAQ from './pages/FAQ'



function App() {

  return (
    <>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/benefits" element={<Benefits />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/FAQ" element={<FAQ />} />
      </Route>
    </Routes>
    </>
  )
}

export default App;

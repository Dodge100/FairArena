import { Route, Routes } from 'react-router'
import './App.css'
import Signup from './components/Signup'
import WaitList from './components/WaitList'
import PublicLayout from './layout/PublicLayout'
import Benefits from './pages/Benefits'
import FAQ from './pages/FAQ'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import Testimonials from './pages/Testimonials'



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
        <Route path="/waitlist" element={<WaitList />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </>
  )
}

export default App;

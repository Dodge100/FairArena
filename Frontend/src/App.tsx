import { Route, Routes } from 'react-router'
import './App.css'
import Home from './pages/Home'
import PublicLayout from './layout/PublicLayout'



function App() {

  return (
    <>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
      </Route>
    </Routes>
    </>
  )
}

export default App

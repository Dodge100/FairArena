import React from 'react'
import { Spotlight } from '../components/ui/Spotlight'
import { DottedGlowBackground } from '../components/ui/Dotted-background'
import Header from '../components/Header'

function Home() {
  return (
    <>
    <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill="#DDFF00"
      />
     
      
      <Header/>
      
    </>
  )
}

export default Home
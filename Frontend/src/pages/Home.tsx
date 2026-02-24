/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import Newsletter from '@/components/NewsLetter';
import Pricing from '@/components/Pricing';
import { useAuthState } from '@/lib/auth';
import { Navigate } from 'react-router';
import Faq from '../components/Faq';
import GptPromotion from '../components/GptPromotion';
import Hero from '../components/Hero';
import DemoVideo from '../components/ui/DemoVideo';
import WhyChooseUs from '../components/WhyChooseUs';

function Home() {
  const { isSignedIn } = useAuthState();

  if (isSignedIn && localStorage.getItem('disableHomePage') === 'true') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col w-full overflow-hidden">
      <Hero />

      <section id="demo" className="w-full py-10 md:py-20 bg-neutral-50 dark:bg-neutral-900/10">
        <DemoVideo />
      </section>

      <GptPromotion />

      <WhyChooseUs />
      <Pricing />
      <Faq />

      <Newsletter />
    </div>
  );
}

export default Home;

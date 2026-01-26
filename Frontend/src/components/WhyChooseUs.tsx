import { BarChart3, Lightbulb, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import BenefitCard from './BenefitCard';
import { DataSaverImage } from './ui/DataSaverImage';

function WhyChooseUs() {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // DATA ARRAY
  const benefits = [
    {
      id: 1,
      title: t('home.whyChooseUs.cards.0.title'),
      desc: t('home.whyChooseUs.cards.0.desc'),
      icon: Lightbulb,
    },
    {
      id: 2,
      title: t('home.whyChooseUs.cards.1.title'),
      desc: t('home.whyChooseUs.cards.1.desc'),
      icon: Users,
    },
    {
      id: 3,
      title: t('home.whyChooseUs.cards.2.title'),
      desc: t('home.whyChooseUs.cards.2.desc'),
      icon: BarChart3,
    },
  ];

  return (
    <div className="w-full h-auto pb-20 flex flex-col items-center justify-start">
      {/* Heading */}
      <h2
        className={`
          text-sm md:text-xl font-semibold px-6 py-1 h-16 rounded-full flex items-center overflow-hidden
          ${isDark ? 'bg-neutral-900 text-[#d9ff00] border border-neutral-800' : 'bg-neutral-100 text-neutral-800 border border-neutral-200'}
        `}
      >
        {t('home.whyChooseUs.badge')}
        <DataSaverImage
          src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png"
          alt="FairArena Logo"
          className="w-20 h-auto object-contain ml-2"
          fallback={
            <div className="w-20 h-8 bg-primary/10 rounded flex items-center justify-center ml-2">
              <span className="text-sm font-bold text-primary">FA</span>
            </div>
          }
        />
      </h2>

      {/* Subtitle */}
      <p
        className={`
          mt-10 text-center font-semibold
          text-4xl md:text-5xl
          ${isDark ? 'text-neutral-100' : 'text-neutral-800'}
        `}
      >
        {t('home.whyChooseUs.title')}
      </p>

      {/* Cards Grid */}
      <div
        className="
          mt-16
          grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3
          gap-8 px-10
          w-[90%] max-w-7xl
        "
      >
        {benefits.map((item) => (
          <BenefitCard
            key={item.id}
            icon={item.icon}
            title={item.title}
            desc={item.desc}
            isDark={isDark}
          />
        ))}
      </div>

      <Link to="/why-choose-us">
        <button className="mt-10 px-8 py-4 rounded-full bg-lime-300 text-black font-semibold text-lg hover:shadow-[0_0_20px_rgba(190,242,100,0.4)] transition-all duration-300 hover:scale-105">
          {t('home.whyChooseUs.cta')}
        </button>
      </Link>
    </div>
  );
}

export default WhyChooseUs;

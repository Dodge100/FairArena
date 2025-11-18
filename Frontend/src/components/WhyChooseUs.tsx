import { useEffect, useState } from 'react';
import { Lightbulb, Users, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

function WhyChooseUs() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  // DATA ARRAY
  const benefits = [
    {
      id: 1,
      title: 'Automate Repetitive Tasks',
      desc: 'Save time with automation tools that handle routine tasks for you – focus on growth.',
      icon: Lightbulb,
    },
    {
      id: 2,
      title: 'Boost Collaboration',
      desc: 'Get everyone on the same page with real-time updates, comments, and shared project boards.',
      icon: Users,
    },
    {
      id: 3,
      title: 'Track Progress',
      desc: 'Stay on top of your goals with detailed analytics and custom reports, updated live.',
      icon: BarChart3,
    },
  ];

  // REUSABLE CARD COMPONENT
  const BenefitCard = ({
    icon: Icon,
    title,
    desc,
  }: {
    icon: LucideIcon;
    title: string;
    desc: string;
  }) => (
    <div
      className={`
        p-8 rounded-3xl transition shadow-[0_0_30px_-10px_rgba(0,0,0,0.4)]
        border
        ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}
      `}
    >
      <div
        className={`
          w-16 h-16 rounded-2xl mb-6 flex items-center justify-center
          ${isDark ? 'bg-[#ddef00]/10 ' : 'bg-[#ddef00]/20 '}
        `}
      >
        <Icon size={32} className={`${'text-[#ddef00]'}`} />
      </div>

      <h3 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-black'}`}>
        {title}
      </h3>

      <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-sm leading-relaxed`}>
        {desc}
      </p>
    </div>
  );

  return (
    <div className="w-full h-auto pb-20 flex flex-col items-center justify-start">
      {/* Heading */}
      <h2
        className={`
          text-xl md:text-sm font-semibold px-6 py-1 h-15 rounded-full flex items-center overflow-hidden
          ${isDark ? 'bg-neutral-900 text-[#ddef00]' : 'bg-neutral-100 text-neutral-800'}
        `}
      >
        Why Choose
        <img
          src="/fairArenaLogotop.png"
          alt="FairArena Logo"
          className="md:w-20 w-20 h-auto object-contain ml-2"
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
        Key Benefits Of Using <span className="text-neutral-400">Fair Arena</span>
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
          <BenefitCard key={item.id} icon={item.icon} title={item.title} desc={item.desc} />
        ))}
      </div>
    </div>
  );
}

export default WhyChooseUs;

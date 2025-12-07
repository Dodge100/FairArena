import { BarChart3, Lightbulb, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataSaverUtils } from '../hooks/useDataSaverUtils';
import { useTheme } from '../hooks/useTheme';
import BenefitCard from './BenefitCard'; // ⬅️ IMPORTED
import { DataSaverImage } from './ui/DataSaverImage';

function WhyChooseUs() {
  const { theme } = useTheme();
  const { cn } = useDataSaverUtils();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  // DATA ARRAY
  const benefits = [
    {
      id: 1,
      title: 'AI-Powered Website Analysis',
      desc: 'Get automated insights into each project: performance, UI/UX quality, SEO score, accessibility, code uniqueness, and improvement suggestions.',
      icon: Lightbulb,
    },
    {
      id: 2,
      title: 'Fair & Transparent Scoring',
      desc: 'Judges score entries with predefined rubrics. All scores are logged, secure, and visible to organisers.',
      icon: Users,
    },
    {
      id: 3,
      title: 'One Dashboard for Entire Hackathon',
      desc: 'Manage submissions, scores, judges, participants, prizes, winners, categories, and rounds all from one clean dashboard.',
      icon: BarChart3,
    },
  ];

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
        <DataSaverImage
          src="/fairArenaLogotop.png"
          alt="FairArena Logo"
          className="md:w-20 w-20 h-auto object-contain ml-2"
          fallback={
            <div className="md:w-20 w-20 h-8 bg-primary/10 rounded flex items-center justify-center ml-2">
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
        Key Benefits Of Using <span className="text-neutral-500">Fair Arena</span>
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
        <button className="mt-10 px-6 py-3 rounded-full bg-[#ddef00] text-black font-semibold text-lg hover:bg-[#ddef00]/80 transition">
          Read More
        </button>
      </Link>
    </div>
  );
}

export default WhyChooseUs;

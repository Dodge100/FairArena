import BenefitCard from '@/components/BenefitCard';
import { useTheme } from '@/hooks/useTheme';
import {
  BarChart3,
  CheckCircle2,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  Users,
} from 'lucide-react';

import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

function HowItWorks() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  const benefits = t('home.whyChooseUsPage.benefits', { returnObjects: true }) as Array<{
    id: number;
    title: string;
    desc: string;
    iconName: string;
  }>;
  const iconMap: Record<number, any> = {
    1: Lightbulb,
    2: Users,
    3: LayoutDashboard,
    4: BarChart3,
    5: LineChart,
    6: CheckCircle2,
  };

  return (
    <div className="w-full h-auto mb-40 flex flex-col items-center justify-center">
      <h1 className="text-center mt-40 text-neutral-400 text-sm sm:text-base md:text-lg gap-2 flex flex-col px-4 md:px-0 max-w-[90%] sm:max-w-[80%] md:max-w-[60%] lg:max-w-[50%] xl:max-w-[60%] mx-auto">
        <span className="text-4xl sm:text-5xl text-[#ddef00] [-webkit-text-stroke:_0.7px_black] font-bold">
          {t('home.whyChooseUsPage.title')}
        </span>
      </h1>

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
            isDark={isDark}
            icon={iconMap[item.id]} // map back using ID
            title={item.title}
            desc={item.desc}
          />
        ))}
      </div>
    </div>
  );
}

export default HowItWorks;

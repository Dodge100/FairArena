// BenefitCard.tsx
import type { LucideIcon } from 'lucide-react';

type BenefitCardProps = {
  icon: LucideIcon;
  title: string;
  desc: string;
  isDark: boolean;
};

const BenefitCard = ({ icon: Icon, title, desc, isDark }: BenefitCardProps) => {
  return (
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
          ${isDark ? 'bg-[#ddef00]/10' : 'bg-[#ddef00]/20'}
        `}
      >
        <Icon size={32} className="text-[#ddef00]" />
      </div>

      <h3 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-black'}`}>
        {title}
      </h3>

      <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-sm leading-relaxed`}>
        {desc}
      </p>
    </div>
  );
};

export default BenefitCard;

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
        p-8 rounded-3xl transition duration-300 shadow-[0_0_30px_-10px_rgba(0,0,0,0.1)]
        border hover:-translate-y-2
        ${
          isDark
            ? 'bg-neutral-900/50 border-neutral-800 hover:border-[#d9ff00]/50 hover:shadow-[0_0_30px_-10px_rgba(217,255,0,0.15)]'
            : 'bg-white border-neutral-200 hover:border-[#d9ff00]/50 hover:shadow-xl'
        }
      `}
    >
      <div
        className={`
          w-16 h-16 rounded-2xl mb-6 flex items-center justify-center
          ${isDark ? 'bg-[#d9ff00]/10' : 'bg-[#d9ff00]/20'}
        `}
      >
        <Icon size={32} className="text-[#d9ff00]" />
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

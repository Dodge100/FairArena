import { useTheme } from '@/hooks/useTheme';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

function PricingCard({ plan, billing, isDark }: any) {
  const price = plan.price[billing];
  const highlight = plan.highlight;
  const isPopular = plan.isPopular;

  return (
    <div
      className={`rounded-2xl p-6 sm:p-8 flex flex-col relative transition-colors
        ${
          highlight
            ? isDark
              ? 'bg-[#0f0f0f] border-[3px] border-[#d9ff00]'
              : 'bg-white border-2 border-[#d9ff00]'
            : isDark
              ? 'bg-[#0d0d0d] border border-white/10'
              : 'bg-white border border-neutral-300'
        }
      `}
    >
      {isPopular && (
        <span className="absolute top-4 right-4 bg-[#d9ff00] text-black text-xs font-semibold px-2 py-1 rounded-full">
          Popular
        </span>
      )}

      <h3
        className={`text-lg sm:text-xl font-semibold mb-2 ${
          highlight ? 'text-[#d9ff00]' : isDark ? 'text-white' : 'text-black'
        }`}
      >
        {plan.name}
      </h3>

      <p className={`text-3xl sm:text-4xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>
        ₹{price}
      </p>

      <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-xs sm:text-sm mb-4`}>
        For Hackathon Organisers
      </p>

      <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-sm mb-6`}>
        {plan.description}
      </p>

      {/* CTA Buttons */}
      <button
        className={`w-full py-3 rounded-lg font-semibold transition text-sm sm:text-base
          ${
            highlight
              ? 'bg-[#d9ff00] text-black hover:bg-[#c0e600]'
              : isDark
                ? 'bg-white text-black hover:opacity-90'
                : 'bg-black text-white hover:opacity-90'
          }
        `}
      >
        Get Started
      </button>

      <button
        className={`w-full py-3 rounded-lg mt-3 font-semibold transition border text-sm sm:text-base
          ${
            isDark
              ? 'bg-transparent border-white/20 text-white hover:bg-white/10'
              : 'bg-transparent border-neutral-300 text-black hover:bg-neutral-100'
          }
        `}
      >
        Chat to Sales
      </button>

      {/* Feature List */}
      <div className="mt-6 sm:mt-8">
        <h4 className={`${isDark ? 'text-white' : 'text-black'} font-semibold mb-3`}>
          {plan.featuresTitle}
        </h4>

        <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-sm mb-4`}>
          {plan.featuresSubtitle}
        </p>

        <ul className="space-y-3">
          {plan.features.map((feature: string, i: number) => (
            <li
              key={i}
              className={`flex items-center gap-3 text-sm sm:text-base ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              <Check size={18} className="text-[#d9ff00]" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const PLANS = [
  {
    name: 'Basic Plan',
    isPopular: false,
    highlight: false,
    price: { monthly: 899, annual: 899 },
    description: 'Perfect for small hackathons & student-led events.',
    featuresTitle: 'BASIC FEATURES',
    featuresSubtitle: 'Everything you need to host a simple hackathon',
    features: [
      '50 Participants',
      '5 Judges',
      'Manual Scoring System',
      'Basic Real-time Leaderboard',
      'Submission Management',
      'Email Support',
    ],
  },
  {
    name: 'Business Plan',
    isPopular: true,
    highlight: true,
    price: { monthly: 2999, annual: 2999 },
    description: 'Our most popular plan with AI-powered scoring.',
    featuresTitle: 'BUSINESS FEATURES',
    featuresSubtitle: 'Everything in Basic + Advanced AI Tools',
    features: [
      '300 Participants',
      '20 Judges',
      'AI Website Analysis',
      'Advanced Leaderboard',
      'Judge Collaboration Tools',
      'AI Scoring Assistance',
      'Priority Support',
    ],
  },
  {
    name: 'Enterprise Plan',
    isPopular: false,
    highlight: false,
    price: { monthly: 'Custom', annual: 'Custom' },
    description: 'For large-scale, enterprise-grade hackathons.',
    featuresTitle: 'ENTERPRISE FEATURES',
    featuresSubtitle: 'Everything in Business + Enterprise Tools',
    features: [
      'Unlimited Participants',
      'Unlimited Judges',
      'Deep AI Analytics',
      'Plagiarism Detection',
      'Custom Rubrics & Permissions',
      'Dedicated Account Manager',
      'SLA-backed Support',
    ],
  },
];

const COMPARISON_TABLE = [
  { feature: 'Price', basic: '₹899', business: '₹2,999', enterprise: 'Custom' },
  { feature: 'Participants', basic: '50', business: '300', enterprise: 'Unlimited' },
  { feature: 'Judges', basic: '5', business: '20', enterprise: 'Unlimited' },
  { feature: 'Manual Scoring', basic: '✔', business: '✔', enterprise: '✔' },
  { feature: 'Advanced Leaderboard', basic: '—', business: '✔', enterprise: '✔' },
  { feature: 'AI Website Analysis', basic: '—', business: '✔', enterprise: '✔ (Deep)' },
  { feature: 'AI Scoring Help', basic: '—', business: '✔', enterprise: '✔' },
  { feature: 'Plagiarism Detection', basic: '—', business: '—', enterprise: '✔' },
  { feature: 'Support', basic: 'Email', business: 'Priority', enterprise: 'SLA-backed' },
  { feature: 'Manager', basic: '—', business: '—', enterprise: 'Dedicated' },
];

/* ======================================================================================
   MAIN PRICING PAGE — FULLY RESPONSIVE
====================================================================================== */

export default function PricingPage() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  return (
    <div className={`pt-20 pb-20 mt-10 px-4 sm:px-6 lg:px-10`}>
      {/* Header */}
      <h1 className="text-center text-4xl sm:text-5xl font-bold text-[#ddef00] [-webkit-text-stroke:_1px_black]">
        FairArena — Pricing
      </h1>

      <p className="text-center mt-4 text-base sm:text-lg max-w-2xl mx-auto">
        Simple, transparent pricing for every hackathon.
      </p>

      {/* Billing Toggle */}
      <div className="flex justify-center mt-10 gap-4 sm:gap-6">
        <button
          onClick={() => setBilling('monthly')}
          className={`px-5 sm:px-6 py-2 rounded-full text-sm sm:text-base ${
            billing === 'monthly' ? 'bg-[#ddef00] text-black' : 'bg-neutral-700 text-white'
          }`}
        >
          Per Event
        </button>
      </div>

      {/* Pricing Cards */}
      <div
        className="
        grid
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-3
        gap-8
        sm:gap-10
        max-w-7xl
        mx-auto
        mt-14 sm:mt-16
      "
      >
        {PLANS.map((plan, i) => (
          <PricingCard key={i} plan={plan} billing={billing} isDark={isDark} />
        ))}
      </div>

      {/* Comparison Table */}
      <h2 className="text-center text-2xl sm:text-3xl font-bold mt-20 sm:mt-24 text-[#ddef00] [-webkit-text-stroke:_1px_black]">
        Compare All Plans
      </h2>

      <div className="overflow-x-auto mt-8 sm:mt-10">
        <table
          className={`w-full border-collapse text-xs sm:text-sm ${
            isDark ? 'text-neutral-300' : 'text-neutral-800'
          }`}
        >
          <thead>
            <tr
              className={`${
                isDark ? 'bg-neutral-800' : 'bg-neutral-200'
              } text-left text-sm sm:text-base`}
            >
              <th className="p-3 sm:p-4">Feature</th>
              <th className="p-3 sm:p-4 text-center">Basic</th>
              <th className="p-3 sm:p-4 text-center">Business</th>
              <th className="p-3 sm:p-4 text-center">Enterprise</th>
            </tr>
          </thead>

          <tbody>
            {COMPARISON_TABLE.map((row, i) => (
              <tr
                key={i}
                className={`border-b ${isDark ? 'border-neutral-700' : 'border-neutral-300'}`}
              >
                <td className="p-3 sm:p-4">{row.feature}</td>
                <td className="p-3 sm:p-4 text-center">{row.basic}</td>
                <td className="p-3 sm:p-4 text-center">{row.business}</td>
                <td className="p-3 sm:p-4 text-center">{row.enterprise}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

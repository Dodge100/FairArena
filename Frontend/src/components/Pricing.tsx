import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface FeatureList {
  monthly: number;
  annual: number;
}

interface PricingPlan {
  name: string;
  isPopular?: boolean;
  price: FeatureList;
  description: string;
  featuresTitle: string;
  featuresSubtitle: string;
  features: string[];
  highlight?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Basic plan',
    price: { monthly: 10, annual: 8 },
    description: 'Best for small hackathons.',
    featuresTitle: 'FEATURES',
    featuresSubtitle: 'Everything in our free plan plus…',
    features: [
      'Up to 50 participants',
      '5 judges',
      'Manual scoring system',
      'Basic leaderboard',
      'Email support',
    ],
  },
  {
    name: 'Business plan',
    isPopular: true,
    highlight: true,
    price: { monthly: 20, annual: 16 },
    description: 'Growing teams up to 20 users.',
    featuresTitle: 'FEATURES',
    featuresSubtitle: 'Everything in Basic plus…',
    features: [
      '200+ integrations',
      'Advanced reporting and analytics',
      'Up to 20 individual users',
      '40GB individual data each user',
      'Priority chat and email support',
    ],
  },
  {
    name: 'Enterprise plan',
    price: { monthly: 40, annual: 35 },
    description: 'Advanced features + unlimited users.',
    featuresTitle: 'FEATURES',
    featuresSubtitle: 'Everything in Business plus…',
    features: [
      'Advanced custom fields',
      'Audit log and data history',
      'Unlimited individual users',
      'Unlimited individual data',
      'Personalised + priority service',
    ],
  },
];

interface PricingCardProps {
  plan: PricingPlan;
  billing: 'monthly' | 'annual';
  isDark: boolean;
}

function PricingCard({ plan, billing, isDark }: PricingCardProps) {
  const price = plan.price[billing];
  const highlight = plan.highlight;
  const isPopular = plan.isPopular;

  return (
    <div
      className={`rounded-2xl p-8 flex flex-col relative transition-colors
        ${
          highlight
            ? isDark
              ? 'bg-[#0f0f0f] border-3 border-[#d9ff00]'
              : 'bg-white border-2 border-[#d9ff00]'
            : isDark
              ? 'bg-[#0d0d0d] border border-white/10'
              : 'bg-white border border-neutral-300'
        }
      `}
    >
      {isPopular && (
        <span className="absolute top-6 right-6 bg-[#d9ff00] text-black text-xs font-semibold px-2 py-1 rounded-full">
          Popular
        </span>
      )}

      <h3
        className={`text-xl font-semibold mb-2 ${
          highlight ? 'text-[#d9ff00]' : isDark ? 'text-white' : 'text-black'
        }`}
      >
        {plan.name}
      </h3>

      <p className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>${price}</p>
      <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-sm mb-6`}>
        For Hackathon Organisers
      </p>

      <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-sm mb-6`}>
        {plan.description}
      </p>

      {/* Buttons */}
      <button
        className={`w-full py-3 rounded-lg font-semibold transition
          ${
            highlight
              ? 'bg-[#d9ff00] text-black hover:bg-[#c0e600]'
              : isDark
                ? 'bg-white text-black hover:opacity-90'
                : 'bg-black text-white hover:opacity-90'
          }
        `}
      >
        Get started
      </button>

      <button
        className={`w-full py-3 rounded-lg mt-3 font-semibold transition border
          ${
            isDark
              ? 'bg-transparent border-white/20 text-white hover:bg-white/10'
              : 'bg-transparent border-neutral-300 text-black hover:bg-neutral-100'
          }
        `}
      >
        Chat to sales
      </button>

      {/* Features */}
      <div className="mt-8">
        <h4 className={`${isDark ? 'text-white' : 'text-black'} font-semibold mb-3`}>
          {plan.featuresTitle}
        </h4>

        <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-sm mb-4`}>
          {plan.featuresSubtitle}
        </p>

        <ul className="space-y-3">
          {plan.features.map((feature, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 text-sm ${isDark ? 'text-white' : 'text-black'}`}
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

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === 'dark');
  }, [theme]);

  return (
    <div
      className={`w-full min-h-screen py-28 px-6 flex flex-col items-center transition-colors

    `}
    >
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="px-4 py-1 -mb-5 rounded-full bg-[#111]/90 text-[#d9ff00] text-sm font-medium"
      >
        Get started Now
      </motion.div>

      {/* Heading */}
      <p
        className={`
          mt-10 text-center font-semibold text-4xl md:text-5xl mb-10 transition-colors
          ${isDark ? 'text-neutral-100' : 'text-black'}
        `}
      >
        Pricing of{' '}
        <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>Fair Arena</span>
      </p>

      {/* Toggle Buttons */}
      <div
        className={`relative flex items-center gap-0 mb-12 p-2 rounded-xl transition-colors
        ${isDark ? 'bg-[#0d0d0d]' : 'bg-neutral-200'}
      `}
      >
        {/* Sliding neon highlight */}
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-2 bottom-2 rounded-lg bg-[#d9ff00]"
          style={{
            left: billing === 'monthly' ? '8px' : '50%',
            width: 'calc(50% - 12px)',
          }}
        />

        {/* Monthly */}
        <button
          onClick={() => setBilling('monthly')}
          className={`relative z-10 w-32 py-2 text-sm font-semibold rounded-lg transition
            ${
              billing === 'monthly'
                ? 'text-black'
                : isDark
                  ? 'text-white/60 hover:text-white'
                  : 'text-neutral-600 hover:text-black'
            }
          `}
        >
          Monthly billing
        </button>

        {/* Annual */}
        <button
          onClick={() => setBilling('annual')}
          className={`relative z-10 w-32 py-2 text-sm font-semibold rounded-lg transition
            ${
              billing === 'annual'
                ? 'text-black'
                : isDark
                  ? 'text-white/60 hover:text-white'
                  : 'text-neutral-600 hover:text-black'
            }
          `}
        >
          Annual billing
        </button>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
        {PRICING_PLANS.map((plan, index) => (
          <PricingCard key={index} plan={plan} billing={billing} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

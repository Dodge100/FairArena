import BenefitCard from "@/components/BenefitCard";
import { useTheme } from "@/hooks/useTheme";
import {
  Lightbulb,
  Users,
  LayoutDashboard,
  BarChart3,
  LineChart,
  CheckCircle2,
} from "lucide-react";

import { useEffect, useState } from "react";

function HowItWorks() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === "dark");
  }, [theme]);

  const benefits = [
    {
      id: 1,
      title: "AI-Powered Website Analysis",
      desc: "Get automated insights into each project: performance, UI/UX quality, SEO score, accessibility, code uniqueness, and improvement suggestions.",
      icon: Lightbulb,
    },
    {
      id: 2,
      title: "Fair & Transparent Scoring",
      desc: "Judges score entries with predefined rubrics. All scores are logged, secure, and visible to organisers.",
      icon: Users,
    },
    {
      id: 3,
      title: "One Dashboard for Entire Hackathon",
      desc: "Manage submissions, scores, judges, participants, prizes, winners, categories, and rounds all from one clean dashboard.",
      icon: LayoutDashboard,
    },
    {
      id: 4,
      title: "Real-Time Leaderboards",
      desc: "Participants can track their ranking live. Organisers can highlight top performers instantly.",
      icon: BarChart3,
    },
    {
      id: 5,
      title: "Automated Reports & Analytics",
      desc: "Get detailed performance insights, scoring patterns, judge analytics, and final score breakdown.",
      icon: LineChart,
    },
    {
      id: 6,
      title: "Zero Confusion, Zero Errors",
      desc: "No more spreadsheets. No more manual calculations. FairArena automates everything.",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="w-full h-auto mb-40 flex flex-col items-center justify-center">
      <h1 className="text-center mt-40 text-neutral-400 text-sm sm:text-base md:text-lg gap-2 flex flex-col px-4 md:px-0 max-w-[90%] sm:max-w-[80%] md:max-w-[60%] lg:max-w-[50%] xl:max-w-[60%] mx-auto">
        <span className="text-4xl sm:text-5xl text-[#ddef00] [-webkit-text-stroke:_0.7px_black] font-bold">
          Why Choose Us
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
            icon={item.icon}
            title={item.title}
            desc={item.desc}
          />
        ))}
      </div>
    </div>
  );
}

export default HowItWorks;

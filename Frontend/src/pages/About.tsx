import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import { Rocket, Target, Star, Zap, Handshake, Brain, Heart, ArrowRight } from "lucide-react";

function About() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === "dark");
  }, [theme]);

  return (
    <div
      className={`
      w-full min-h-screen flex flex-col items-center pt-20 pb-20 px-6
      ${isDark ? "bg-[#0b0b0b] text-neutral-300" : "bg-white text-neutral-800"}
    `}
    >
      {/* Heading */}
      <h1
        className={`
        text-center mt-20 text-neutral-400 text-sm sm:text-base md:text-lg gap-2
        flex flex-col px-4 md:px-0 max-w-[90%] sm:max-w-[80%] md:max-w-[60%]
        lg:max-w-[50%] xl:max-w-[60%] mx-auto
      `}
      >
        <span className="text-4xl sm:text-5xl text-[#ddef00] [-webkit-text-stroke:_1px_black] font-bold">
          About FairArena
        </span>
      </h1>

      {/* Main Content */}
      <div className="max-w-4xl w-full mt-10 space-y-10 leading-relaxed text-lg">

        {/* INTRO */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6" />
            Empowering Hackathons With Transparency, Speed, and AI
          </h2>
          <p>
            FairArena was created with a simple mission:
            <br />
            <span className="font-semibold">to make hackathons fair, data-driven, and effortless for everyone.</span>
          </p>
          <p className="mt-4">
            No more Excel sheets. No more confused judges. No more participants waiting hours for results.
            <br />
            We built a platform where organisers, judges, and participants experience hackathons the way
            they’re meant to be — <strong>fast, transparent, and exciting.</strong>
          </p>
        </section>

        {/* WHO WE ARE */}

        {/* MISSION */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Target className="w-6 h-6" />
            Our Mission
          </h2>
          <p>
            To bring fairness, accuracy, and automation to every hackathon in the world.
          </p>
          <p className="mt-3">
            We believe every team deserves unbiased scoring, every judge deserves a simple workflow, and
            every organiser deserves a stress-free dashboard.
          </p>
        </section>

        {/* VISION */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Star className="w-6 h-6" />
            Our Vision
          </h2>
          <p>
            To become the world’s most trusted hackathon platform — combining AI, transparency,
            and technology to create unforgettable innovation events.
          </p>

          <p className="mt-3">We imagine a future where:</p>
          <ul className="list-disc ml-6 mt-2 space-y-2">
            <li>Every hackathon is AI-assisted</li>
            <li>Participants see real-time rankings</li>
            <li>Organisers run events effortlessly</li>
            <li>Judges get better insights</li>
            <li>Every decision is backed by data</li>
          </ul>
        </section>

        {/* WHY DIFFERENT */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6" />
            What Makes FairArena Different?
          </h2>

          <ol className="list-decimal ml-6 space-y-4">
            <li>
              <strong>All-in-One Hackathon Operating System</strong>
              <br />
              Manage, score, analyse, and finalise winners — all in one dashboard.
            </li>

            <li>
              <strong>AI-Powered Project Analysis</strong>
              <br />
              Performance, SEO, UI/UX, accessibility, bugs, uniqueness — analysed instantly.
            </li>

            <li>
              <strong>Transparent Real-Time Leaderboards</strong>
              <br />
              Participants always know where they stand.
            </li>

            <li>
              <strong>Zero Manual Error Workflow</strong>
              <br />
              No mismatched scores. No spreadsheet chaos.
            </li>

            <li>
              <strong>Built for Organisers — Free for Judges & Participants</strong>
            </li>
          </ol>
        </section>

        {/* WHO USES */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Handshake className="w-6 h-6" />
            Who Uses FairArena?
          </h2>
          <p>FairArena is trusted by:</p>

          <ul className="list-disc ml-6 mt-2 space-y-2">
            <li>Colleges & universities</li>
            <li>Tech communities</li>
            <li>Startups & companies</li>
            <li>Hackathon organisers</li>
            <li>Developer groups</li>
            <li>Innovation events</li>
          </ul>

          <p className="mt-4">
            Whether it’s 50 students or 5000 developers — FairArena scales instantly.
          </p>
        </section>

        {/* TECHNOLOGY */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Our Technology
          </h2>

          <p>FairArena blends:</p>
          <ul className="list-disc ml-6 mt-2 space-y-2">
            <li>Real-time scoring</li>
            <li>Automated leaderboard calculations</li>
            <li>AI website analysis</li>
            <li>Multi-round judge panels</li>
            <li>High-speed cloud infrastructure</li>
            <li>Secure data systems</li>
          </ul>

          <p className="mt-4">
            Our AI models analyse projects for:
          </p>

          <ul className="list-disc ml-6 mt-2 space-y-2">
            <li>Performance</li>
            <li>SEO</li>
            <li>UI/UX</li>
            <li>Accessibility</li>
            <li>Uniqueness</li>
            <li>Potential bugs</li>
            <li>Improvement suggestions</li>
          </ul>
        </section>

        {/* PASSION */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Heart className="w-6 h-6" />
            Built With Passion for Innovation
          </h2>

          <p>
            FairArena exists because we love hackathons.
            We've participated in them, organised them, and judged them.
            We know what makes a great event — and what ruins one.
          </p>

          <p className="mt-4">
            <strong>Our promise:</strong>
            Fair decisions. Clear scoring. No confusion. Pure innovation.
          </p>
        </section>

        {/* CTA */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6" />
            Join Us in Reimagining Hackathons
          </h2>

          <p>
            FairArena is more than a tool — it’s a movement to make innovation
            accessible, transparent, and thrilling.
          </p>

          <ul className="list-none ml-0 mt-3 space-y-2">
            <li className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-[#ddef00]" />
              Host your next hackathon with FairArena
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-[#ddef00]" />
              Schedule a Demo
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-[#ddef00]" />
              Contact Us:{" "}
              <span className="text-[#ddef00]">fairarena.contact@gmail.com</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default About;

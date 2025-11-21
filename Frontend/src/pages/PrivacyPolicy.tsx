import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";

/* ---------------------------------------------
   Reusable Component: PolicySection
---------------------------------------------- */
export function PolicySection({
  title,
  children,
  isDark,
}: {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div className="mb-10">
      <h2
        className={`
          text-2xl font-semibold mb-4
          ${isDark ? "text-[#ddef00]" : "text-[#a5bf00]"}
        `}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

/* ---------------------------------------------
   Reusable Component: PolicyList
---------------------------------------------- */
export function PolicyList({
  items,
  isDark,
}: {
  items: string[];
  isDark: boolean;
}) {
  return (
    <ul
      className={`
        list-disc ml-6 mb-6
        ${isDark ? "text-neutral-300" : "text-neutral-700"}
      `}
    >
      {items.map((item, index) => (
        <li key={index} className="mb-1">
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------
   MAIN PAGE: Privacy Policy
---------------------------------------------- */
function PrivacyPolicy() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(theme === "dark");
  }, [theme]);

  return (
    <div
      className={`
        w-full min-h-screen mt-15 py-20 px-6 flex justify-center
        ${isDark ? " text-neutral-200" : " text-neutral-800"}
      `}
    >
      <div className="max-w-4xl w-full leading-relaxed">

        {/* Heading */}
        <h1
          className={`
            text-4xl sm:text-5xl font-bold text-center mb-10
            text-[#ddef00] [-webkit-text-stroke:_1px_black]
          `}
        >
          FairArena — Privacy Policy
        </h1>

        {/* Last Updated */}
        <p
          className={`
            text-center mb-12 text-sm
            ${isDark ? "text-neutral-400" : "text-neutral-600"}
          `}
        >
          Last Updated: November 2025
        </p>

        <p className="mb-10">
          FairArena (“we”, “our”, “us”) provides an AI-powered hackathon management
          platform used by organisers, judges, and participants. This Privacy Policy
          explains how we collect, use, and protect your data.
        </p>

        {/* --------------------------------------------- */}
        {/* SECTION 1 */}
        {/* --------------------------------------------- */}
        <PolicySection title="1. Information We Collect" isDark={isDark}>
          <h3 className="text-xl font-semibold mb-2">1.1 Information provided by organisers</h3>
          <PolicyList
            isDark={isDark}
            items={[
              "Name and email",
              "Organisation details",
              "Payment information (processed securely via third-party gateways)",
              "Hackathon details (rounds, categories, rubrics)",
            ]}
          />

          <h3 className="text-xl font-semibold mb-2">1.2 Information provided by participants</h3>
          <PolicyList
            isDark={isDark}
            items={[
              "Name, email, or profile details",
              "Submitted project link / website URL",
              "Team information",
            ]}
          />

          <h3 className="text-xl font-semibold mb-2">1.3 Information provided by judges</h3>
          <PolicyList
            isDark={isDark}
            items={[
              "Name, email",
              "Score inputs",
              "Comments/feedback on submissions",
            ]}
          />

          <h3 className="text-xl font-semibold mb-2">1.4 Automatically collected information</h3>
          <PolicyList
            isDark={isDark}
            items={[
              "Browser type, device, IP address",
              "Usage logs and actions on the dashboard",
              "AI website analysis data (SEO, performance, accessibility, etc.)",
            ]}
          />

          <p className="mb-4">
            We do not store sensitive personal information such as passwords in plain text.
          </p>
        </PolicySection>

        {/* --------------------------------------------- */}
        {/* SECTION 2 */}
        {/* --------------------------------------------- */}
        <PolicySection title="2. How We Use Your Data" isDark={isDark}>
          <PolicyList
            isDark={isDark}
            items={[
              "Manage and host hackathons",
              "Allow judges to score submissions",
              "Display real-time leaderboards",
              "Run AI-based website analysis",
              "Generate insights, reports, and analytics",
              "Provide customer support",
              "Improve platform performance and security",
            ]}
          />
          <p>We never sell your data to third parties.</p>
        </PolicySection>

        {/* --------------------------------------------- */}
        {/* SECTION 3 */}
        {/* --------------------------------------------- */}
        <PolicySection title="3. How We Share Your Data" isDark={isDark}>
          <PolicyList
            isDark={isDark}
            items={[
              "Payment gateways for billing",
              "AI analysis engines used to evaluate project URLs",
              "Cloud hosting providers (for secure storage)",
            ]}
          />
          <p>We do not share data with advertisers.</p>
        </PolicySection>

        {/* --------------------------------------------- */}
        {/* SECTION 4 */}
        {/* --------------------------------------------- */}
        <PolicySection title="4. Data Security" isDark={isDark}>
          <PolicyList
            isDark={isDark}
            items={[
              "Encrypted data transmission",
              "Secured databases",
              "Access-controlled dashboards",
              "Regular audits",
            ]}
          />
          <p>
            However, no system is 100% secure. Users are responsible for keeping their login
            credentials protected.
          </p>
        </PolicySection>

        {/* --------------------------------------------- */}
        {/* SECTION 5 */}
        {/* --------------------------------------------- */}
        <PolicySection title="5. Your Rights" isDark={isDark}>
          <PolicyList
            isDark={isDark}
            items={[
              "Access to your stored data",
              "Correction of inaccurate information",
              "Deletion of your data (except required for legal reasons)",
            ]}
          />
          <p>
            Contact us at{" "}
            <span className="text-[#879400]">fairarena.contact@gmail.com</span>.
          </p>
        </PolicySection>

        {/* --------------------------------------------- */}
        {/* SECTION 6 */}
        {/* --------------------------------------------- */}
        <PolicySection title="6. Children’s Privacy" isDark={isDark}>
          <p>FairArena is not intended for users under 13 years old.</p>
        </PolicySection>

        {/* --------------------------------------------- */}
        {/* SECTION 7 */}
        {/* --------------------------------------------- */}
        <PolicySection title="7. Changes to This Policy" isDark={isDark}>
          <p>
            We may update this Privacy Policy occasionally. Continued use of FairArena means you
            accept the updated terms.
          </p>
        </PolicySection>

        {/* --------------------------------------------- */}
        {/* SECTION 8 */}
        {/* --------------------------------------------- */}
        <PolicySection title="8. Contact Us" isDark={isDark}>
          <p>
            For questions or concerns, email:{" "}
            <span className="text-[#879400]">fairarena.contact@gmail.com</span>
          </p>
        </PolicySection>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

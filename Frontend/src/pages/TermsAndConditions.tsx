import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";

/* ----------------------------------------------------
   REUSABLE COMPONENT: TermsSection
----------------------------------------------------- */
function TermsSection({
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

/* ----------------------------------------------------
   REUSABLE COMPONENT: TermsList
----------------------------------------------------- */
function TermsList({
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
      {items.map((item, i) => (
        <li key={i} className="mb-1">
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------
   DATA ARRAYS
----------------------------------------------------- */

const definitionsList = [
  "“Organiser” — the entity that creates a hackathon and pays for the plan.",
  "“Judge” — a person invited to evaluate submissions.",
  "“Participant” — a user submitting projects.",
  "“Service” — the FairArena platform and its features.",
];

const useOfServiceList = [
  "Organisers must create an account to host a hackathon.",
  "Judges and participants can join for free through organiser invitations.",
  "Organisers are responsible for verifying the legitimacy of participants and judges.",
  "You must not misuse the platform (e.g., hacking, scraping, sending spam).",
];

const paymentsList = [
  "Organisers must purchase a plan to host a hackathon.",
  "Payments are processed via secure third-party payment gateways.",
  "Prices may change with prior notice.",
];

const aiAnalysisText =
  "FairArena provides AI-generated insights, including performance, SEO, accessibility, and uniqueness checks. These results are advisory only, and organisers retain full control over final scoring decisions.";

const intellectualPropertyList = [
  "FairArena owns all platform designs, algorithms, and software.",
  "Users retain ownership of their submissions.",
  "By submitting a project link, you grant FairArena permission to analyse it.",
];

const liabilityList = [
  "Errors caused by third-party tools",
  "Network outages",
  "Incorrect submissions or scoring mistakes made by organisers or judges",
  "Any financial, reputational, or data loss",
];

const suspensionList = [
  "Violate these Terms",
  "Abuse the platform",
  "Attempt security breaches",
  "Provide fraudulent payment information",
];

/* ----------------------------------------------------
   MAIN PAGE: TERMS & CONDITIONS
----------------------------------------------------- */

function TermsAndConditions() {
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

        {/* HEADER */}
        <h1
          className={`
            text-4xl sm:text-5xl font-bold text-center mb-10
            text-[#ddef00] [-webkit-text-stroke:_1px_black]
          `}
        >
          FairArena — Terms & Conditions
        </h1>

        <p
          className={`
            text-center mb-12 text-sm
            ${isDark ? "text-neutral-400" : "text-neutral-600"}
          `}
        >
          Last Updated: November 2025
        </p>

        <p className="mb-10">
          These Terms & Conditions govern your use of FairArena.  
          By using our platform, you agree to these terms.
        </p>

        {/* ------------ SECTION 1 ------------ */}
        <TermsSection title="1. Definitions" isDark={isDark}>
          <TermsList items={definitionsList} isDark={isDark} />
        </TermsSection>

        {/* ------------ SECTION 2 ------------ */}
        <TermsSection title="2. Use of Service" isDark={isDark}>
          <TermsList items={useOfServiceList} isDark={isDark} />
        </TermsSection>

        {/* ------------ SECTION 3 ------------ */}
        <TermsSection title="3. Payments & Billing" isDark={isDark}>
          <TermsList items={paymentsList} isDark={isDark} />
        </TermsSection>

        {/* ------------ SECTION 4 ------------ */}
        <TermsSection title="4. AI Analysis" isDark={isDark}>
          <p className="mb-6">{aiAnalysisText}</p>
        </TermsSection>

        {/* ------------ SECTION 5 ------------ */}
        <TermsSection title="5. Intellectual Property" isDark={isDark}>
          <TermsList items={intellectualPropertyList} isDark={isDark} />
        </TermsSection>

        {/* ------------ SECTION 6 ------------ */}
        <TermsSection title="6. Limitation of Liability" isDark={isDark}>
          <p className="mb-4">FairArena is not responsible for:</p>

          <TermsList items={liabilityList} isDark={isDark} />

          <p className="mt-4">Your use of the platform is at your own risk.</p>
        </TermsSection>

        {/* ------------ SECTION 7 ------------ */}
        <TermsSection title="7. Account Suspension" isDark={isDark}>
          <p className="mb-4">We may suspend accounts that:</p>
          <TermsList items={suspensionList} isDark={isDark} />
        </TermsSection>

        {/* ------------ SECTION 8 ------------ */}
        <TermsSection title="8. Termination" isDark={isDark}>
          <p>
            Organisers may stop using FairArena anytime.  
            Data from completed hackathons may be retained for compliance and analytics.
          </p>
        </TermsSection>

        {/* ------------ SECTION 9 ------------ */}
        <TermsSection title="9. Governing Law" isDark={isDark}>
          <p>These Terms are governed by the laws of India.</p>
        </TermsSection>

        {/* ------------ SECTION 10 ------------ */}
        <TermsSection title="10. Contact" isDark={isDark}>
          <p>
            For questions, contact us at:{" "}
            <span className="text-[#909d00]">fairarena.contact@gmail.com</span>
          </p>
        </TermsSection>

      </div>
    </div>
  );
}

export default TermsAndConditions;

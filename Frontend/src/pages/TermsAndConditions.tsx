import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';

/* ----------------------------------------------------
   DATA ARRAYS
----------------------------------------------------- */

const definitionsList = [
  '“Organiser” — the entity that creates a hackathon and pays for the plan.',
  '“Judge” — a person invited to evaluate submissions.',
  '“Participant” — a user submitting projects.',
  '“Service” — the FairArena platform and its features.',
];

const useOfServiceList = [
  'Organisers must create an account to host a hackathon.',
  'Judges and participants can join for free through organiser invitations.',
  'Organisers are responsible for verifying the legitimacy of participants and judges.',
  'You must not misuse the platform (e.g., hacking, scraping, sending spam).',
];

const paymentsList = [
  'Organisers must purchase a plan to host a hackathon.',
  'Payments are processed via secure third-party payment gateways.',
  'Prices may change with prior notice.',
];

const aiAnalysisText =
  'FairArena provides AI-generated insights, including performance, SEO, accessibility, and uniqueness checks. These results are advisory only, and organisers retain full control over final scoring decisions.';

const intellectualPropertyList = [
  'FairArena owns all platform designs, algorithms, and software.',
  'Users retain ownership of their submissions.',
  'By submitting a project link, you grant FairArena permission to analyse it.',
];

const liabilityList = [
  'Errors caused by third-party tools',
  'Network outages',
  'Incorrect submissions or scoring mistakes made by organisers or judges',
  'Any financial, reputational, or data loss',
];

const suspensionList = [
  'Violate these Terms',
  'Abuse the platform',
  'Attempt security breaches',
  'Provide fraudulent payment information',
];

/* ----------------------------------------------------
   MAIN PAGE: TERMS & CONDITIONS
----------------------------------------------------- */

function TermsAndConditions() {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        w-full min-h-screen mt-15 py-20 px-6 flex justify-center
        ${isDark ? ' text-neutral-200' : ' text-neutral-800'}
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
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
        >
          Last Updated: November 2025
        </p>

        <p className="mb-10">
          These Terms & Conditions govern your use of FairArena. By using our platform, you agree to
          these terms.
        </p>

        {/* ------------ SECTION 1 ------------ */}
        <LegalSection title="1. Definitions" isDark={isDark}>
          <LegalList items={definitionsList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 2 ------------ */}
        <LegalSection title="2. Use of Service" isDark={isDark}>
          <LegalList items={useOfServiceList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 3 ------------ */}
        <LegalSection title="3. Payments & Billing" isDark={isDark}>
          <LegalList items={paymentsList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 4 ------------ */}
        <LegalSection title="4. AI Analysis" isDark={isDark}>
          <p className="mb-6">{aiAnalysisText}</p>
        </LegalSection>

        {/* ------------ SECTION 5 ------------ */}
        <LegalSection title="5. Intellectual Property" isDark={isDark}>
          <LegalList items={intellectualPropertyList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 6 ------------ */}
        <LegalSection title="6. Limitation of Liability" isDark={isDark}>
          <p className="mb-4">FairArena is not responsible for:</p>

          <LegalList items={liabilityList} isDark={isDark} />

          <p className="mt-4">Your use of the platform is at your own risk.</p>
        </LegalSection>

        {/* ------------ SECTION 7 ------------ */}
        <LegalSection title="7. Account Suspension" isDark={isDark}>
          <p className="mb-4">We may suspend accounts that:</p>
          <LegalList items={suspensionList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 8 ------------ */}
        <LegalSection title="8. Termination" isDark={isDark}>
          <p>
            Organisers may stop using FairArena anytime. Data from completed hackathons may be
            retained for compliance and analytics.
          </p>
        </LegalSection>

        {/* ------------ SECTION 9 ------------ */}
        <LegalSection title="9. Governing Law" isDark={isDark}>
          <p>These Terms are governed by the laws of India.</p>
        </LegalSection>

        {/* ------------ SECTION 10 ------------ */}
        <LegalSection title="10. Contact" isDark={isDark}>
          <p>
            For questions, contact us at:{' '}
            <span className="text-[#909d00]">fairarena.contact@gmail.com</span>
          </p>
        </LegalSection>
      </div>
    </div>
  );
}

export default TermsAndConditions;

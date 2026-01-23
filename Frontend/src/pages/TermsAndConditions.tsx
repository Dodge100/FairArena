import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';

/* ----------------------------------------------------
   DATA ARRAYS
----------------------------------------------------- */

const definitionsList = [
  '“Company”, “We”, “Us”, or “Our” refers to FairArena, the provider of the Service.',
  '“Service” refers to the FairArena hackathon management platform, website, and related services managed by the Company.',
  '“User”, “You”, or “Your” refers to the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.',
  '“Account” means a unique account created for You to access our Service or parts of our Service.',
  '“Organiser” refers to a User who creates and manages hackathons via the Service.',
  '“Participant” refers to a User who registers for and submits projects to hackathons.',
  '“Judge” refers to a User invited to evaluate submissions.',
  '“Content” refers to content such as text, images, or other information that can be posted, uploaded, linked to or otherwise made available by You, regardless of the form of that content.',
];

const accountTermsList = [
  'You must provide accurate, complete, and current information at all times. Failure to do so constitutes a breach of the Terms.',
  'You are responsible for safeguarding the password that You use to access the Service and for any activities or actions under Your password.',
  'You agree not to disclose Your password to any third party. You must notify Us immediately upon becoming aware of any breach of security or unauthorized use of Your Account.',
  'We reserve the right to refuse service, terminate accounts, remove or edit content, or cancel orders in our sole discretion.',
];

const useOfServiceList = [
  'You agree not to use the Service for any unlawful purpose or in any way that interrupts, damages, impairs, or renders the Service less efficient.',
  'You must not attempt to gain unauthorized access to our Service, the server on which our Service is stored or any server, computer or database connected to our Service.',
  'You must not use the Service to transmit any unsolicited or unauthorized advertising, promotional materials, or spam.',
  'Organisers are solely responsible for the administration of their hackathons, including the verification of Participants and Judges.',
];

const intellectualPropertyList = [
  'The Service and its original content (excluding Content provided by You or other Users), features and functionality are and will remain the exclusive property of the Company and its licensors.',
  'The Service is protected by copyright, trademark, and other laws of both the Country and foreign countries.',
  'Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of the Company.',
  'By submitting Content (including project submissions), You grant Us a right to use, modify, perform, display, reproduce, and distribute such Content on and through the Service for the purpose of operating and improving the Service.',
];

const aiDisclaimerList = [
  'FairArena utilizes Artificial Intelligence (AI) technologies to provide insights, analysis, and scoring assistance.',
  'AI-generated results are advisory in nature and may not be 100% accurate or free from bias.',
  'Organisers and Judges retain full discretion and responsibility for final decision-making and scoring.',
  'We do not guarantee the accuracy, completeness, or usefulness of any AI-generated analysis.',
];

const liabilityList = [
  'To the maximum extent permitted by applicable law, in no event shall the Company be liable for any special, incidental, indirect, or consequential damages whatsoever (including, but not limited to, damages for loss of profits, loss of data or other information, for business interruption, for personal injury, loss of privacy arising out of or in any way related to the use of or inability to use the Service).',
  'Our total liability to You for any claims arising out of or relating to these Terms or Your use of the Service is limited to the amount You paid us to use the Service in the 12 months prior to the act that gave rise to the liability.',
];

const terminationList = [
  'We may terminate or suspend Your Account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms.',
  'Upon termination, Your right to use the Service will cease immediately.',
  'If You wish to terminate Your Account, You may simply discontinue using the Service or delete your account through the settings.',
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
          Terms and Conditions
        </h1>

        <p
          className={`
            text-center mb-12 text-sm
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
        >
          Last Updated: January 23, 2026
        </p>

        <p className="mb-10">
          Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully before using the FairArena website and service (the "Service") operated by FairArena ("us", "we", or "our").
          <br /><br />
          Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.
          <br /><br />
          By accessing or using the Service you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
        </p>

        {/* ------------ SECTION 1 ------------ */}
        <LegalSection title="1. Interpretation and Definitions" isDark={isDark}>
          <p className="mb-4">
            The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
          </p>
          <LegalList items={definitionsList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 2 ------------ */}
        <LegalSection title="2. Accounts and Registration" isDark={isDark}>
          <p className="mb-4">
            When You create an account with Us, You must provide us information that is accurate, complete, and current at all times.
          </p>
          <LegalList items={accountTermsList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 3 ------------ */}
        <LegalSection title="3. Use of Service and Restrictions" isDark={isDark}>
          <LegalList items={useOfServiceList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 4 ------------ */}
        <LegalSection title="4. Intellectual Property Rights" isDark={isDark}>
          <LegalList items={intellectualPropertyList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 5 ------------ */}
        <LegalSection title="5. AI Analysis and Disclaimers" isDark={isDark}>
          <LegalList items={aiDisclaimerList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 6 ------------ */}
        <LegalSection title="6. Links to Other Websites" isDark={isDark}>
          <p>
            Our Service may contain links to third-party web sites or services that are not owned or controlled by the Company.
            <br /><br />
            The Company has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party web sites or services. You further acknowledge and agree that the Company shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such content, goods or services available on or through any such web sites or services.
          </p>
        </LegalSection>

        {/* ------------ SECTION 7 ------------ */}
        <LegalSection title="7. Termination" isDark={isDark}>
          <LegalList items={terminationList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 8 ------------ */}
        <LegalSection title="8. Limitation of Liability" isDark={isDark}>
          <LegalList items={liabilityList} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 9 ------------ */}
        <LegalSection title="9. Disclaimer" isDark={isDark}>
          <p>
            The Service is provided to You "AS IS" and "AS AVAILABLE" and with all faults and defects without warranty of any kind. To the maximum extent permitted under applicable law, the Company expressly disclaims all warranties, whether express, implied, statutory or otherwise, with respect to the Service, including all implied warranties of merchantability, fitness for a particular purpose, title and non-infringement.
            <br /><br />
            Without limiting the foregoing, neither the Company nor any of the company's provider makes any representation or warranty of any kind, express or implied: (i) as to the operation or availability of the Service, or the information, content, and materials or products included thereon; (ii) that the Service will be uninterrupted or error-free; (iii) as to the accuracy, reliability, or currency of any information or content provided through the Service.
          </p>
        </LegalSection>

        {/* ------------ SECTION 10 ------------ */}
        <LegalSection title="10. Governing Law" isDark={isDark}>
          <p>
            The laws of India, excluding its conflicts of law rules, shall govern this Terms and Your use of the Service. Your use of the Application may also be subject to other local, state, national, or international laws.
          </p>
        </LegalSection>

        {/* ------------ SECTION 11 ------------ */}
        <LegalSection title="11. Disputes Resolution" isDark={isDark}>
          <p>
            If You have any concern or dispute about the Service, You agree to first try to resolve the dispute informally by contacting the Company.
          </p>
        </LegalSection>

        {/* ------------ SECTION 12 ------------ */}
        <LegalSection title="12. Changes to These Terms" isDark={isDark}>
          <p>
            We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. If a revision is material We will make reasonable efforts to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at Our sole discretion.
            <br /><br />
            By continuing to access or use Our Service after those revisions become effective, You agree to be bound by the revised terms. If You do not agree to the new terms, in whole or in part, please stop using the website and the Service.
          </p>
        </LegalSection>

        {/* ------------ SECTION 13 ------------ */}
        <LegalSection title="13. Contact Us" isDark={isDark}>
          <p>
            If you have any questions about these Terms, You can contact us:
            <br />
            By email: <span className="text-[#909d00]">fairarena.contact@gmail.com</span>
          </p>
        </LegalSection>
      </div>
    </div>
  );
}

export default TermsAndConditions;

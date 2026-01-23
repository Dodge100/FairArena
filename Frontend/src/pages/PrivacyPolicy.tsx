import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';

/* ---------------------------------------------
   MAIN PAGE: Privacy Policy
---------------------------------------------- */
function PrivacyPolicy() {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        w-full min-h-screen mt-15 py-20 px-6 flex justify-center
        ${isDark ? ' text-neutral-200' : ' text-neutral-800'}
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
          Privacy Policy
        </h1>

        {/* Last Updated */}
        <p
          className={`
            text-center mb-12 text-sm
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
        >
          Last Updated: January 23, 2026
        </p>

        <p className="mb-10">
          FairArena ("us", "we", or "our") operates the FairArena website (the "Service").
          This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
          <br /><br />
          We use your data to provide and improve the Service. By using the Service, you agree to the collection and use of information in accordance with this policy.
        </p>

        {/* --------------------------------------------- */}
        {/* SECTION 1 */}
        {/* --------------------------------------------- */}
        <LegalSection title="1. Information We Collect" isDark={isDark}>
          <p className="mb-4">We collect several different types of information for various purposes to provide and improve our Service to you.</p>

          <h3 className="text-xl font-semibold mb-2">1.1 Personal Data</h3>
          <p className="mb-2">While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you ("Personal Data"). Personally identifiable information may include, but is not limited to:</p>
          <LegalList
            isDark={isDark}
            items={[
              'Email address',
              'First name and last name',
              'Phone number',
              'Address, State, Province, ZIP/Postal code, City',
              'Cookies and Usage Data',
              'Social Media Profile information (if you log in via 3rd party services like Google or GitHub)',
            ]}
          />

          <h3 className="text-xl font-semibold mb-2 mt-6">1.2 Usage Data</h3>
          <p className="mb-2">We may also collect information how the Service is accessed and used ("Usage Data"). This Usage Data may include information such as:</p>
          <LegalList
            isDark={isDark}
            items={[
              'Your computer\'s Internet Protocol address (e.g. IP address)',
              'Browser type and browser version',
              'The pages of our Service that you visit',
              'The time and date of your visit',
              'The time spent on those pages',
              'Unique device identifiers and other diagnostic data',
            ]}
          />

          <h3 className="text-xl font-semibold mb-2 mt-6">1.3 Tracking & Cookies Data</h3>
          <p className="mb-2">We use cookies and similar tracking technologies to track the activity on our Service and hold certain information.</p>
          <LegalList
            isDark={isDark}
            items={[
              'Session Cookies: We use Session Cookies to operate our Service.',
              'Preference Cookies: We use Preference Cookies to remember your preferences and various settings.',
              'Security Cookies: We use Security Cookies for security purposes.'
            ]}
          />
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 2 */}
        {/* --------------------------------------------- */}
        <LegalSection title="2. How We Use Your Data" isDark={isDark}>
          <p className="mb-4">FairArena uses the collected data for various purposes:</p>
          <LegalList
            isDark={isDark}
            items={[
              'To provide and maintain the Service',
              'To notify you about changes to our Service',
              'To allow you to participate in interactive features of our Service when you choose to do so',
              'To provide customer care and support',
              'To provide analysis or valuable information so that we can improve the Service',
              'To monitor the usage of the Service',
              'To detect, prevent and address technical issues',
              'To process payments and manage billing (via secure third-party processors)',
            ]}
          />
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 3 */}
        {/* --------------------------------------------- */}
        <LegalSection title="3. Retention of Data" isDark={isDark}>
          <p>
            FairArena will retain your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your Personal Data to the extent necessary to comply with our legal obligations (for example, if we are required to retain your data to comply with applicable laws), resolve disputes, and enforce our legal agreements and policies.
            <br /><br />
            FairArena will also retain Usage Data for internal analysis purposes. Usage Data is generally retained for a shorter period of time, except when this data is used to strengthen the security or to improve the functionality of our Service, or we are legally obligated to retain this data for longer time periods.
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 4 */}
        {/* --------------------------------------------- */}
        <LegalSection title="4. Transfer of Data" isDark={isDark}>
          <p>
            Your information, including Personal Data, may be transferred to — and maintained on — computers located outside of your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from your jurisdiction.
            <br /><br />
            If you are located outside India and choose to provide information to us, please note that we transfer the data, including Personal Data, to India and process it there.
            <br /><br />
            Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 5 */}
        {/* --------------------------------------------- */}
        <LegalSection title="5. Disclosure of Data" isDark={isDark}>
          <h3 className="text-xl font-semibold mb-2">5.1 Legal Requirements</h3>
          <p className="mb-2">FairArena may disclose your Personal Data in the good faith belief that such action is necessary to:</p>
          <LegalList
            isDark={isDark}
            items={[
              'To comply with a legal obligation',
              'To protect and defend the rights or property of FairArena',
              'To prevent or investigate possible wrongdoing in connection with the Service',
              'To protect the personal safety of users of the Service or the public',
              'To protect against legal liability',
            ]}
          />
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 6 */}
        {/* --------------------------------------------- */}
        <LegalSection title="6. Security of Data" isDark={isDark}>
          <p>
            The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 7 */}
        {/* --------------------------------------------- */}
        <LegalSection title="7. Service Providers" isDark={isDark}>
          <p className="mb-4">
            We may employ third party companies and individuals to facilitate our Service ("Service Providers"), to provide the Service on our behalf, to perform Service-related services or to assist us in analyzing how our Service is used.
            <br />
            These third parties have access to your Personal Data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 8 */}
        {/* --------------------------------------------- */}
        <LegalSection title="8. Links to Other Sites" isDark={isDark}>
          <p>
            Our Service may contain links to other sites that are not operated by us. If you click on a third party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit.
            <br /><br />
            We have no control over and assume no responsibility for the content, privacy policies or practices of any third party sites or services.
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 9 */}
        {/* --------------------------------------------- */}
        <LegalSection title="9. Children's Privacy" isDark={isDark}>
          <p>
            Our Service does not address anyone under the age of 13 ("Children").
            <br /><br />
            We do not knowingly collect personally identifiable information from anyone under the age of 13. If you are a parent or guardian and you are aware that your Children has provided us with Personal Data, please contact us. If we become aware that we have collected Personal Data from children without verification of parental consent, we take steps to remove that information from our servers.
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 10 */}
        {/* --------------------------------------------- */}
        <LegalSection title="10. Changes to This Privacy Policy" isDark={isDark}>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
            <br /><br />
            We will let you know via email and/or a prominent notice on our Service, prior to the change becoming effective and update the "effective date" at the top of this Privacy Policy.
            <br /><br />
            You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 11 */}
        {/* --------------------------------------------- */}
        <LegalSection title="11. Contact Us" isDark={isDark}>
          <p>
            If you have any questions about this Privacy Policy, please contact us:
            <br />
            By email: <span className="text-[#879400]">fairarena.contact@gmail.com</span>
          </p>
        </LegalSection>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

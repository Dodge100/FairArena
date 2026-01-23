import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';

/* ---------------------------------------------
   MAIN PAGE: Cookie Policy
---------------------------------------------- */
function CookiePolicy() {
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
            text-[#ddef00] [-webkit-text-stroke:1px_black]
          `}
                >
                    Cookie Policy
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
                    This Cookie Policy explains what Cookies are and how We use them. You should read this policy so You can understand what type of cookies We use, or the information We collect using Cookies and how that information is used. This Cookie Policy has been created with the help of the Cookies Policy Generator.
                    <br /><br />
                    Cookies do not typically contain any information that personally identifies a user, but personal information that we store about You may be linked to the information stored in and obtained from Cookies. For further information on how We use, store and keep your personal data secure, see our Privacy Policy.
                </p>

                {/* --------------------------------------------- */}
                {/* SECTION 1 */}
                {/* --------------------------------------------- */}
                <LegalSection title="1. Interpretation and Definitions" isDark={isDark}>
                    <h3 className="text-xl font-semibold mb-2">1.1 Interpretation</h3>
                    <p className="mb-4">
                        The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
                    </p>
                    <h3 className="text-xl font-semibold mb-2">1.2 Definitions</h3>
                    <LegalList
                        isDark={isDark}
                        items={[
                            '“Company” (referred to as either "the Company", "We", "Us" or "Our" in this Cookies Policy) refers to FairArena.',
                            '“Cookies” means small files that are placed on Your computer, mobile device or any other device by a website, containing details of Your browsing history on that website among its many uses.',
                            '“Website” refers to FairArena, accessible from fair.sakshamg.me',
                            '“You” means the individual accessing or using the Website, or a company, or any legal entity on behalf of which such individual is accessing or using the Website, as applicable.',
                        ]}
                    />
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 2 */}
                {/* --------------------------------------------- */}
                <LegalSection title="2. The Use of the Cookies" isDark={isDark}>
                    <h3 className="text-xl font-semibold mb-2">2.1 Type of Cookies We Use</h3>
                    <p className="mb-2">
                        Cookies can be "Persistent" or "Session" Cookies. Persistent Cookies remain on your personal computer or mobile device when You go offline, while Session Cookies are deleted as soon as You close your web browser.
                    </p>
                    <p className="mb-4">
                        We use both session and persistent Cookies for the purposes set out below:
                    </p>

                    <h4 className="text-lg font-semibold mb-2 mt-4 text-[#ddef00]">Necessary / Essential Cookies</h4>
                    <p className="mb-2">Type: Session Cookies</p>
                    <p className="mb-2">Administered by: Us</p>
                    <p className="mb-4">
                        Purpose: These Cookies are essential to provide You with services available through the Website and to enable You to use some of its features. They help to authenticate users and prevent fraudulent use of user accounts. Without these Cookies, the services that You have asked for cannot be provided, and We only use these Cookies to provide You with those services.
                    </p>

                    <h4 className="text-lg font-semibold mb-2 mt-4 text-[#ddef00]">Functionality Cookies</h4>
                    <p className="mb-2">Type: Persistent Cookies</p>
                    <p className="mb-2">Administered by: Us</p>
                    <p className="mb-4">
                        Purpose: These Cookies allow us to remember choices You make when You use the Website, such as remembering your login details or language preference. The purpose of these Cookies is to provide You with a more personal experience and to avoid You having to re-enter your preferences every time You use the Website.
                    </p>

                    <h4 className="text-lg font-semibold mb-2 mt-4 text-[#ddef00]">Tracking and Performance Cookies</h4>
                    <p className="mb-2">Type: Persistent Cookies</p>
                    <p className="mb-2">Administered by: Third-Parties</p>
                    <p className="mb-4">
                        Purpose: These Cookies are used to track information about traffic to the Website and how users use the Website. The information gathered via these Cookies may directly or indirectly identify you as an individual visitor. This is because the information collected is typically linked to a pseudonymous identifier associated with the device you use to access the Website. We may also use these Cookies to test new advertisements, pages, features or new functionality of the Website to see how our users react to them.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 3 */}
                {/* --------------------------------------------- */}
                <LegalSection title="3. Your Choices Regarding Cookies" isDark={isDark}>
                    <p className="mb-4">
                        If You prefer to avoid the use of Cookies on the Website, first You must disable the use of Cookies in your browser and then delete the Cookies saved in your browser associated with this website. You may use this option for preventing the use of Cookies at any time.
                    </p>
                    <p className="mb-4">
                        If You do not accept Our Cookies, You may experience some inconvenience in your use of the Website and some features may not function properly.
                    </p>
                    <p className="mb-4">
                        For more information on how to manage and delete Cookies, visit the official support documents for your specific web browser (Chrome, Safari, Firefox, Edge, etc.).
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 4 */}
                {/* --------------------------------------------- */}
                <LegalSection title="4. More Information about Cookies" isDark={isDark}>
                    <p className="mb-4">
                        You can learn more about cookies: <a href="https://www.termsfeed.com/blog/cookies/" target="_blank" rel="noreferrer" className="underline decoration-[#ddef00] underline-offset-4 hover:opacity-80">What Are Cookies?</a>.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 5 */}
                {/* --------------------------------------------- */}
                <LegalSection title="5. Contact Us" isDark={isDark}>
                    <p className="mb-4">
                        If you have any questions about this Cookie Policy, You can contact us:
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'By email: fairarena.contact@gmail.com',
                        ]}
                    />
                </LegalSection>
            </div>
        </div>
    );
}

export default CookiePolicy;

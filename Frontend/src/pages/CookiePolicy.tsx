import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';
import { useEffect, useState } from 'react';

/* ---------------------------------------------
   MAIN PAGE: Cookie Policy
---------------------------------------------- */
function CookiePolicy() {
    const { theme } = useTheme();
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setIsDark(theme === 'dark');
    }, [theme]);

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
                    FairArena — Cookie Policy
                </h1>

                {/* Last Updated */}
                <p
                    className={`
            text-center mb-12 text-sm
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
                >
                    Last Updated: November 2025
                </p>

                <p className="mb-10">
                    This Cookie Policy explains how FairArena ("we", "our", "us") uses cookies and similar
                    technologies on our AI-powered hackathon management platform. By using our website, you
                    consent to the use of cookies in accordance with this policy.
                </p>

                {/* --------------------------------------------- */}
                {/* SECTION 1 */}
                {/* --------------------------------------------- */}
                <LegalSection title="1. What Are Cookies" isDark={isDark}>
                    <p className="mb-4">
                        Cookies are small text files that are stored on your device when you visit our website.
                        They help us provide you with a better browsing experience by remembering your preferences
                        and understanding how you use our platform.
                    </p>
                    <p className="mb-4">
                        We also use similar technologies such as web beacons, pixels, and local storage to collect
                        information about your interaction with our platform.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 2 */}
                {/* --------------------------------------------- */}
                <LegalSection title="2. Types of Cookies We Use" isDark={isDark}>
                    <h3 className="text-xl font-semibold mb-2">2.1 Necessary Cookies</h3>
                    <p className="mb-2">
                        These cookies are essential for the website to function properly. They enable core
                        functionality such as security, network management, and accessibility. You cannot opt
                        out of these cookies without severely affecting the functionality of our platform.
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Authentication and session management',
                            'Security and fraud prevention',
                            'Load balancing and performance optimization',
                            'Basic website functionality and navigation',
                        ]}
                    />

                    <h3 className="text-xl font-semibold mb-2 mt-6">2.2 Analytics Cookies</h3>
                    <p className="mb-2">
                        These cookies help us understand how visitors interact with our website by collecting
                        and reporting information anonymously. This helps us improve our platform's performance
                        and user experience.
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Page views and user journey tracking',
                            'Feature usage and interaction patterns',
                            'Performance metrics and error reporting',
                            'User behavior analytics (anonymized)',
                        ]}
                    />

                    <h3 className="text-xl font-semibold mb-2 mt-6">2.3 Functional Cookies</h3>
                    <p className="mb-2">
                        These cookies enable enhanced functionality and personalization. They remember your
                        preferences and settings to provide a more tailored experience.
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Theme and display preferences',
                            'Language settings',
                            'Data saver mode preferences',
                            'User interface customizations',
                        ]}
                    />

                    <h3 className="text-xl font-semibold mb-2 mt-6">2.4 Marketing Cookies</h3>
                    <p className="mb-2">
                        These cookies are used to track visitors across websites to display relevant advertisements
                        and measure the effectiveness of our marketing campaigns. We only use these with your explicit consent.
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Advertising targeting and retargeting',
                            'Campaign performance measurement',
                            'Cross-platform marketing analytics',
                            'Lead generation and conversion tracking',
                        ]}
                    />
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 3 */}
                {/* --------------------------------------------- */}
                <LegalSection title="3. Third-Party Cookies" isDark={isDark}>
                    <p className="mb-4">
                        We may use third-party services that set their own cookies. These include:
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Microsoft Clarity (analytics and user behavior tracking)',
                            'Payment processors (Stripe, Razorpay) for secure transactions',
                            'Content delivery networks (CDNs) for faster loading',
                            'Error monitoring and performance tracking services',
                        ]}
                    />
                    <p className="mb-4">
                        These third parties have their own privacy policies and cookie practices. We recommend
                        reviewing their policies to understand how they handle your data.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 4 */}
                {/* --------------------------------------------- */}
                <LegalSection title="4. Cookie Management" isDark={isDark}>
                    <p className="mb-4">
                        You have control over how we use cookies on our platform. You can:
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Accept or reject different categories of cookies through our consent banner',
                            'Change your cookie preferences at any time via your account settings',
                            'Use your browser settings to block or delete cookies',
                            'Enable our data saver mode to reduce non-essential cookie usage',
                        ]}
                    />
                    <p className="mb-4">
                        Please note that disabling certain cookies may affect the functionality of our platform
                        and limit your user experience.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 5 */}
                {/* --------------------------------------------- */}
                <LegalSection title="5. Data Saver Mode" isDark={isDark}>
                    <p className="mb-4">
                        Our platform includes a Data Saver mode that automatically reduces non-essential cookie
                        usage and disables certain tracking features to minimize data consumption and enhance privacy.
                    </p>
                    <p className="mb-4">
                        When Data Saver is enabled:
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Analytics cookies are automatically disabled',
                            'Marketing cookies are blocked',
                            'Some functional cookies may be limited',
                            'Automatic content refreshing is disabled',
                            'Image loading may be optimized',
                        ]}
                    />
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 6 */}
                {/* --------------------------------------------- */}
                <LegalSection title="6. Cookie Retention" isDark={isDark}>
                    <p className="mb-4">
                        Cookies have different lifespans depending on their purpose:
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Session cookies: Deleted when you close your browser',
                            'Persistent cookies: Remain until deleted or expired (typically 1-2 years)',
                            'Authentication cookies: Usually expire after 30 days of inactivity',
                            'Preference cookies: May persist until you change your settings',
                        ]}
                    />
                    <p className="mb-4">
                        You can delete cookies at any time through your browser settings.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 7 */}
                {/* --------------------------------------------- */}
                <LegalSection title="7. Updates to This Policy" isDark={isDark}>
                    <p className="mb-4">
                        We may update this Cookie Policy from time to time to reflect changes in our practices
                        or for legal reasons. When we make significant changes, we will notify you through our
                        platform or via email.
                    </p>
                    <p className="mb-4">
                        Your continued use of our platform after any changes indicates your acceptance of the
                        updated policy.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 8 */}
                {/* --------------------------------------------- */}
                <LegalSection title="8. Contact Us" isDark={isDark}>
                    <p className="mb-4">
                        If you have any questions about this Cookie Policy or our use of cookies, please contact us:
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'Email: fairarena.contact@gmail.com',
                            'Through our support system in the platform',
                            'Via our website contact form',
                        ]}
                    />
                    <p className="mb-4">
                        We are committed to addressing your concerns and will respond to your inquiries promptly.
                    </p>
                </LegalSection>

                {/* --------------------------------------------- */}
                {/* SECTION 9 */}
                {/* --------------------------------------------- */}
                <LegalSection title="9. Legal Compliance" isDark={isDark}>
                    <p className="mb-4">
                        This Cookie Policy complies with applicable data protection laws including:
                    </p>
                    <LegalList
                        isDark={isDark}
                        items={[
                            'General Data Protection Regulation (GDPR)',
                            'California Consumer Privacy Act (CCPA)',
                            'ePrivacy Directive and national implementations',
                            'Other applicable privacy and cookie regulations',
                        ]}
                    />
                    <p className="mb-4">
                        We regularly review and update our practices to ensure ongoing compliance with these regulations.
                    </p>
                </LegalSection>
            </div>
        </div>
    );
}

export default CookiePolicy;

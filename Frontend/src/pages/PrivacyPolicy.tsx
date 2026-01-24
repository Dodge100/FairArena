import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from 'react-i18next';

/* ---------------------------------------------
   MAIN PAGE: Privacy Policy
---------------------------------------------- */
function PrivacyPolicy() {
  const { isDark } = useTheme();
  const { t } = useTranslation();

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
          {t('privacyPolicy.title')}
        </h1>

        {/* Last Updated */}
        <p
          className={`
            text-center mb-12 text-sm
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
        >
          {t('privacyPolicy.lastUpdated')}
        </p>

        <p className="mb-10">
          {t('privacyPolicy.intro')}
        </p>

        {/* --------------------------------------------- */}
        {/* SECTION 1 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.collection.title')} isDark={isDark}>
          <p className="mb-4">{t('privacyPolicy.sections.collection.description')}</p>

          <h3 className="text-xl font-semibold mb-2">{t('privacyPolicy.sections.collection.subsections.personalData.title')}</h3>
          <p className="mb-2">{t('privacyPolicy.sections.collection.subsections.personalData.description')}</p>
          <LegalList
            isDark={isDark}
            items={t('privacyPolicy.sections.collection.subsections.personalData.list', { returnObjects: true }) as string[]}
          />

          <h3 className="text-xl font-semibold mb-2 mt-6">{t('privacyPolicy.sections.collection.subsections.usageData.title')}</h3>
          <p className="mb-2">{t('privacyPolicy.sections.collection.subsections.usageData.description')}</p>
          <LegalList
            isDark={isDark}
            items={t('privacyPolicy.sections.collection.subsections.usageData.list', { returnObjects: true }) as string[]}
          />

          <h3 className="text-xl font-semibold mb-2 mt-6">{t('privacyPolicy.sections.collection.subsections.tracking.title')}</h3>
          <p className="mb-2">{t('privacyPolicy.sections.collection.subsections.tracking.description')}</p>
          <LegalList
            isDark={isDark}
            items={t('privacyPolicy.sections.collection.subsections.tracking.list', { returnObjects: true }) as string[]}
          />
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 2 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.usage.title')} isDark={isDark}>
          <p className="mb-4">{t('privacyPolicy.sections.usage.intro')}</p>
          <LegalList
            isDark={isDark}
            items={t('privacyPolicy.sections.usage.list', { returnObjects: true }) as string[]}
          />
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 3 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.retention.title')} isDark={isDark}>
          <p>
            {t('privacyPolicy.sections.retention.content1')}
            <br /><br />
            {t('privacyPolicy.sections.retention.content2')}
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 4 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.transfer.title')} isDark={isDark}>
          <p>
            {t('privacyPolicy.sections.transfer.content1')}
            <br /><br />
            {t('privacyPolicy.sections.transfer.content2')}
            <br /><br />
            {t('privacyPolicy.sections.transfer.content3')}
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 5 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.disclosure.title')} isDark={isDark}>
          <h3 className="text-xl font-semibold mb-2">{t('privacyPolicy.sections.disclosure.subtitle')}</h3>
          <p className="mb-2">{t('privacyPolicy.sections.disclosure.description')}</p>
          <LegalList
            isDark={isDark}
            items={t('privacyPolicy.sections.disclosure.list', { returnObjects: true }) as string[]}
          />
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 6 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.security.title')} isDark={isDark}>
          <p>
            {t('privacyPolicy.sections.security.content')}
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 7 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.providers.title')} isDark={isDark}>
          <p className="mb-4">
            {t('privacyPolicy.sections.providers.content1')}
            <br />
            {t('privacyPolicy.sections.providers.content2')}
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 8 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.links.title')} isDark={isDark}>
          <p>
            {t('privacyPolicy.sections.links.content1')}
            <br /><br />
            {t('privacyPolicy.sections.links.content2')}
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 9 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.children.title')} isDark={isDark}>
          <p>
            {t('privacyPolicy.sections.children.content1')}
            <br /><br />
            {t('privacyPolicy.sections.children.content2')}
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 10 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.changes.title')} isDark={isDark}>
          <p>
            {t('privacyPolicy.sections.changes.content1')}
            <br /><br />
            {t('privacyPolicy.sections.changes.content2')}
            <br /><br />
            {t('privacyPolicy.sections.changes.content3')}
          </p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 11 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('privacyPolicy.sections.contact.title')} isDark={isDark}>
          <p>
            {t('privacyPolicy.sections.contact.description')}
            <br />
            <span className="text-[#879400]">{t('privacyPolicy.sections.contact.email')}</span>
          </p>
        </LegalSection>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

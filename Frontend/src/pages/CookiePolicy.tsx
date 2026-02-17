import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from 'react-i18next';

/* ---------------------------------------------
   MAIN PAGE: Cookie Policy
---------------------------------------------- */
function CookiePolicy() {
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
            text-[#ddef00] [-webkit-text-stroke:1px_black]
          `}
        >
          {t('cookiePolicy.title')}
        </h1>

        {/* Last Updated */}
        <p
          className={`
            text-center mb-12 text-sm
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
        >
          {t('cookiePolicy.lastUpdated')}
        </p>

        <p className="mb-10">
          {t('cookiePolicy.intro')}
          <br />
          <br />
          {t('cookiePolicy.intro2')}
        </p>

        {/* --------------------------------------------- */}
        {/* SECTION 1 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('cookiePolicy.sections.definitions.title')} isDark={isDark}>
          <h3 className="text-xl font-semibold mb-2">
            {t('cookiePolicy.sections.definitions.subtitle1')}
          </h3>
          <p className="mb-4">{t('cookiePolicy.sections.definitions.content1')}</p>
          <h3 className="text-xl font-semibold mb-2">
            {t('cookiePolicy.sections.definitions.subtitle2')}
          </h3>
          <LegalList
            isDark={isDark}
            items={t('cookiePolicy.sections.definitions.list', { returnObjects: true }) as string[]}
          />
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 2 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('cookiePolicy.sections.usage.title')} isDark={isDark}>
          <h3 className="text-xl font-semibold mb-2">
            {t('cookiePolicy.sections.usage.subtitle')}
          </h3>
          <p className="mb-2">{t('cookiePolicy.sections.usage.content1')}</p>
          <p className="mb-4">{t('cookiePolicy.sections.usage.content2')}</p>

          <h4 className="text-lg font-semibold mb-2 mt-4 text-[#ddef00]">
            {t('cookiePolicy.sections.usage.types.essential.title')}
          </h4>
          <p className="mb-2">{t('cookiePolicy.sections.usage.types.essential.type')}</p>
          <p className="mb-2">{t('cookiePolicy.sections.usage.types.essential.admin')}</p>
          <p className="mb-4">{t('cookiePolicy.sections.usage.types.essential.purpose')}</p>

          <h4 className="text-lg font-semibold mb-2 mt-4 text-[#ddef00]">
            {t('cookiePolicy.sections.usage.types.functionality.title')}
          </h4>
          <p className="mb-2">{t('cookiePolicy.sections.usage.types.functionality.type')}</p>
          <p className="mb-2">{t('cookiePolicy.sections.usage.types.functionality.admin')}</p>
          <p className="mb-4">{t('cookiePolicy.sections.usage.types.functionality.purpose')}</p>

          <h4 className="text-lg font-semibold mb-2 mt-4 text-[#ddef00]">
            {t('cookiePolicy.sections.usage.types.tracking.title')}
          </h4>
          <p className="mb-2">{t('cookiePolicy.sections.usage.types.tracking.type')}</p>
          <p className="mb-2">{t('cookiePolicy.sections.usage.types.tracking.admin')}</p>
          <p className="mb-4">{t('cookiePolicy.sections.usage.types.tracking.purpose')}</p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 3 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('cookiePolicy.sections.choices.title')} isDark={isDark}>
          <p className="mb-4">{t('cookiePolicy.sections.choices.content1')}</p>
          <p className="mb-4">{t('cookiePolicy.sections.choices.content2')}</p>
          <p className="mb-4">{t('cookiePolicy.sections.choices.content3')}</p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 4 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('cookiePolicy.sections.moreInfo.title')} isDark={isDark}>
          <p className="mb-4">{t('cookiePolicy.sections.moreInfo.content')}</p>
        </LegalSection>

        {/* --------------------------------------------- */}
        {/* SECTION 5 */}
        {/* --------------------------------------------- */}
        <LegalSection title={t('cookiePolicy.sections.contact.title')} isDark={isDark}>
          <p className="mb-4">{t('cookiePolicy.sections.contact.description')}</p>
          <LegalList isDark={isDark} items={[t('cookiePolicy.sections.contact.email')]} />
        </LegalSection>
      </div>
    </div>
  );
}

export default CookiePolicy;

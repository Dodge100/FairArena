import { LegalList, LegalSection } from '@/components/legal/LegalSection';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from 'react-i18next';

/* ----------------------------------------------------
   DATA ARRAYS
----------------------------------------------------- */


/* ----------------------------------------------------
   MAIN PAGE: TERMS & CONDITIONS
----------------------------------------------------- */

function TermsAndConditions() {
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
        {/* HEADER */}
        <h1
          className={`
            text-4xl sm:text-5xl font-bold text-center mb-10
            text-[#ddef00] [-webkit-text-stroke:_1px_black]
          `}
        >
          {t('termsAndConditions.title')}
        </h1>

        <p
          className={`
            text-center mb-12 text-sm
            ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
          `}
        >
          {t('termsAndConditions.lastUpdated')}
        </p>

        <p className="mb-10">
          {t('termsAndConditions.intro')}
        </p>

        {/* ------------ SECTION 1 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.definitions.title')} isDark={isDark}>
          <p className="mb-4">
            {t('termsAndConditions.sections.definitions.content')}
          </p>
          <LegalList items={t('termsAndConditions.sections.definitions.list', { returnObjects: true }) as string[]} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 2 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.accounts.title')} isDark={isDark}>
          <p className="mb-4">
            {t('termsAndConditions.sections.accounts.content')}
          </p>
          <LegalList items={t('termsAndConditions.sections.accounts.list', { returnObjects: true }) as string[]} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 3 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.usage.title')} isDark={isDark}>
          <LegalList items={t('termsAndConditions.sections.usage.list', { returnObjects: true }) as string[]} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 4 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.intellectualProperty.title')} isDark={isDark}>
          <LegalList items={t('termsAndConditions.sections.intellectualProperty.list', { returnObjects: true }) as string[]} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 5 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.aiDisclaimer.title')} isDark={isDark}>
          <LegalList items={t('termsAndConditions.sections.aiDisclaimer.list', { returnObjects: true }) as string[]} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 6 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.links.title')} isDark={isDark}>
          <p>
            {t('termsAndConditions.sections.links.content')}
          </p>
        </LegalSection>

        {/* ------------ SECTION 7 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.termination.title')} isDark={isDark}>
          <LegalList items={t('termsAndConditions.sections.termination.list', { returnObjects: true }) as string[]} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 8 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.liability.title')} isDark={isDark}>
          <LegalList items={t('termsAndConditions.sections.liability.list', { returnObjects: true }) as string[]} isDark={isDark} />
        </LegalSection>

        {/* ------------ SECTION 9 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.disclaimer.title')} isDark={isDark}>
          <p>
            {t('termsAndConditions.sections.disclaimer.content1')}
            <br /><br />
            {t('termsAndConditions.sections.disclaimer.content2')}
          </p>
        </LegalSection>

        {/* ------------ SECTION 10 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.governing.title')} isDark={isDark}>
          <p>
            {t('termsAndConditions.sections.governing.content')}
          </p>
        </LegalSection>

        {/* ------------ SECTION 11 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.disputes.title')} isDark={isDark}>
          <p>
            {t('termsAndConditions.sections.disputes.content')}
          </p>
        </LegalSection>

        {/* ------------ SECTION 12 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.changes.title')} isDark={isDark}>
          <p>
            {t('termsAndConditions.sections.changes.content1')}
            <br /><br />
            {t('termsAndConditions.sections.changes.content2')}
          </p>
        </LegalSection>

        {/* ------------ SECTION 13 ------------ */}
        <LegalSection title={t('termsAndConditions.sections.contact.title')} isDark={isDark}>
          <p>
            {t('termsAndConditions.sections.contact.description')}
            <a className="text-[#909d00]" href="mailto:legal@fairarena.app">legal@fairarena.app</a>
          </p>
        </LegalSection>
      </div>
    </div>
  );
}

export default TermsAndConditions;

import { useTheme } from '@/hooks/useTheme';
import { ArrowRight, Brain, Handshake, Heart, Rocket, Star, Target, Zap } from 'lucide-react';

import { useTranslation } from 'react-i18next';

function About() {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <div
      className={`
      w-full min-h-screen flex flex-col items-center pt-20 pb-20 px-6
      ${isDark ? 'bg-[#0b0b0b] text-neutral-300' : 'bg-white text-neutral-800'}
    `}
    >
      {/* Heading */}
      <h1
        className={`
        text-center mt-20 text-neutral-400 text-sm sm:text-base md:text-lg gap-2
        flex flex-col px-4 md:px-0 max-w-[90%] sm:max-w-[80%] md:max-w-[60%]
        lg:max-w-[50%] xl:max-w-[60%] mx-auto
      `}
      >
        <span className="text-4xl sm:text-5xl text-[#ddef00] [-webkit-text-stroke:_1px_black] font-bold">
          {t('about.heading')}
        </span>
      </h1>

      {/* Main Content */}
      <div className="max-w-4xl w-full mt-10 space-y-10 leading-relaxed text-lg">
        {/* INTRO */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6" />
            {t('about.intro.title')}
          </h2>
          <p>
            {t('about.intro.part1')}
            <br />
            <span className="font-semibold">
              {t('about.intro.highlight')}
            </span>
          </p>
          <p className="mt-4">
            {t('about.intro.part2')}
            <br />
            {t('about.intro.part3')} <strong>{t('about.intro.bold')}</strong>
          </p>
        </section>

        {/* WHO WE ARE */}

        {/* MISSION */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Target className="w-6 h-6" />
            {t('about.mission.title')}
          </h2>
          <p>{t('about.mission.desc1')}</p>
          <p className="mt-3">
            {t('about.mission.desc2')}
          </p>
        </section>

        {/* VISION */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Star className="w-6 h-6" />
            {t('about.vision.title')}
          </h2>
          <p>
            {t('about.vision.desc1')}
          </p>

          <p className="mt-3">{t('about.vision.listTitle')}</p>
          <ul className="list-disc ml-6 mt-2 space-y-2">
            {(t('about.vision.list', { returnObjects: true }) as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        {/* WHY DIFFERENT */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6" />
            {t('about.different.title')}
          </h2>

          <ol className="list-decimal ml-6 space-y-4">
            {(t('about.different.list', { returnObjects: true }) as Array<{ title: string, desc: string }>).map((item, i) => (
              <li key={i}>
                <strong>{item.title}</strong>
                {item.desc && <><br />{item.desc}</>}
              </li>
            ))}
          </ol>
        </section>

        {/* WHO USES */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Handshake className="w-6 h-6" />
            {t('about.whoUses.title')}
          </h2>
          <p>{t('about.whoUses.desc1')}</p>

          <ul className="list-disc ml-6 mt-2 space-y-2">
            {(t('about.whoUses.list', { returnObjects: true }) as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <p className="mt-4">
            {t('about.whoUses.desc2')}
          </p>
        </section>

        {/* TECHNOLOGY */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6" />
            {t('about.tech.title')}
          </h2>

          <p>{t('about.tech.desc1')}</p>
          <ul className="list-disc ml-6 mt-2 space-y-2">
            {(t('about.tech.list1', { returnObjects: true }) as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <p className="mt-4">{t('about.tech.desc2')}</p>

          <ul className="list-disc ml-6 mt-2 space-y-2">
            {(t('about.tech.list2', { returnObjects: true }) as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        {/* PASSION */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Heart className="w-6 h-6" />
            {t('about.passion.title')}
          </h2>

          <p>
            {t('about.passion.desc1')}
          </p>

          <p className="mt-4">
            <strong>{t('about.passion.promise.label')}</strong>
            {t('about.passion.promise.text')}
          </p>
        </section>

        {/* CTA */}
        <section>
          <h2 className="text-2xl font-semibold text-[#ddef00] mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6" />
            {t('about.cta.title')}
          </h2>

          <p>
            {t('about.cta.desc')}
          </p>

          <ul className="list-none ml-0 mt-3 space-y-2">
            <li className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-[#ddef00]" />
              {t('about.cta.item1')}
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-[#ddef00]" />
              {t('about.cta.item2')}
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-[#ddef00]" />
              {t('about.cta.contact')} <span className="text-[#ddef00]">fairarena.contact@gmail.com</span>
            </li>
          </ul>
        </section>
      </div >
    </div >
  );
}

export default About;

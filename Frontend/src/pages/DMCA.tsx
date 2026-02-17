import { motion } from 'framer-motion';
import { AlertTriangle, Copyright, Mail } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

export default function DMCA() {
  const { t } = useTranslation();
  return (
    <>
      <Helmet>
        <title>DMCA Policy - FairArena</title>
        <meta
          name="description"
          content="FairArena's Digital Millennium Copyright Act (DMCA) policy and copyright infringement reporting procedures."
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-20">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-block p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl mb-6">
              <Copyright className="w-12 h-12 text-red-400" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              {t('dmca.title')}
            </h1>
            <p className="text-xl text-gray-300">{t('dmca.subtitle')}</p>
          </motion.div>

          {/* Policy Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            {/* Introduction */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
              <h2 className="text-3xl font-bold mb-4">{t('dmca.intro.title')}</h2>
              <p className="text-gray-300 mb-4">{t('dmca.intro.text')}</p>
            </section>

            {/* Notification */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <h2 className="text-3xl font-bold">{t('dmca.notification.title')}</h2>
              </div>
              <p className="text-gray-300 mb-4">{t('dmca.notification.text')}</p>
              <ul className="space-y-3 text-gray-300 ml-6">
                {(t('dmca.notification.list', { returnObjects: true }) as string[]).map(
                  (item, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-purple-400 mr-2">{i + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </section>

            {/* Counter-Notification */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
              <h2 className="text-3xl font-bold mb-4">{t('dmca.counter.title')}</h2>
              <p className="text-gray-300 mb-4">{t('dmca.counter.text')}</p>
              <ul className="space-y-3 text-gray-300 ml-6">
                {(t('dmca.counter.list', { returnObjects: true }) as string[]).map((item, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-purple-400 mr-2">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Repeat Infringers */}
            <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
              <h2 className="text-3xl font-bold mb-4">{t('dmca.repeat.title')}</h2>
              <p className="text-gray-300">{t('dmca.repeat.text')}</p>
            </section>

            {/* Contact Information */}
            <section className="bg-gradient-to-r from-red-500/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-8 border border-red-500/20">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-red-400" />
                <h2 className="text-3xl font-bold">{t('dmca.contact.title')}</h2>
              </div>
              <p className="text-gray-300 mb-4">{t('dmca.contact.text')}</p>
              <div className="bg-black/30 rounded-lg p-6 space-y-2 text-gray-300">
                <p>
                  <strong>{t('dmca.contact.agentLabel')}:</strong> {t('dmca.contact.agentValue')}
                </p>
                <p>
                  <strong>{t('dmca.contact.emailLabel')}:</strong>{' '}
                  <a href="mailto:legal@fairarena.app" className="text-red-400 hover:underline">
                    legal@fairarena.app
                  </a>
                </p>
                <p>
                  <strong>{t('dmca.contact.subjectLabel')}:</strong>{' '}
                  {t('dmca.contact.subjectValue')}
                </p>
              </div>
              <p className="text-sm text-gray-400 mt-4">{t('dmca.contact.liability')}</p>
            </section>

            {/* Last Updated */}
            <div className="text-center text-gray-500 text-sm">{t('dmca.lastUpdated')}</div>
          </motion.div>
        </div>
      </div>
    </>
  );
}

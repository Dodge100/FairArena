import { motion } from 'framer-motion';
import { Contrast, Eye, Keyboard, MousePointer, Type, Volume2 } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

export default function Accessibility() {
  const { t } = useTranslation();

  const features = [
    {
      icon: <Keyboard className="w-8 h-8" />,
      title: t('accessibility.features.items.keyboard.title'),
      description: t('accessibility.features.items.keyboard.desc'),
    },
    {
      icon: <Eye className="w-8 h-8" />,
      title: t('accessibility.features.items.screenReader.title'),
      description: t('accessibility.features.items.screenReader.desc'),
    },
    {
      icon: <Contrast className="w-8 h-8" />,
      title: t('accessibility.features.items.highContrast.title'),
      description: t('accessibility.features.items.highContrast.desc'),
    },
    {
      icon: <Type className="w-8 h-8" />,
      title: t('accessibility.features.items.resizableText.title'),
      description: t('accessibility.features.items.resizableText.desc'),
    },
    {
      icon: <MousePointer className="w-8 h-8" />,
      title: t('accessibility.features.items.focusIndicators.title'),
      description: t('accessibility.features.items.focusIndicators.desc'),
    },
    {
      icon: <Volume2 className="w-8 h-8" />,
      title: t('accessibility.features.items.captions.title'),
      description: t('accessibility.features.items.captions.desc'),
    },
  ];

  return (
    <>
      <Helmet>
        <title>Accessibility Statement - FairArena</title>
        <meta
          name="description"
          content="FairArena is committed to ensuring digital accessibility for people with disabilities. Learn about our accessibility features and standards."
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-20">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t('accessibility.title')}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">{t('accessibility.subtitle')}</p>
          </motion.div>

          {/* Commitment Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <h2 className="text-3xl font-bold mb-4">{t('accessibility.commitment.title')}</h2>
            <p className="text-gray-300 mb-4">{t('accessibility.commitment.text1')}</p>
            <p className="text-gray-300">{t('accessibility.commitment.text2')}</p>
          </motion.section>

          {/* Features Grid */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t('accessibility.features.title')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-purple-500/50 transition-all duration-300"
                >
                  <div className="text-purple-400 mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Standards Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-16 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <h2 className="text-3xl font-bold mb-4">{t('accessibility.standards.title')}</h2>
            <ul className="space-y-3 text-gray-300">
              {(t('accessibility.standards.list', { returnObjects: true }) as string[]).map(
                (item, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    <span>{item}</span>
                  </li>
                ),
              )}
            </ul>
          </motion.section>

          {/* Feedback Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20"
          >
            <h2 className="text-3xl font-bold mb-4">{t('accessibility.feedback.title')}</h2>
            <p className="text-gray-300 mb-4">{t('accessibility.feedback.text')}</p>
            <ul className="space-y-2 text-gray-300 mb-6">
              <li>
                {t('accessibility.feedback.emailLabel')}:{' '}
                <a href="mailto:support@fairarena.app" className="text-purple-400 hover:underline">
                  support@fairarena.app
                </a>
              </li>
              <li>
                {t('accessibility.feedback.supportLabel')}:{' '}
                <a href="/support" className="text-purple-400 hover:underline">
                  {t('accessibility.feedback.supportButton')}
                </a>
              </li>
            </ul>
            <p className="text-sm text-gray-400">{t('accessibility.feedback.response')}</p>
          </motion.section>

          {/* Last Updated */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-center mt-12 text-gray-500 text-sm"
          >
            {t('accessibility.lastUpdated')}
          </motion.div>
        </div>
      </div>
    </>
  );
}

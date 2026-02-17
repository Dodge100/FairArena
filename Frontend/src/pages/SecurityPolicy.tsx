import { motion } from 'framer-motion';
import { Cookie, Database, Eye, Lock, Shield, UserCheck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

export default function SecurityPolicy() {
  const { t } = useTranslation();

  const practices = [
    {
      icon: <Lock className="w-8 h-8" />,
      title: t('securityPolicy.practices.items.encryption.title'),
      description: t('securityPolicy.practices.items.encryption.desc'),
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: t('securityPolicy.practices.items.auth.title'),
      description: t('securityPolicy.practices.items.auth.desc'),
    },
    {
      icon: <Database className="w-8 h-8" />,
      title: t('securityPolicy.practices.items.protection.title'),
      description: t('securityPolicy.practices.items.protection.desc'),
    },
    {
      icon: <Eye className="w-8 h-8" />,
      title: t('securityPolicy.practices.items.monitoring.title'),
      description: t('securityPolicy.practices.items.monitoring.desc'),
    },
    {
      icon: <UserCheck className="w-8 h-8" />,
      title: t('securityPolicy.practices.items.access.title'),
      description: t('securityPolicy.practices.items.access.desc'),
    },
    {
      icon: <Cookie className="w-8 h-8" />,
      title: t('securityPolicy.practices.items.privacy.title'),
      description: t('securityPolicy.practices.items.privacy.desc'),
    },
  ];

  return (
    <>
      <Helmet>
        <title>Security Policy - FairArena</title>
        <meta
          name="description"
          content="Learn about FairArena's security practices, data protection measures, and commitment to keeping your information safe."
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
            <div className="inline-block p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl mb-6">
              <Shield className="w-12 h-12 text-green-400" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              {t('securityPolicy.title')}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              {t('securityPolicy.subtitle')}
            </p>
          </motion.div>

          {/* Security Practices */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t('securityPolicy.practices.title')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {practices.map((practice, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-green-500/50 transition-all duration-300"
                >
                  <div className="text-green-400 mb-4">{practice.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{practice.title}</h3>
                  <p className="text-gray-400 text-sm">{practice.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Responsible Disclosure */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-16 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <h2 className="text-3xl font-bold mb-4">{t('securityPolicy.disclosure.title')}</h2>
            <p className="text-gray-300 mb-6">{t('securityPolicy.disclosure.text')}</p>
            <div className="bg-gray-900/50 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-green-400 mb-2">
                  {t('securityPolicy.disclosure.email.label')}
                </h3>
                <a
                  href="mailto:support@fairarena.app"
                  className="text-gray-300 hover:text-green-400"
                >
                  {t('securityPolicy.disclosure.email.value')}
                </a>
              </div>
              <div>
                <h3 className="font-semibold text-green-400 mb-2">
                  {t('securityPolicy.disclosure.pgp.label')}
                </h3>
                <p className="text-gray-400 text-sm">{t('securityPolicy.disclosure.pgp.value')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-green-400 mb-2">
                  {t('securityPolicy.disclosure.response.label')}
                </h3>
                <p className="text-gray-400 text-sm">
                  {t('securityPolicy.disclosure.response.value')}
                </p>
              </div>
            </div>
          </motion.section>

          {/* Bug Bounty */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-16 bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl p-8 border border-green-500/20"
          >
            <h2 className="text-3xl font-bold mb-4">{t('securityPolicy.bounty.title')}</h2>
            <p className="text-gray-300 mb-4">{t('securityPolicy.bounty.text')}</p>
            <ul className="space-y-2 text-gray-300 ml-6 mb-6">
              {(t('securityPolicy.bounty.list', { returnObjects: true }) as string[]).map(
                (item, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-green-400 mr-2">•</span>
                    <span>{item}</span>
                  </li>
                ),
              )}
            </ul>
            <a
              href="/security-acknowledgments"
              className="inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-300"
            >
              {t('securityPolicy.bounty.button')}
            </a>
          </motion.section>

          {/* Compliance */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <h2 className="text-3xl font-bold mb-4">{t('securityPolicy.compliance.title')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-green-400">
                  {t('securityPolicy.compliance.standards.title')}
                </h3>
                <ul className="space-y-2 text-gray-300">
                  {(
                    t('securityPolicy.compliance.standards.list', {
                      returnObjects: true,
                    }) as string[]
                  ).map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3 text-green-400">
                  {t('securityPolicy.compliance.audits.title')}
                </h3>
                <ul className="space-y-2 text-gray-300">
                  {(
                    t('securityPolicy.compliance.audits.list', { returnObjects: true }) as string[]
                  ).map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.section>

          {/* Last Updated */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-center mt-12 text-gray-500 text-sm"
          >
            {t('securityPolicy.lastUpdated')}
          </motion.div>
        </div>
      </div>
    </>
  );
}

/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Flag, Heart, MessageCircle, Shield, Users } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

export default function CommunityGuidelines() {
  const { t } = useTranslation();

  const guidelines = [
    {
      icon: <Heart className="w-8 h-8" />,
      title: t('communityGuidelines.core.items.respectful.title'),
      description: t('communityGuidelines.core.items.respectful.desc'),
      examples: t('communityGuidelines.core.items.respectful.examples', {
        returnObjects: true,
      }) as string[],
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: t('communityGuidelines.core.items.collaborate.title'),
      description: t('communityGuidelines.core.items.collaborate.desc'),
      examples: t('communityGuidelines.core.items.collaborate.examples', {
        returnObjects: true,
      }) as string[],
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: t('communityGuidelines.core.items.integrity.title'),
      description: t('communityGuidelines.core.items.integrity.desc'),
      examples: t('communityGuidelines.core.items.integrity.examples', {
        returnObjects: true,
      }) as string[],
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: t('communityGuidelines.core.items.communicate.title'),
      description: t('communityGuidelines.core.items.communicate.desc'),
      examples: t('communityGuidelines.core.items.communicate.examples', {
        returnObjects: true,
      }) as string[],
    },
  ];

  const prohibited = t('communityGuidelines.prohibited.items', { returnObjects: true }) as string[];

  return (
    <>
      <Helmet>
        <title>Community Guidelines - FairArena</title>
        <meta
          name="description"
          content="FairArena's community guidelines for creating a safe, respectful, and collaborative environment for all users."
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
            <div className="inline-block p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl mb-6">
              <Users className="w-12 h-12 text-purple-400" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
              {t('communityGuidelines.title')}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              {t('communityGuidelines.subtitle')}
            </p>
          </motion.div>

          {/* Introduction */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <h2 className="text-3xl font-bold mb-4">{t('communityGuidelines.commitment.title')}</h2>
            <p className="text-gray-300 mb-4">{t('communityGuidelines.commitment.text1')}</p>
            <p className="text-gray-300">{t('communityGuidelines.commitment.text2')}</p>
          </motion.section>

          {/* Guidelines */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t('communityGuidelines.core.title')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {guidelines.map((guideline, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-purple-500/50 transition-all duration-300"
                >
                  <div className="text-purple-400 mb-4">{guideline.icon}</div>
                  <h3 className="text-2xl font-semibold mb-3">{guideline.title}</h3>
                  <p className="text-gray-300 mb-4">{guideline.description}</p>
                  <div className="space-y-2">
                    {guideline.examples.map((example, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span>{example}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Prohibited Content */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-16 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <h2 className="text-3xl font-bold">{t('communityGuidelines.prohibited.title')}</h2>
            </div>
            <p className="text-gray-300 mb-6">{t('communityGuidelines.prohibited.text')}</p>
            <div className="grid md:grid-cols-2 gap-3">
              {prohibited.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 + index * 0.05 }}
                  className="flex items-center gap-3 bg-red-500/10 rounded-lg p-4 border border-red-500/20"
                >
                  <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-gray-300">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Enforcement */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mb-16 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <h2 className="text-3xl font-bold mb-4">
              {t('communityGuidelines.enforcement.title')}
            </h2>
            <p className="text-gray-300 mb-4">{t('communityGuidelines.enforcement.text')}</p>
            <ul className="space-y-3 text-gray-300 ml-6">
              {(
                t('communityGuidelines.enforcement.items', { returnObjects: true }) as string[]
              ).map((item, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-purple-400 mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-300 mt-4">{t('communityGuidelines.enforcement.note')}</p>
          </motion.section>

          {/* Reporting */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <Flag className="w-8 h-8 text-purple-400" />
              <h2 className="text-3xl font-bold">{t('communityGuidelines.report.title')}</h2>
            </div>
            <p className="text-gray-300 mb-6">{t('communityGuidelines.report.text')}</p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/support"
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300"
              >
                {t('communityGuidelines.report.button')}
              </a>
              <a
                href="mailto:legal@fairarena.app"
                className="px-8 py-3 bg-white/10 backdrop-blur-sm rounded-lg font-semibold border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                {t('communityGuidelines.report.emailLabel')}: legal@fairarena.app
              </a>
            </div>
          </motion.section>

          {/* Last Updated */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center mt-12 text-gray-500 text-sm"
          >
            {t('communityGuidelines.lastUpdated')}
          </motion.div>
        </div>
      </div>
    </>
  );
}

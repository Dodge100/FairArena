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

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Maintenance() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-yellow-600 dark:text-yellow-500" />
          </div>
          <CardTitle className="text-3xl font-bold">{t('maintenance.title')}</CardTitle>
          <CardDescription className="text-lg">{t('maintenance.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 space-y-3">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('maintenance.duration.title')}
              </p>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 ml-8">
              {t('maintenance.duration.text')}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-3">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('maintenance.assistance.title')}
              </p>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 ml-8">
              {t('maintenance.assistance.text')}
            </p>
            <Button
              variant="outline"
              className="ml-8"
              onClick={() => (window.location.href = 'mailto:support@fairarena.app')}
            >
              {t('maintenance.assistance.button')}
            </Button>
          </div>

          <div className="text-center">
            <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
              {t('maintenance.checkStatus')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

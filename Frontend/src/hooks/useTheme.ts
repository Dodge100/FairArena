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

import { createContext, useContext } from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}

// Data Saver types and context
export interface DataSaverSettings {
  enabled: boolean;
  disableNotifications: boolean;
  disableImages: boolean;
  reduceAnimations: boolean;
  disableAutoRefresh: boolean;
  forceDarkTheme: boolean;
}

type DataSaverContextType = {
  dataSaverSettings: DataSaverSettings;
  updateDataSaverSetting: (key: keyof DataSaverSettings, value: boolean) => void;
};

export const DataSaverContext = createContext<DataSaverContextType | null>(null);

export function useDataSaver() {
  const ctx = useContext(DataSaverContext);
  if (!ctx) {
    throw new Error('useDataSaver must be used inside DataSaverProvider');
  }
  return ctx;
}

import { createContext, useContext } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
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

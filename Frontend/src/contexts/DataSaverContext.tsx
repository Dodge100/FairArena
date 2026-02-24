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

import { createContext, useContext, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

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

const DataSaverContext = createContext<DataSaverContextType | null>(null);

interface DataSaverProviderProps {
  children: ReactNode;
}

export function DataSaverProvider({ children }: DataSaverProviderProps) {
  const [dataSaverSettings, setDataSaverSettings] = useState<DataSaverSettings>(() => {
    const saved = localStorage.getItem('dataSaverSettings');
    return saved
      ? JSON.parse(saved)
      : {
          enabled: false,
          disableNotifications: false,
          disableImages: false,
          reduceAnimations: false,
          disableAutoRefresh: false,
          forceDarkTheme: false,
        };
  });

  const updateDataSaverSetting = (key: keyof DataSaverSettings, value: boolean) => {
    const updatedSettings = { ...dataSaverSettings, [key]: value };
    setDataSaverSettings(updatedSettings);
    localStorage.setItem('dataSaverSettings', JSON.stringify(updatedSettings));
    toast.success('Data saver setting updated');
  };

  return (
    <DataSaverContext.Provider value={{ dataSaverSettings, updateDataSaverSetting }}>
      {children}
    </DataSaverContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDataSaver() {
  const ctx = useContext(DataSaverContext);
  if (!ctx) {
    throw new Error('useDataSaver must be used inside DataSaverProvider');
  }
  return ctx;
}

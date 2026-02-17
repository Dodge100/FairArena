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

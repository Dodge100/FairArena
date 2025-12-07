import { useDataSaver } from '@/contexts/DataSaverContext';
import { cnWithAnimations, shouldAutoRefresh, shouldLoadImage } from '@/lib/utils';

export function useDataSaverUtils() {
  const { dataSaverSettings } = useDataSaver();

  return {
    // Animation utilities
    cn: (...inputs: any[]) => cnWithAnimations(dataSaverSettings, ...inputs),

    // Image loading
    shouldLoadImage: shouldLoadImage(dataSaverSettings),

    // Auto refresh
    shouldAutoRefresh: shouldAutoRefresh(dataSaverSettings),

    // Direct access to settings
    dataSaverSettings,
  };
}

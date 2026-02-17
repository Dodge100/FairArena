import { useDataSaver } from '@/contexts/DataSaverContext';
import { shouldLoadImage } from '@/lib/utils';

interface DataSaverImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

export function DataSaverImage({ fallback, ...props }: DataSaverImageProps) {
  const { dataSaverSettings } = useDataSaver();

  if (!shouldLoadImage(dataSaverSettings)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <img {...props} />;
}

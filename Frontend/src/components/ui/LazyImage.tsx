import { useDataSaver } from '@/contexts/DataSaverContext';
import { cn, shouldLoadImage } from '@/lib/utils';
import { useState } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

export function LazyImage({ className, fallback, alt, src, ...props }: LazyImageProps) {
  const { dataSaverSettings } = useDataSaver();
  const [isLoaded, setIsLoaded] = useState(false);

  if (!shouldLoadImage(dataSaverSettings)) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setIsLoaded(true)}
      className={cn(
        'transition-opacity duration-500',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
      {...props}
    />
  );
}

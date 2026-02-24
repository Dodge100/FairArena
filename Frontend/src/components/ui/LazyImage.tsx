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

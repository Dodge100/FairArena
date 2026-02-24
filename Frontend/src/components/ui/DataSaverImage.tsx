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

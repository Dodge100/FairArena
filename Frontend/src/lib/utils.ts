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

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility function to conditionally apply animation classes based on data saver settings
export function cnWithAnimations(
  dataSaverSettings: { enabled: boolean; reduceAnimations: boolean },
  ...inputs: ClassValue[]
) {
  if (dataSaverSettings.enabled && dataSaverSettings.reduceAnimations) {
    // Filter out animation-related classes when animations are reduced
    const filteredInputs = inputs.map((input) => {
      if (typeof input === 'string') {
        return input
          .split(' ')
          .filter(
            (className) =>
              !className.includes('transition') &&
              !className.includes('animate') &&
              !className.includes('duration') &&
              !className.includes('hover:') &&
              !className.includes('focus:') &&
              !className.includes('motion') &&
              !className.includes('group-hover:'),
          )
          .join(' ');
      }
      return input;
    });
    return twMerge(clsx(filteredInputs));
  }
  return twMerge(clsx(inputs));
}

// Utility function to conditionally render images based on data saver settings
export function shouldLoadImage(dataSaverSettings: { enabled: boolean; disableImages: boolean }) {
  return !(dataSaverSettings.enabled && dataSaverSettings.disableImages);
}

// Utility function to conditionally apply auto-refresh based on data saver settings
export function shouldAutoRefresh(dataSaverSettings: {
  enabled: boolean;
  disableAutoRefresh: boolean;
}) {
  return !(dataSaverSettings.enabled && dataSaverSettings.disableAutoRefresh);
}

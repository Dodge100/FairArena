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

import { useTheme } from '../hooks/useTheme';

export default function DashboardSkeleton() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}>
      {/* Skeleton content */}
      <div className="animate-pulse p-8">
        <div className={`h-8 w-64 rounded-lg mb-8 ${isDark ? 'bg-neutral-800' : 'bg-gray-300'}`} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-32 rounded-xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

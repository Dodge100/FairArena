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

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type AIButtonPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'hidden';

interface AIButtonContextType {
  position: AIButtonPosition;
  setPosition: (position: AIButtonPosition) => void;
}

const AIButtonContext = createContext<AIButtonContextType | null>(null);

interface AIButtonProviderProps {
  children: ReactNode;
}

export function AIButtonProvider({ children }: AIButtonProviderProps) {
  const [position, setPosition] = useState<AIButtonPosition>('top-right');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load position from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('aiButtonPosition');
    if (
      saved &&
      ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'hidden'].includes(saved)
    ) {
      setPosition(saved as AIButtonPosition);
    }
    setIsLoaded(true);
  }, []);

  // Save position to localStorage whenever it changes (only after initial load)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('aiButtonPosition', position);
    }
  }, [position, isLoaded]);

  return (
    <AIButtonContext.Provider
      value={{
        position,
        setPosition,
      }}
    >
      {children}
    </AIButtonContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAIButton() {
  const context = useContext(AIButtonContext);
  if (!context) {
    throw new Error('useAIButton must be used within an AIButtonProvider');
  }
  return context;
}

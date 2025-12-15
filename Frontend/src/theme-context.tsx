import { useEffect, useState, type ReactNode } from 'react';
import { useDataSaver } from './contexts/DataSaverContext';
import { ThemeContext } from './hooks/useTheme';

type Theme = 'light' | 'dark';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { dataSaverSettings } = useDataSaver();

  // Initialize theme from localStorage synchronously to prevent flash
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, then fallback to system preference or "light"
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      // If no stored theme, check system preference
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'light';
  });

  // Effective theme considers data saver settings
  const effectiveTheme = dataSaverSettings.enabled && dataSaverSettings.forceDarkTheme ? 'dark' : theme;

  // Apply theme to <html> when effective theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    // Only save to localStorage if not forced by data saver
    if (!(dataSaverSettings.enabled && dataSaverSettings.forceDarkTheme)) {
      localStorage.setItem('theme', theme);
    }
  }, [effectiveTheme, theme, dataSaverSettings]);

  const toggleTheme = () => {
    // Don't allow toggling if data saver forces dark theme
    if (dataSaverSettings.enabled && dataSaverSettings.forceDarkTheme) {
      return;
    }
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return <ThemeContext.Provider value={{ theme: effectiveTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

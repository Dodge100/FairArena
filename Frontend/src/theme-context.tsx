import { useEffect, useState, type ReactNode } from 'react';
import { useDataSaver } from './contexts/DataSaverContext';
import { ThemeContext } from './hooks/useTheme';

type Theme = 'light' | 'dark' | 'system';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { dataSaverSettings } = useDataSaver();

  // Initialize theme from localStorage synchronously to prevent flash
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    }
    return 'system';
  });

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemTheme(media.matches ? 'dark' : 'light');

    updateSystemTheme(); // Initial check
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  // Effective theme considers data saver settings and system preference
  const effectiveTheme =
    dataSaverSettings.enabled && dataSaverSettings.forceDarkTheme
      ? 'dark'
      : theme === 'system'
        ? systemTheme
        : theme;

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
      if (theme === 'system') {
        localStorage.removeItem('theme'); // Clean storage for system
      } else {
        localStorage.setItem('theme', theme);
      }
    }
  }, [effectiveTheme, theme, dataSaverSettings]);

  const toggleTheme = () => {
    // Don't allow toggling if data saver forces dark theme
    if (dataSaverSettings.enabled && dataSaverSettings.forceDarkTheme) {
      return;
    }
    setTheme((prev) => {
      if (prev === 'system') {
        return systemTheme === 'light' ? 'dark' : 'light';
      }
      return prev === 'light' ? 'dark' : 'light';
    });
  };

  const isDark = effectiveTheme === 'dark';

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme: effectiveTheme,
        isDark,
        toggleTheme,
        setTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

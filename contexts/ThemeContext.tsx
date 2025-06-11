'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'grey' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  systemTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('dark');
  const [isInitialized, setIsInitialized] = useState(false);

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme && ['dark', 'light', 'grey', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme);
      } else {
        // Default to dark mode for the landing page
        setThemeState('dark');
        localStorage.setItem('theme', 'dark');
      }
      setIsInitialized(true);
    }
  }, []);

  // Apply theme to document - only after initialization
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    const root = window.document.documentElement;
    const effectiveTheme = theme === 'system' ? systemTheme : theme;
    
    // Only update if the theme actually changed
    const currentTheme = root.classList.contains('dark') ? 'dark' : 
                        root.classList.contains('light') ? 'light' : 
                        root.classList.contains('grey') ? 'grey' : null;
    
    if (currentTheme !== effectiveTheme) {
      root.classList.remove('light', 'dark', 'grey');
      root.classList.add(effectiveTheme);
    }
  }, [theme, systemTheme, isInitialized]);

  const setTheme = useCallback((newTheme: Theme) => {
    if (newTheme !== theme) {
      setThemeState(newTheme);
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
      }
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, systemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 
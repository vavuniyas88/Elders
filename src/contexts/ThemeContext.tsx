import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'heritage' | 'emerald' | 'royal' | 'dark';

export interface ThemeMeta {
  id: ThemeId;
  nameEn: string;
  nameTa: string;
  primaryHex: string;
  secondaryHex: string;
  isDark: boolean;
}

export const THEME_OPTIONS: ThemeMeta[] = [
  {
    id: 'heritage',
    nameEn: 'Manthai Heritage',
    nameTa: 'மாந்தை பாரம்பரியம்',
    primaryHex: '#0F3D6E',
    secondaryHex: '#9E2232',
    isDark: false,
  },
  {
    id: 'emerald',
    nameEn: 'Mannar Emerald',
    nameTa: 'மன்னார் பசுமை',
    primaryHex: '#0F766E',
    secondaryHex: '#B4842C',
    isDark: false,
  },
  {
    id: 'royal',
    nameEn: 'Civic Sapphire',
    nameTa: 'அரச நீலம்',
    primaryHex: '#1D4ED8',
    secondaryHex: '#334155',
    isDark: false,
  },
  {
    id: 'dark',
    nameEn: 'Midnight Executive',
    nameTa: 'இரவுப் பயன்முறை',
    primaryHex: '#3B82F6',
    secondaryHex: '#C49A45',
    isDark: true,
  },
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  activeThemeMeta: ThemeMeta;
}

const STORAGE_KEY = 'mw_ecms_theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'heritage';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (
    saved === 'heritage' ||
    saved === 'emerald' ||
    saved === 'royal' ||
    saved === 'dark'
  ) {
    return saved;
  }
  return 'heritage';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);

  const setTheme = (next: ThemeId) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const activeThemeMeta =
    THEME_OPTIONS.find((opt) => opt.id === theme) ?? THEME_OPTIONS[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, activeThemeMeta }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}

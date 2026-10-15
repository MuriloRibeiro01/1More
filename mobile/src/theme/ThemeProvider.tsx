import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, type ThemeName } from './theme';
import type { ThemeColors } from './text';

/** `system` segue o aparelho; `light` = Papel, `dark` = Noite (RF-72). */
export type ThemePreference = 'system' | ThemeName;

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

interface ThemeContextValue {
  theme: ThemeName;
  colors: ThemeColors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initialPreference?: ThemePreference;
  /** Chamado a cada troca manual, para persistir a escolha. */
  onPreferenceChange?: (preference: ThemePreference) => void;
}

export function ThemeProvider({ children, initialPreference = 'system', onPreferenceChange }: ThemeProviderProps) {
  const scheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      onPreferenceChange?.(next);
    },
    [onPreferenceChange],
  );

  // Papel é o padrão: só vira Noite quando o sistema diz explicitamente "dark".
  const theme: ThemeName = preference === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ theme, colors: colors[theme], preference, setPreference }),
    [theme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return ctx;
}

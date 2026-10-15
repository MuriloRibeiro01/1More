import './i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { DefaultTheme, NavigationContainer, type Theme as NavigationTheme } from '@react-navigation/native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { database } from './db';
import { loadThemePreference, saveThemePreference } from './db/preferences';
import { RootTabs } from './navigation/RootTabs';
import { ThemeProvider, useOneMoreFonts, useTheme, type ThemePreference } from './theme';

void SplashScreen.preventAutoHideAsync();

function ThemedNavigation() {
  const { theme, colors: c } = useTheme();

  const navigationTheme = useMemo<NavigationTheme>(
    () => ({
      ...DefaultTheme,
      dark: theme === 'dark',
      colors: {
        primary: c.ink,
        background: c.paper,
        card: c.paperRaised,
        text: c.ink,
        border: c.line,
        notification: c.hugger,
      },
    }),
    [theme, c],
  );

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.paper);
  }, [c.paper]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <RootTabs />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useOneMoreFonts();
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    let alive = true;
    void loadThemePreference(database).then((p) => alive && setPreference(p));
    return () => {
      alive = false;
    };
  }, []);

  const persistPreference = useCallback((p: ThemePreference) => void saveThemePreference(database, p), []);

  // Fontes vêm embarcadas no bundle (nunca da rede). Se falharem, segue com a fonte do sistema.
  const ready = (fontsLoaded || !!fontError) && preference !== null;

  useEffect(() => {
    if (fontError) console.warn('[fonts] falha ao carregar fontes', fontError);
  }, [fontError]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <DatabaseProvider database={database}>
        <ThemeProvider initialPreference={preference} onPreferenceChange={persistPreference}>
          <ThemedNavigation />
        </ThemeProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

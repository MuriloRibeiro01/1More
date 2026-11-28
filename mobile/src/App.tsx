import './i18n';
import { purgeExpiredTombstones } from './db/purge';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { DefaultTheme, NavigationContainer, type Theme as NavigationTheme } from '@react-navigation/native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { database } from './db';
import { loadThemePreference, saveThemePreference } from './db/preferences';
import { seedCatalog } from './routines/repository';
import { RootNavigator } from './navigation/RootNavigator';
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
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useOneMoreFonts();
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    let alive = true;
    // Catálogo embarcado antes da 1ª tela (idempotente). Falha não impede o app de abrir.
    const seeded = seedCatalog(database).catch((error) => console.error('[db] falha ao semear o catálogo', error));
    void Promise.all([loadThemePreference(database), seeded]).then(([p]) => alive && setPreference(p));
    return () => {
      alive = false;
    };
  }, []);

  // RN-20: expurga tombstones com 30 dias ou mais, DEPOIS da primeira tela (nunca segura a abertura; falha é só log).
  // T-003: quando houver sync, só expurgar o tombstone depois que o servidor o confirmar (RN-21);
  // um aparelho offline por 30+ dias não pode perdê-lo antes de propagar.
  useEffect(() => {
    if (preference === null) return;
    const timer = setTimeout(() => {
      void purgeExpiredTombstones(database).catch((error) => console.error('[db] falha ao expurgar tombstones', error));
    }, 300);
    return () => clearTimeout(timer);
  }, [preference]);

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

import { localStorageKey } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import { isThemePreference, type ThemePreference } from '../theme/ThemeProvider';

// Preferências só do aparelho, no LocalStorage do próprio WatermelonDB (não sincroniza).
// Quando user_settings chegar ao app, o tema passa a sincronizar com o domínio do backend:
// system → 'sistema', light → 'papel', dark → 'noite' (V1__baseline.sql).
const THEME_KEY = localStorageKey<string>('theme_preference');

export async function loadThemePreference(db: Database): Promise<ThemePreference> {
  try {
    const value = await db.localStorage.get(THEME_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    // Falha de leitura nunca impede o app de abrir: volta para o padrão.
    return 'system';
  }
}

export async function saveThemePreference(db: Database, preference: ThemePreference): Promise<void> {
  try {
    await db.localStorage.set(THEME_KEY, preference);
  } catch (error) {
    console.warn('[db] não foi possível salvar o tema', error);
  }
}

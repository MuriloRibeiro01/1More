import type { TextStyle } from 'react-native';
import { colors, type } from './theme';

// Adaptadores de tipo para o theme.ts gerado (que fica intocado):
// - `as const` deixa cada tema com hex literais, então Papel e Noite não cabem no mesmo tipo;
// - `fontVariant` sai como tupla readonly, que o TextStyle do RN não aceita.

/** Paleta de um tema qualquer (mesmas chaves, valores string). */
export type ThemeColors = { readonly [K in keyof typeof colors.light]: string };

export type TypeToken = keyof typeof type;

/** Estilos de texto do Design System prontos para StyleSheet: `text.label`, `text.numMd`… */
export const text = Object.fromEntries(
  Object.entries(type).map(([name, style]) => [
    name,
    'fontVariant' in style ? { ...style, fontVariant: [...style.fontVariant] } : style,
  ]),
) as Record<TypeToken, TextStyle>;

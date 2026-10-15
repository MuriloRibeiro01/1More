import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, type ThemePreference } from '../src/theme';

const METRICAS = {
  frame: { x: 0, y: 0, width: 393, height: 851 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

export function renderComTema(ui: ReactElement, preference: ThemePreference = 'light', options?: RenderOptions) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider initialPreference={preference}>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

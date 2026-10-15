import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { act, renderHook } from '@testing-library/react-native';
import { colors, isThemePreference, ThemeProvider, useTheme, type ThemePreference } from '../src/theme';

// expo-font importa expo-asset, que não é resolvível no node_modules atual (achado do T-001); fontes não importam aqui.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

type Esquema = 'light' | 'dark' | null | undefined;
const useColorScheme = jest.requireMock<{ default: Mock<() => Esquema> }>(
  'react-native/Libraries/Utilities/useColorScheme',
).default;

type ProviderProps = { initialPreference?: ThemePreference; onPreferenceChange?: (p: ThemePreference) => void };

function montar(props: ProviderProps = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider {...props}>{children}</ThemeProvider>;
  return renderHook(() => useTheme(), { wrapper });
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    useColorScheme.mockReturnValue(null);
  });

  it('Papel é o padrão quando o sistema não informa esquema', async () => {
    const { result } = await montar();
    expect(result.current.preference).toBe('system');
    expect(result.current.theme).toBe('light');
    expect(result.current.colors).toEqual(colors.light);
  });

  it.each<[Esquema, 'light' | 'dark']>([
    ['dark', 'dark'],
    ['light', 'light'],
    [null, 'light'],
    [undefined, 'light'],
  ])('system segue useColorScheme: %p → %s', async (scheme, esperado) => {
    useColorScheme.mockReturnValue(scheme);
    const { result } = await montar({ initialPreference: 'system' });
    expect(result.current.theme).toBe(esperado);
  });

  it('system reage quando o aparelho troca de esquema', async () => {
    const { result, rerender } = await montar();
    expect(result.current.theme).toBe('light');
    useColorScheme.mockReturnValue('dark');
    await rerender(undefined);
    expect(result.current.theme).toBe('dark');
    expect(result.current.colors).toEqual(colors.dark);
  });

  it('escolha manual ignora o sistema', async () => {
    useColorScheme.mockReturnValue('dark');
    expect((await montar({ initialPreference: 'light' })).result.current.theme).toBe('light');
    useColorScheme.mockReturnValue('light');
    const { result } = await montar({ initialPreference: 'dark' });
    expect(result.current.theme).toBe('dark');
    expect(result.current.colors).toEqual(colors.dark);
  });

  it('setPreference troca o tema e chama onPreferenceChange para persistir', async () => {
    const onPreferenceChange = jest.fn<(p: ThemePreference) => void>();
    const { result } = await montar({ onPreferenceChange });

    await act(() => result.current.setPreference('dark'));
    expect(result.current.theme).toBe('dark');
    expect(result.current.preference).toBe('dark');
    expect(onPreferenceChange).toHaveBeenLastCalledWith('dark');

    await act(() => result.current.setPreference('system'));
    expect(result.current.theme).toBe('light');
    expect(onPreferenceChange).toHaveBeenLastCalledWith('system');
    expect(onPreferenceChange).toHaveBeenCalledTimes(2);
  });

  it('não chama onPreferenceChange só por montar', async () => {
    const onPreferenceChange = jest.fn<(p: ThemePreference) => void>();
    await montar({ initialPreference: 'dark', onPreferenceChange });
    expect(onPreferenceChange).not.toHaveBeenCalled();
  });

  it('useTheme fora do provider dá erro claro', async () => {
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useTheme())).rejects.toThrow(/ThemeProvider/);
    silencio.mockRestore();
  });

  it('isThemePreference aceita só system/light/dark', () => {
    expect(['system', 'light', 'dark'].every(isThemePreference)).toBe(true);
    expect([null, undefined, 'papel', 'noite', 1, 'Light'].some(isThemePreference)).toBe(false);
  });
});

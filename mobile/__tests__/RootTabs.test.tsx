import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import i18n from '../src/i18n';
import { ICON_PATHS } from '../src/components';
import { RootTabs } from '../src/navigation/RootTabs';
import type { ThemePreference } from '../src/theme';
import { renderComTema } from '../test-utils/render';

// expo-font importa expo-asset, que não é resolvível no node_modules atual (achado do T-001); fontes não importam aqui.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

function montar(preference: ThemePreference = 'light') {
  return renderComTema(
    <NavigationContainer>
      <RootTabs />
    </NavigationContainer>,
    preference,
  );
}

/** d do Path de cada ícone dentro da aba (o Icon do pacote oficial desenha um único Path). */
function iconeDaAba(nome: string): string | undefined {
  const aba = screen.getByRole('tab', { name: nome });
  const caminhos: string[] = [];
  const visitar = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (typeof n.props?.d === 'string') caminhos.push(n.props.d);
    (n.children ?? []).forEach(visitar);
  };
  visitar(aba);
  return caminhos[0];
}

describe('RootTabs (RNF-08)', () => {
  beforeAll(() => i18n.changeLanguage('pt-BR'));

  it('4 abas fixas na ordem Treinar · Histórico · Progresso · Perfil', async () => {
    await montar();
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(4));
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual([
      'Treinar',
      'Histórico',
      'Progresso',
      'Perfil',
    ]);
  });

  it('ícones notebook · calendar · chart · user', async () => {
    await montar();
    await screen.findAllByRole('tab');
    expect(iconeDaAba('Treinar')).toBe(ICON_PATHS.notebook);
    expect(iconeDaAba('Histórico')).toBe(ICON_PATHS.calendar);
    expect(iconeDaAba('Progresso')).toBe(ICON_PATHS.chart);
    expect(iconeDaAba('Perfil')).toBe(ICON_PATHS.user);
  });

  it('abre em Treinar, com TopBar e kicker de data', async () => {
    await montar();
    expect(await screen.findByRole('header', { name: 'Treinar' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Treinar' })).toBeSelected();
    expect(screen.getByText(/^[A-ZÁÉÍÓÚÇ]{3} · \d{1,2} [A-Z]{3}$/)).toBeOnTheScreen();
  });

  it.each(['Histórico', 'Progresso', 'Perfil'])('tocar em %s navega e marca a aba', async (nome) => {
    await montar();
    await fireEvent.press(await screen.findByRole('tab', { name: nome }));
    expect(await screen.findByRole('header', { name: nome })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: nome })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Treinar' })).not.toBeSelected();
  });

  it('Perfil troca o tema: Noite fica marcado e o anterior desmarca', async () => {
    await montar('system');
    await fireEvent.press(await screen.findByRole('tab', { name: 'Perfil' }));
    const sistema = await screen.findByRole('radio', { name: 'Sistema' });
    expect(sistema).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Noite' }));
    expect(screen.getByRole('radio', { name: 'Noite' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sistema' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Papel' })).not.toBeChecked();
  });

  it('em inglês os rótulos mudam mas a ordem não', async () => {
    await i18n.changeLanguage('en');
    await montar();
    await screen.findAllByRole('tab');
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual([
      'Train',
      'History',
      'Progress',
      'Profile',
    ]);
    // Volta o idioma dentro de act: a tela ainda está montada.
    await act(() => i18n.changeLanguage('pt-BR'));
  });
});

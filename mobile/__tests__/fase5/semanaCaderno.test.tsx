import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { screen, within } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { SemanaCaderno } from '../../src/components';
import { colors } from '../../src/theme';
import { renderComTema } from '../../test-utils/render';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

beforeAll(() => i18n.changeLanguage('pt-BR'));

// Quarta 11/nov/2026, hora local. Treinos: segunda 9 e quarta 11 (início em hora local, com o fuso do próprio instante).
const quarta = new Date(2026, 10, 11, 12);
const treino = (dia: number) => {
  const d = new Date(2026, 10, dia, 10);
  return { startedAt: d.getTime(), tzOffsetMin: -d.getTimezoneOffset() };
};
const dias = () => screen.getAllByTestId(/^dia-\d$/);

describe('SemanaCaderno', () => {
  it('7 dias, segunda primeiro, letra de cada dia no idioma ativo', async () => {
    await renderComTema(<SemanaCaderno now={quarta} workouts={[]} />);
    expect(dias()).toHaveLength(7);
    expect(dias().map((d) => within(d).getByTestId('dia-letra').props.children)).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
    expect(dias().map((d) => d.props.accessibilityLabel.split(',')[0])).toEqual([
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
      'domingo',
    ]);
  });

  it('dia treinado fica marcado à caneta (caixa de tinta de 2px, raio ≤ 4) e selected; os outros não', async () => {
    await renderComTema(<SemanaCaderno now={quarta} workouts={[treino(9), treino(11)]} />);
    const marcados = dias().map((d) => within(d).queryByTestId('dia-treinado'));
    expect(marcados.map((m) => m !== null)).toEqual([true, false, true, false, false, false, false]);
    expect(estilo(marcados[0]!)).toMatchObject({ borderWidth: 2, borderColor: colors.light.ink });
    expect(estilo(marcados[0]!).borderRadius as number).toBeLessThanOrEqual(4);
    expect(dias().map((d) => d.props.accessibilityState?.selected)).toEqual([true, false, true, false, false, false, false]);
  });

  it('só hoje tem o grifo laranja (hugger) de 3px e o rótulo diz "hoje"', async () => {
    await renderComTema(<SemanaCaderno now={quarta} workouts={[]} />);
    const grifos = dias().map((d) => within(d).queryByTestId('dia-hoje', { includeHiddenElements: true }));
    expect(grifos.map((g) => g !== null)).toEqual([false, false, true, false, false, false, false]);
    expect(estilo(grifos[2]!)).toMatchObject({ height: 3, backgroundColor: colors.light.hugger });
    expect(dias()[2].props.accessibilityLabel).toBe('quarta-feira, hoje');
  });

  it('treino de outra semana ou no domingo anterior não marca nada', async () => {
    await renderComTema(<SemanaCaderno now={quarta} workouts={[treino(8), treino(16)]} />);
    expect(screen.queryByTestId('dia-treinado')).toBeNull();
  });

  it('usa o fuso gravado no treino: 23h locais não "pulam" para o dia seguinte', async () => {
    const tardeDaNoite = { startedAt: Date.UTC(2026, 10, 10, 2, 30), tzOffsetMin: -180 }; // 9/nov 23:30 em UTC-3
    await renderComTema(<SemanaCaderno now={quarta} workouts={[tardeDaNoite]} />);
    expect(dias().map((d) => within(d).queryByTestId('dia-treinado') !== null)).toEqual([true, false, false, false, false, false, false]);
  });
});

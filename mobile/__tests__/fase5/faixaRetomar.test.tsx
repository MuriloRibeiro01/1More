import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { FaixaRetomar } from '../../src/components';
import { colors } from '../../src/theme';
import { renderComTema } from '../../test-utils/render';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

beforeAll(() => i18n.changeLanguage('pt-BR'));

describe('FaixaRetomar', () => {
  it('faixa amarela (stripeWash) em botão de ≥ 48dp que dispara onPress', async () => {
    const onPress = jest.fn();
    await renderComTema(<FaixaRetomar onPress={onPress} />);
    const faixa = screen.getByRole('button', { name: 'Treino em andamento · Retomar' });
    expect(estilo(faixa)).toMatchObject({ backgroundColor: colors.light.stripeWash });
    expect(estilo(faixa).minHeight as number).toBeGreaterThanOrEqual(48);
    await fireEvent.press(faixa);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Noite usa o stripeWash do tema escuro', async () => {
    await renderComTema(<FaixaRetomar onPress={() => {}} />, 'dark');
    expect(estilo(screen.getByRole('button')).backgroundColor).toBe(colors.dark.stripeWash);
  });

  it('esquecido (RN-04) troca o texto para "Esqueceu de finalizar?"', async () => {
    await renderComTema(<FaixaRetomar forgotten onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Esqueceu de finalizar?' })).toBeOnTheScreen();
    expect(screen.queryByText(/Retomar/)).toBeNull();
  });
});

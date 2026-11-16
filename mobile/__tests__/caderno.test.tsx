import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../src/i18n';
import { Button, Caixinha, CarimboPR, Folha, Linha, LinkCaneta, LivroCaixa, Titulo } from '../src/components';
import { colors, size } from '../src/theme';
import { renderComTema } from '../test-utils/render';

// Primitivas do estilo caderno (Fase 1): linhas com pauta própria, margem fixa, destaque e carimbos.

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const ESCONDIDO = { includeHiddenElements: true };
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

beforeAll(() => i18n.changeLanguage('pt-BR'));

describe('Folha', () => {
  it('papel de fundo e só a linha de margem a 44px, escondida do leitor de tela', async () => {
    await renderComTema(<Folha><Text>Conteúdo</Text></Folha>, 'dark');
    const margem = screen.getByTestId('folha-margem', ESCONDIDO);
    expect(estilo(margem)).toMatchObject({ position: 'absolute', left: size.sizeMargin, width: 2, backgroundColor: colors.dark.marginLine });
    expect(margem.props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByText('Conteúdo')).toBeOnTheScreen();
  });
});

describe('Linha', () => {
  it('desenha o próprio sublinhado de 1px na cor rule e mostra a margem', async () => {
    await renderComTema(<Linha margem={<Text>1</Text>}><Text>80 × 10</Text></Linha>);
    const s = estilo(screen.getByText('80 × 10').parent!.parent!);
    expect(s).toMatchObject({ borderBottomWidth: 1, borderBottomColor: colors.light.rule, minHeight: size.sizeRule });
    expect(screen.getByText('1')).toBeOnTheScreen();
  });

  it('tocável: botão de 56px (duas pautas) que dispara onPress', async () => {
    const onPress = jest.fn();
    await renderComTema(<Linha onPress={onPress} accessibilityLabel="Treino A"><Text>A</Text></Linha>);
    const linha = screen.getByRole('button', { name: 'Treino A' });
    expect(estilo(linha).minHeight).toBe(size.sizeRow);
    await fireEvent.press(linha);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('destaque pinta a faixa amarela (stripeWash) nos dois temas', async () => {
    const { unmount } = await renderComTema(<Linha destaque accessibilityLabel="Série da vez" onPress={() => {}} />, 'light');
    expect(estilo(screen.getByRole('button')).backgroundColor).toBe(colors.light.stripeWash);
    await unmount();
    await renderComTema(<Linha destaque accessibilityLabel="Série da vez" onPress={() => {}} />, 'dark');
    expect(estilo(screen.getByRole('button')).backgroundColor).toBe(colors.dark.stripeWash);
  });
});

describe('Titulo', () => {
  it('header em caixa alta com grifo hugger de 3px', async () => {
    await renderComTema(<Titulo>Treinar</Titulo>);
    expect(screen.getByRole('header', { name: 'Treinar' })).toBeOnTheScreen();
    expect(estilo(screen.getByTestId('titulo-grifo', ESCONDIDO))).toMatchObject({ height: 3, backgroundColor: colors.light.hugger });
  });

  it('variante exercício usa régua de tinta de 2px; compact aceita 2 linhas', async () => {
    await renderComTema(<Titulo variante="exercicio" tamanho="compact">Supino reto</Titulo>);
    expect(screen.getByRole('header').props.numberOfLines).toBe(2);
    expect(estilo(screen.getByTestId('titulo-grifo', ESCONDIDO))).toMatchObject({ height: 2, backgroundColor: colors.light.ink });
  });
});

describe('LinkCaneta', () => {
  it('link sublinhado, alvo ≥ 48dp, dispara onPress', async () => {
    const onPress = jest.fn();
    await renderComTema(<LinkCaneta onPress={onPress}>Editar rotinas</LinkCaneta>);
    const link = screen.getByRole('button', { name: 'Editar rotinas' });
    expect(estilo(link).minHeight as number).toBeGreaterThanOrEqual(48);
    expect(estilo(screen.getByText('Editar rotinas')).textDecorationLine).toBe('underline');
    await fireEvent.press(link);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('desabilitado não dispara e expõe o estado', async () => {
    const onPress = jest.fn();
    await renderComTema(<LinkCaneta disabled onPress={onPress}>Excluir</LinkCaneta>);
    const link = screen.getByRole('button', { name: 'Excluir' });
    expect(link).toBeDisabled();
    await fireEvent.press(link);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Caixinha', () => {
  it('checkbox com estado e alvo de 48dp; alterna pelo toque', async () => {
    const onChange = jest.fn();
    await renderComTema(<Caixinha checked={false} label="Série 2" onChange={onChange} />);
    const caixa = screen.getByRole('checkbox', { name: 'Série 2' });
    expect(caixa).not.toBeChecked();
    expect(estilo(caixa)).toMatchObject({ minWidth: 48, minHeight: 48 });
    await fireEvent.press(caixa);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('marcada preenche com Grabber e toque desmarca; desabilitada não dispara', async () => {
    const onChange = jest.fn();
    const { unmount } = await renderComTema(<Caixinha checked label="Série 1" onChange={onChange} />);
    const caixa = screen.getByRole('checkbox', { name: 'Série 1' });
    expect(caixa).toBeChecked();
    await fireEvent.press(caixa);
    expect(onChange).toHaveBeenCalledWith(false);
    await unmount();
    const off = jest.fn();
    await renderComTema(<Caixinha checked={false} disabled label="Série 3" onChange={off} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Série 3' }));
    expect(off).not.toHaveBeenCalled();
  });
});

describe('CarimboPR e LivroCaixa', () => {
  it('carimbo PR tem rótulo acessível "Recorde pessoal"', async () => {
    await renderComTema(<CarimboPR />);
    expect(screen.getByLabelText('Recorde pessoal')).toBeOnTheScreen();
    expect(screen.getByText('PR')).toBeOnTheScreen();
  });

  it('livro-caixa lê "rótulo: valor" e os pontos ficam só no desenho', async () => {
    await renderComTema(<LivroCaixa rotulo="Volume" valor="12.340 kg" />);
    expect(screen.getByLabelText('Volume: 12.340 kg')).toBeOnTheScreen();
    expect(screen.getByText('12.340 kg')).toBeOnTheScreen();
  });
});

describe('Button sem caixa', () => {
  it('só o primary tem fundo de tinta; secundário é texto sublinhado, sem contorno', async () => {
    await renderComTema(<Button>Cancelar</Button>);
    expect(estilo(screen.getByRole('button')).borderColor).toBe('transparent');
    expect(estilo(screen.getByText('Cancelar')).textDecorationLine).toBe('underline');
  });
});

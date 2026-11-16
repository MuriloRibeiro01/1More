import { describe, expect, it, jest } from '@jest/globals';
import { processColor } from 'react-native';
import { screen } from '@testing-library/react-native';
import { GraficoCaderno } from '../../src/components';
import { colors } from '../../src/theme';
import { renderComTema } from '../../test-utils/render';

// Gráfico desenhado direto na folha: sem moldura, sem grade; o recorde em laranja (hugger).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

// react-native-svg entrega a cor já processada ({ type, payload }): compara com a mesma conversão.
const cor = (hex: string) => ({ type: 0, payload: processColor(hex) });

type No = { type?: string; props?: Record<string, unknown>; children?: No[] | string[] };
function achar(no: unknown, filtro: (n: No) => boolean, acc: No[] = []): No[] {
  if (!no || typeof no !== 'object') return acc;
  const n = no as No;
  if (filtro(n)) acc.push(n);
  (n.children ?? []).forEach((f) => achar(f, filtro, acc));
  return acc;
}

const pontos = [
  { x: 0, y: 80, record: false },
  { x: 10, y: 90, record: true },
  { x: 20, y: 85, record: false },
  { x: 30, y: 95, record: true },
];

describe('GraficoCaderno', () => {
  it('uma linha de tinta ligando os pontos e um círculo por ponto; recordes em laranja e maiores', async () => {
    const { toJSON } = await renderComTema(<GraficoCaderno points={pontos} label="1RM de Supino: 4 treinos" />);
    const arvore = toJSON();
    const circulos = achar(arvore, (n) => typeof n.props?.cx !== 'undefined');
    expect(circulos).toHaveLength(4);
    const fills = circulos.map((c) => c.props!.fill);
    expect(fills).toEqual([cor(colors.light.ink), cor(colors.light.hugger), cor(colors.light.ink), cor(colors.light.hugger)]);
    expect(Number(circulos[1].props!.r)).toBeGreaterThan(Number(circulos[0].props!.r));
    const caminhos = achar(arvore, (n) => typeof n.props?.d === 'string');
    expect(caminhos).toHaveLength(1);
    expect(String(caminhos[0].props!.d).match(/L/g)).toHaveLength(3);
  });

  it('sem moldura nem grade: nenhum retângulo e nenhuma linha extra', async () => {
    const { toJSON } = await renderComTema(<GraficoCaderno points={pontos} label="x" />);
    expect(achar(toJSON(), (n) => typeof n.props?.width !== 'undefined' && typeof n.props?.x !== 'undefined' && typeof n.props?.y !== 'undefined')).toEqual([]);
    expect(achar(toJSON(), (n) => typeof n.props?.x1 !== 'undefined')).toEqual([]);
  });

  it('é uma imagem para o leitor de tela, com o rótulo recebido', async () => {
    await renderComTema(<GraficoCaderno points={pontos} label="1RM de Supino: 4 treinos, último 95 kg" />);
    expect(screen.getByRole('image', { name: '1RM de Supino: 4 treinos, último 95 kg' })).toBeOnTheScreen();
  });

  it('um ponto só desenha o círculo e nenhuma linha', async () => {
    const { toJSON } = await renderComTema(<GraficoCaderno points={[{ x: 1, y: 5, record: false }]} label="x" />);
    expect(achar(toJSON(), (n) => typeof n.props?.cx !== 'undefined')).toHaveLength(1);
    expect(achar(toJSON(), (n) => typeof n.props?.d === 'string')).toEqual([]);
  });

  it('no tema Noite usa as cores do tema escuro', async () => {
    const { toJSON } = await renderComTema(<GraficoCaderno points={pontos} label="x" />, 'dark');
    const fills = achar(toJSON(), (n) => typeof n.props?.cx !== 'undefined').map((c) => c.props!.fill);
    expect(fills[0]).toEqual(cor(colors.dark.ink));
    expect(fills[1]).toEqual(cor(colors.dark.hugger));
  });
});

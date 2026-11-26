import { describe, expect, it, jest } from '@jest/globals';
import { useState } from 'react';
import { Platform } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { ExercisePickerScreen } from '../../src/screens/ExercisePickerScreen';
import { NumberField } from '../../src/components';
import { renderComTema } from '../../test-utils/render';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('../../src/navigation/useFocusedBackHandler', () => ({ useFocusedBackHandler: () => undefined }));

type No = { props: Record<string, unknown>; children: unknown[] };
/** Acha o SafeAreaView (único host com a prop `edges`) percorrendo a árvore renderizada. */
function bordaInferiorDaTela(): unknown {
  const visita = (n: unknown): unknown => {
    if (typeof n !== 'object' || n === null) return undefined;
    const no = n as No;
    if (no.props?.edges) return no.props.edges;
    for (const f of no.children ?? []) {
      const r = visita(f);
      if (r) return r;
    }
    return undefined;
  };
  return (visita(screen.root) as Record<string, string> | undefined)?.bottom;
}

describe('botão fixo embaixo não fica atrás da barra de navegação do Android', () => {
  it('seletor de exercícios respeita a borda inferior (botão ADICIONAR)', async () => {
    await renderComTema(<ExercisePickerScreen catalog={[]} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(bordaInferiorDaTela()).toBe('additive');
  });
});

describe('NumberField: seleção só no foco, nunca controlada (senão o 2º dígito substitui o 1º no Android)', () => {
  const campo = () => screen.getByLabelText('Carga');

  it('campo vazio: foco e digitação dígito a dígito (1, 12, 120) nunca prendem uma seleção controlada', async () => {
    function Controlado() {
      const [v, setV] = useState('');
      return <NumberField label="Carga" value={v} onChange={setV} />;
    }
    await renderComTema(<Controlado />);
    await fireEvent(campo(), 'focus');
    expect(campo().props.selection).toBeUndefined();
    for (const parcial of ['1', '12', '120']) {
      await fireEvent.changeText(campo(), parcial);
      expect(campo().props.selection).toBeUndefined();
    }
    expect(campo().props.value).toBe('120');
  });

  it('campo com valor: foco não deixa seleção controlada', async () => {
    await renderComTema(<NumberField label="Carga" value="82,5" onChange={() => undefined} />);
    await fireEvent(campo(), 'focus');
    expect(campo().props.selection).toBeUndefined();
  });

  it.each([
    ['android', false],
    ['ios', true],
  ])('selectTextOnFocus no %s = %s (no Android re-seleciona tudo a cada eco do valor)', async (os, esperado) => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
    try {
      await renderComTema(<NumberField label="Carga" value="" onChange={() => undefined} />);
      expect(campo().props.selectTextOnFocus).toBe(esperado);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true, writable: true });
    }
  });
});

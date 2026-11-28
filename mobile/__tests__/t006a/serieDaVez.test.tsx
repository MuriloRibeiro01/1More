import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { Linha } from '../../src/components';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { startWorkout } from '../../src/workout/repository';
import { colors } from '../../src/theme';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a, item 1 (C13), decisão do PO (2026-11-26): UMA única faixa amarela (`Linha destaque`, stripeWash) no treino
// inteiro, na primeira série pendente em ordem de exercício e de série; ao concluí-la a faixa passa para a seguinte,
// inclusive para o próximo exercício; sem pendentes, nenhuma faixa.
// Texto na faixa: número da série, unidade e × em tinta; os valores da sessão anterior continuam a lápis (dica),
// salvo se o contraste do lápis sobre stripeWash ficar abaixo de 4,5:1 no tema: aí, só nessa linha, passam para tinta.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const AGACHAMENTO = 'Agachamento livre';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
type Tema = 'light' | 'dark';
let db: Database;
let workoutId: string;

function montar(tema: Tema = 'light') {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ActiveWorkout', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
    tema,
  );
}

type Serie = [number, string];
const S1: Serie = [1, SUPINO];
const S2: Serie = [2, SUPINO];
const A1: Serie = [1, AGACHAMENTO];
const A2: Serie = [2, AGACHAMENTO];
const todas: Serie[] = [S1, S2, A1, A2];

const caixa = ([n, nome]: Serie) => screen.findByRole('checkbox', { name: `Série ${n} de ${nome}` });
const corDe = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as { color?: string }).color;

/** A linha (elemento) sobre a faixa stripeWash que contém a caixinha da série, ou null. Sobe pela árvore. */
function linhaComFaixa([n, nome]: Serie, cores: string[] = [colors.light.stripeWash, colors.dark.stripeWash]) {
  let no: { props: { style?: unknown }; parent: unknown } | null = screen.getByRole('checkbox', { name: `Série ${n} de ${nome}` });
  while (no) {
    const fundo = (StyleSheet.flatten(no.props?.style as never) as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (fundo && cores.includes(fundo)) return no;
    no = no.parent as typeof no;
  }
  return null;
}
const comFaixa = () => todas.filter((s) => linhaComFaixa(s)).map(([n, nome]) => `${n}${nome === SUPINO ? 'S' : 'A'}`);

/** Razão de contraste WCAG entre duas cores #rrggbb. */
function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  const id = (n: string) => cat.find((e) => e.name === n)!.id;
  const rotina = await saveRoutine(db, {
    name: 'A',
    exercises: [
      { exerciseId: id(SUPINO), sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
      { exerciseId: id(AGACHAMENTO), sets: 2, weightKg: 100, repsMin: null, repsMax: 5, restSeconds: 120 },
    ],
  });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('controle da sonda', () => {
  it('uma Linha com destaque é detectada (a sonda enxerga a faixa quando ela existe)', async () => {
    await renderComTema(
      <Linha destaque>
        <Text accessibilityRole="checkbox" accessibilityLabel={`Série 1 de ${SUPINO}`}>
          x
        </Text>
      </Linha>,
    );
    expect(linhaComFaixa(S1)).not.toBeNull();
  });
});

describe('série da vez: uma só faixa no treino inteiro (C13)', () => {
  it('4 séries pendentes em 2 exercícios: só a 1ª série do 1º exercício tem faixa', async () => {
    await montar();
    await caixa(S1);
    expect(comFaixa()).toEqual(['1S']);
  });

  it('ao concluir, a faixa anda: 2ª do supino → 1ª do agachamento (passa de exercício) → 2ª do agachamento', async () => {
    await montar();
    await fireEvent.press(await caixa(S1));
    expect(comFaixa()).toEqual(['2S']);
    await fireEvent.press(await caixa(S2));
    expect(comFaixa()).toEqual(['1A']);
    await fireEvent.press(await caixa(A1));
    expect(comFaixa()).toEqual(['2A']);
  });

  it('sem pendentes, nenhuma faixa', async () => {
    await montar();
    for (const s of todas) await fireEvent.press(await caixa(s));
    expect(comFaixa()).toEqual([]);
  });

  it('desmarcar uma série anterior devolve a faixa para ela (volta a ser a primeira pendente)', async () => {
    await montar();
    await fireEvent.press(await caixa(S1));
    await fireEvent.press(await caixa(S2));
    await fireEvent.press(await caixa(S1)); // desmarca
    expect(comFaixa()).toEqual(['1S']);
  });

  it('a faixa não pula: concluir a série do agachamento com o supino pendente mantém a faixa no supino', async () => {
    await montar();
    await fireEvent.press(await caixa(A1));
    expect(comFaixa()).toEqual(['1S']);
  });

  it('no tema Noite a faixa usa o stripeWash do tema escuro', async () => {
    await montar('dark');
    await caixa(S1);
    expect(linhaComFaixa(S1, [colors.dark.stripeWash])).not.toBeNull();
    expect(linhaComFaixa(S1, [colors.light.stripeWash])).toBeNull();
  });
});

describe('texto na faixa: tinta × lápis', () => {
  it.each(['light', 'dark'] as const)('tema %s: número da série, unidade e × em tinta na linha da faixa', async (tema) => {
    await montar(tema);
    await caixa(S1);
    const linha = linhaComFaixa(S1)!;
    expect(linha).not.toBeNull();
    const ink = colors[tema].ink;
    expect(corDe(within(linha as never).getByText('1'))).toBe(ink); // número da série na margem
    expect(corDe(within(linha as never).getByText('kg'))).toBe(ink);
    expect(corDe(within(linha as never).getByText('×'))).toBe(ink);
  });

  it.each(['light', 'dark'] as const)(
    'tema %s: valores a lápis continuam a lápis, a menos que o contraste sobre a faixa fique abaixo de 4,5:1 (aí viram tinta)',
    async (tema) => {
      await montar(tema);
      await caixa(S1);
      const linha = linhaComFaixa(S1)!;
      expect(linha).not.toBeNull();
      const t = colors[tema];
      const esperado = contraste(t.inkMuted, t.stripeWash) >= 4.5 ? t.inkMuted : t.ink;
      expect(corDe(within(linha as never).getByLabelText(`Carga da série 1 de ${SUPINO}`))).toBe(esperado);
      expect(corDe(within(linha as never).getByLabelText(`Repetições da série 1 de ${SUPINO}`))).toBe(esperado);
    },
  );

  it('as demais linhas pendentes (sem faixa) mantêm os valores a lápis (inkMuted)', async () => {
    await montar();
    await caixa(S1);
    expect(corDe(screen.getByLabelText(`Carga da série 2 de ${SUPINO}`))).toBe(colors.light.inkMuted);
  });
});

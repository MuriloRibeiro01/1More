import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { screen, within } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { startWorkout } from '../../src/workout/repository';
import { colors } from '../../src/theme';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006a (e) do Sérgio: o ramo "lápis vira tinta" da série da vez. Com as cores reais o contraste é 5,07:1 (Papel) e 5,54:1 (Noite),
// então o ramo nunca dispara. Aqui o cálculo é forçado a 3:1 (abaixo de 4,5:1): SÓ a linha da faixa troca os valores para tinta;
// as demais pendentes continuam a lápis.
jest.mock('../../src/theme/contrast', () => ({ contrastRatio: jest.fn(() => 3) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
let db: Database;
let workoutId: string;

const montar = (tema: 'light' | 'dark') =>
  renderComTema(
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
const corDe = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as { color?: string }).color;

function linhaDaFaixa(n: number, wash: string) {
  let no: { props: { style?: unknown }; parent: unknown } | null = screen.getByRole('checkbox', { name: `Série ${n} de ${SUPINO}` });
  while (no) {
    if ((StyleSheet.flatten(no.props?.style as never) as { backgroundColor?: string } | undefined)?.backgroundColor === wash) return no;
    no = no.parent as typeof no;
  }
  return null;
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const ex = (await listCatalog(db)).find((e) => e.name === SUPINO)!;
  const rotina = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ex.id, sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
});
afterEach(() => {
  jest.useRealTimers();
});

describe.each(['light', 'dark'] as const)('contraste do lápis abaixo de 4,5:1 — tema %s', (tema) => {
  it('na linha da faixa os valores passam para tinta', async () => {
    await montar(tema);
    await screen.findByRole('checkbox', { name: `Série 1 de ${SUPINO}` });
    const linha = linhaDaFaixa(1, colors[tema].stripeWash);
    expect(linha).not.toBeNull();
    expect(corDe(within(linha as never).getByLabelText(`Carga da série 1 de ${SUPINO}`))).toBe(colors[tema].ink);
    expect(corDe(within(linha as never).getByLabelText(`Repetições da série 1 de ${SUPINO}`))).toBe(colors[tema].ink);
  });

  it('nas outras pendentes (sem faixa) os valores continuam a lápis', async () => {
    await montar(tema);
    await screen.findByRole('checkbox', { name: `Série 2 de ${SUPINO}` });
    expect(corDe(screen.getByLabelText(`Carga da série 2 de ${SUPINO}`))).toBe(colors[tema].inkMuted);
  });
});

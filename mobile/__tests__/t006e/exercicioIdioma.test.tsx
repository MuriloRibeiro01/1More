import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ExerciseRoute, WorkoutDetailRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006e, item 5 (S11): as datas da tela Exercício seguem o IDIOMA DO APP, não o do aparelho
// (`Intl.DateTimeFormat(undefined, ...)` em ExerciseScreen.tsx usa o do aparelho). Provável causa do C41.
// O "aparelho" é simulado: toda chamada sem locale explícito cai no idioma contrário ao do app.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
const NOV_12 = Date.UTC(2026, 10, 12, 12, 0);
const RealDTF = Intl.DateTimeFormat;

let db: Database;
let supino: string;

function aparelhoEm(locale: string) {
  jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(((loc?: string | string[], opts?: Intl.DateTimeFormatOptions) =>
    new RealDTF(loc ?? locale, opts)) as unknown as typeof Intl.DateTimeFormat);
}
/** Só o que a pessoa lê ou ouve: textos e rótulos de acessibilidade (a árvore inteira é enorme). */
function arvore(): string {
  const out: string[] = [];
  const visita = (n: unknown): void => {
    if (typeof n === 'string') out.push(n);
    else if (Array.isArray(n)) n.forEach(visita);
    else if (n && typeof n === 'object') {
      const o = n as { props?: { accessibilityLabel?: string }; children?: unknown };
      if (o.props?.accessibilityLabel) out.push(o.props.accessibilityLabel);
      visita(o.children);
    }
  };
  visita(screen.toJSON());
  return out.join(' | ');
}

function montar() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'Exercise', params: { exerciseId: supino } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="Exercise" component={ExerciseRoute as never} />
          <Stack.Screen name="WorkoutDetail" component={WorkoutDetailRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === SUPINO)!.id;
  const rotina = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: supino, sets: 1, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
  const id = await startWorkout(db, { routineId: rotina, now: NOV_12, tzOffsetMin: 0 });
  const w = await loadWorkout(db, id);
  await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 80, reps: 10, completed: true }, NOV_12 + 60_000);
  await finishWorkout(db, id, { pending: 'discard', now: NOV_12 + 1_800_000 });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await i18n.changeLanguage('pt-BR');
});
afterAll(() => i18n.changeLanguage('pt-BR'));

describe.each([
  ['pt-BR', 'en-US', /12 de novembro/, /November/],
  ['en', 'pt-BR', /November 12/, /novembro/],
] as const)('app em %s com o aparelho em %s', (app, aparelho, esperado, proibido) => {
  it('Recordes: a data do recorde segue o idioma do app', async () => {
    await i18n.changeLanguage(app);
    aparelhoEm(aparelho);
    await montar();
    await screen.findByRole('header', { name: SUPINO });
    expect(arvore()).toMatch(esperado);
    expect(arvore()).not.toMatch(proibido);
  });

  it('Histórico: a data da sessão (rótulo falado) segue o idioma do app', async () => {
    await i18n.changeLanguage(app);
    aparelhoEm(aparelho);
    await montar();
    await screen.findByRole('header', { name: SUPINO });
    await fireEvent.press(screen.getByRole('button', { name: app === 'en' ? 'History' : 'Histórico' }));
    expect(arvore()).toMatch(esperado);
    expect(arvore()).not.toMatch(proibido);
  });
});

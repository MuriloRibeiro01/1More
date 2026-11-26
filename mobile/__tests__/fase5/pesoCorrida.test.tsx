import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ActiveWorkoutRoute, WorkoutSummaryRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Reprodução do bug do campo de peso no treino ativo (relato do Atlas).
//  (a) focar o peso vazio não pode mostrar "0" nem deixar o cursor no fim (digitar 5 → "05", 80 → "0580").
//  (b) peso digitado (120) virou 0 ao concluir a série, com as reps (12) persistidas; corrida entre
//      onChangeText / blur / conclusão e a gravação no banco local.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const SUPINO = 'Supino reto com barra';
const AGACHAMENTO = 'Agachamento livre';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();

let db: Database;
let rotinaId: string;

function montar(workoutId: string) {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ActiveWorkout', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutRoute as never} />
          <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const caixa = (n: number, nome = SUPINO) => screen.findByRole('checkbox', { name: `Série ${n} de ${nome}` });
const carga = (n: number, nome = SUPINO) => screen.getByLabelText(`Carga da série ${n} de ${nome}`);
const reps = (n: number, nome = SUPINO) => screen.getByLabelText(`Repetições da série ${n} de ${nome}`);
const series = async (id: string, ex = 0) => (await loadWorkout(db, id)).exercises[ex].sets;
const linhasSet = async () =>
  (await db.get<Model>('workout_set').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);

/** Digita caractere a caractere, como o teclado (um onChangeText por tecla, sem esperar nada entre eles). */
async function digitar(el: ReturnType<typeof carga>, texto: string) {
  for (let i = 1; i <= texto.length; i++) await fireEvent.changeText(el, texto.slice(0, i));
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  const id = (n: string) => cat.find((e) => e.name === n)!.id;
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [
      // sem carga alvo: os campos de peso nascem vazios
      { exerciseId: id(SUPINO), sets: 2, weightKg: null, repsMin: null, repsMax: 12, restSeconds: 90 },
      { exerciseId: id(AGACHAMENTO), sets: 2, weightKg: null, repsMin: null, repsMax: null, restSeconds: 120 },
    ],
  });
});

describe('(a) foco no peso vazio', () => {
  it('o campo de peso de uma série sem carga nasce vazio (nem "0" nem "0,00")', async () => {
    await montar(await startWorkout(db, { routineId: rotinaId, now: Date.now() }));
    await caixa(1);
    expect(carga(1).props.value).toBe('');
    expect(carga(2).props.value).toBe('');
  });

  it('focar o peso vazio não muda o valor para 0', async () => {
    await montar(await startWorkout(db, { routineId: rotinaId, now: Date.now() }));
    await caixa(1);
    await fireEvent(carga(1), 'focus');
    expect(carga(1).props.value).toBe('');
  });

  it('focar e sair sem digitar não grava peso 0 no banco', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(id);
    await caixa(1);
    await fireEvent(carga(1), 'focus');
    await fireEvent(carga(1), 'blur');
    expect((await series(id))[0].weightKg).toBeNull();
  });

  it.each([
    ['5', '5'],
    ['80', '80'],
    ['82,5', '82,5'],
  ])('focar e digitar "%s" resulta em "%s" (sem zero à esquerda)', async (digitado, esperado) => {
    await montar(await startWorkout(db, { routineId: rotinaId, now: Date.now() }));
    await caixa(1);
    await fireEvent(carga(1), 'focus');
    await digitar(carga(1), digitado);
    expect(carga(1).props.value).toBe(esperado);
  });

  it('o campo seleciona o conteúdo ao focar (selectTextOnFocus)', async () => {
    await montar(await startWorkout(db, { routineId: rotinaId, now: Date.now() }));
    await caixa(1);
    expect(carga(1).props.selectTextOnFocus).toBe(true);
  });
});

describe('(b) peso digitado perdido ao concluir a série (corrida)', () => {
  const montarEIniciar = async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(id);
    await caixa(1);
    return id;
  };

  it('digitação rápida do peso + reps, check logo depois: persiste 120 × 12', async () => {
    const id = await montarEIniciar();
    await digitar(carga(1), '120');
    await digitar(reps(1), '12');
    await fireEvent.press(await caixa(1));
    await waitFor(async () => expect((await series(id))[0]).toMatchObject({ weightKg: 120, reps: 12 }));
    expect((await series(id))[0].completedAt).not.toBeNull();
  });

  it('blur do peso ao focar as reps, depois check: persiste 120 × 12', async () => {
    const id = await montarEIniciar();
    await digitar(carga(1), '120');
    await fireEvent(carga(1), 'blur');
    await fireEvent(reps(1), 'focus');
    await digitar(reps(1), '12');
    await fireEvent.press(await caixa(1));
    await waitFor(async () => expect((await series(id))[0]).toMatchObject({ weightKg: 120, reps: 12 }));
  });

  it('blur e check disparados na mesma rajada, sem esperar a gravação do blur: persiste 120 × 12', async () => {
    const id = await montarEIniciar();
    await digitar(reps(1), '12');
    await digitar(carga(1), '120');
    await act(async () => {
      fireEvent(carga(1), 'blur');
      fireEvent.press(screen.getByRole('checkbox', { name: `Série 1 de ${SUPINO}` }));
    });
    await waitFor(async () => expect((await series(id))[0]).toMatchObject({ weightKg: 120, reps: 12 }));
    expect((await series(id))[0].completedAt).not.toBeNull();
  });

  it('série 1 e série 2 em sequência (120 × 12 e 20 × 10): nenhuma perde o peso', async () => {
    const id = await montarEIniciar();
    await digitar(carga(1), '120');
    await digitar(reps(1), '12');
    await act(async () => {
      fireEvent(reps(1), 'blur');
      fireEvent.press(screen.getByRole('checkbox', { name: `Série 1 de ${SUPINO}` }));
    });
    await digitar(carga(2), '20');
    await digitar(reps(2), '10');
    await act(async () => {
      fireEvent(reps(2), 'blur');
      fireEvent.press(screen.getByRole('checkbox', { name: `Série 2 de ${SUPINO}` }));
    });
    await waitFor(async () => {
      const [s1, s2] = await series(id);
      expect(s1).toMatchObject({ weightKg: 120, reps: 12 });
      expect(s2).toMatchObject({ weightKg: 20, reps: 10 });
    });
  });

  it('o banco nunca recebe peso 0 enquanto se digita (gravações intermediárias)', async () => {
    const id = await montarEIniciar();
    const vistos = new Set<unknown>();
    const sub = db.withChangesForTables(['workout_set']).subscribe(async () => {
      for (const l of await linhasSet()) vistos.add(l.weight_kg);
    });
    await digitar(carga(1), '120');
    await fireEvent(carga(1), 'blur');
    await digitar(reps(1), '12');
    await fireEvent.press(await caixa(1));
    await waitFor(async () => expect((await series(id))[0].completedAt).not.toBeNull());
    sub.unsubscribe();
    expect(vistos.has(0)).toBe(false);
  });

  it('peso apagado e redigitado antes do check não vira 0', async () => {
    const id = await montarEIniciar();
    await digitar(carga(1), '120');
    await fireEvent(carga(1), 'blur');
    await fireEvent.changeText(carga(1), '');
    await digitar(carga(1), '125');
    await digitar(reps(1), '12');
    await fireEvent.press(await caixa(1));
    await waitFor(async () => expect((await series(id))[0]).toMatchObject({ weightKg: 125, reps: 12 }));
  });

  it('o valor mostrado no campo bate com o do banco depois de concluir', async () => {
    const id = await montarEIniciar();
    await digitar(carga(1), '120');
    await digitar(reps(1), '12');
    await fireEvent.press(await caixa(1));
    await waitFor(async () => expect((await series(id))[0].completedAt).not.toBeNull());
    expect(carga(1).props.value).toBe('120');
    expect((await series(id))[0].weightKg).toBe(120);
  });
});

describe('(a/b) origem provável do "0": carga 0 gravada vira pré-preenchimento do próximo treino', () => {
  it('série concluída com carga 0 no treino anterior não pré-preenche "0" no treino seguinte (campo deve nascer vazio)', async () => {
    const t1 = await startWorkout(db, { routineId: rotinaId, now: Date.now() - 86_400_000 });
    const s1 = (await series(t1))[0];
    await updateSet(db, s1.id, { weightKg: 0, reps: 12, completed: true });
    await finishWorkout(db, t1, { pending: 'discard' });
    const t2 = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(t2);
    await caixa(1);
    expect(carga(1).props.value).toBe('');
  });

  it('digitar "120," (vírgula pendente do teclado) e tocar o check conclui a série sem perder o peso', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: Date.now() });
    await montar(id);
    await caixa(1);
    await fireEvent.changeText(reps(1), '12');
    await fireEvent.changeText(carga(1), '120,');
    await fireEvent.press(await caixa(1));
    await waitFor(async () => expect((await series(id))[0]).toMatchObject({ weightKg: 120, reps: 12 }));
    expect((await series(id))[0].completedAt).not.toBeNull();
  });
});

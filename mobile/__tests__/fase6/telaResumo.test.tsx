import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { WorkoutSummaryRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { saveNotes } from '../../src/workout/summary';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Fase 6 — tela "Treino finalizado" (livro-caixa), em TDD. Protótipo "RESUMO.DC.HTML".
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const min = (n: number) => n * 60_000;

let db: Database;
let rotinaId: string;

function montar(workoutId: string) {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'WorkoutSummary', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

async function feito(inicio: number, carga: number) {
  const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin: 0 });
  const w = await loadWorkout(db, id);
  await updateSet(db, w.exercises[0].sets[0].id, { weightKg: carga, reps: 10, completed: true }, inicio + min(9));
  await finishWorkout(db, id, { pending: 'discard', now: inicio + min(30) });
  return id;
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [{ exerciseId: supino, sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});

describe('livro-caixa', () => {
  it('título, duração (até a última série), volume, séries e semana', async () => {
    await montar(await feito(T0, 65));
    expect(await screen.findByRole('header', { name: 'Treino finalizado' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Duração: 9 min')).toBeOnTheScreen();
    expect(screen.getByLabelText('Volume: 650 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Séries: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Semana: 1 dia')).toBeOnTheScreen();
  });

  it('formata o volume em pt-BR com milhar', async () => {
    const id = await feito(T0, 1265);
    await montar(id);
    expect(await screen.findByLabelText('Volume: 12.650 kg')).toBeOnTheScreen();
  });
});

describe('recordes', () => {
  it('mostra o carimbo PR na margem com o exercício, a série e o tipo', async () => {
    await feito(T0 - 3 * 86_400_000, 60);
    await montar(await feito(T0, 65));
    expect(await screen.findByRole('header', { name: 'Recordes' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Recorde pessoal')).toBeOnTheScreen();
    expect(screen.getByText('Supino reto com barra')).toBeOnTheScreen();
    expect(screen.getByText(/65 × 10/)).toBeOnTheScreen();
    expect(screen.getByText(/maior carga/)).toBeOnTheScreen();
  });

  it('sem recordes a seção não aparece', async () => {
    await montar(await feito(T0, 65));
    await screen.findByRole('header', { name: 'Treino finalizado' });
    expect(screen.queryByRole('header', { name: 'Recordes' })).toBeNull();
    expect(screen.queryByLabelText('Recorde pessoal')).toBeNull();
  });
});

describe('nota, fechar e offline', () => {
  it('a nota é opcional e salva com o treino ao sair do campo', async () => {
    const id = await feito(T0, 65);
    await montar(id);
    const campo = await screen.findByLabelText('Nota');
    await fireEvent.changeText(campo, 'Ombro estalando');
    await fireEvent(campo, 'blur');
    expect((await loadWorkout(db, id)).notes).toBe('Ombro estalando');
  });

  it('mostra a nota já salva', async () => {
    const id = await feito(T0, 65);
    await saveNotes(db, id, 'Boa sessão');
    await montar(id);
    expect((await screen.findByLabelText('Nota')).props.value).toBe('Boa sessão');
  });

  it('indica que está salvo no aparelho e Fechar volta (único botão cheio, alvo ≥ 48dp)', async () => {
    await montar(await feito(T0, 65));
    expect(await screen.findByText('Salvo no aparelho')).toBeOnTheScreen();
    const fechar = screen.getByRole('button', { name: 'Fechar' });
    const s = StyleSheet.flatten(fechar.props.style as never) as { minHeight: number };
    expect(s.minHeight).toBeGreaterThanOrEqual(48);
    await fireEvent.press(fechar);
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
  });

  describe('sem rede', () => {
    const original = global.fetch;
    afterEach(() => {
      global.fetch = original;
    });
    it('abre, anota e fecha sem nenhuma chamada de rede (RN-01)', async () => {
      const spy = jest.fn(() => Promise.reject(new Error('sem rede')));
      global.fetch = spy as unknown as typeof fetch;
      await montar(await feito(T0, 65));
      const campo = await screen.findByLabelText('Nota');
      await fireEvent.changeText(campo, 'x');
      await fireEvent(campo, 'blur');
      await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

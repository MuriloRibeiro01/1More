import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ExercisePickerRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { saveCustomExercise } from '../../src/routines/customExercise';
import { seedCatalog } from '../../src/routines/repository';
import { startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006c, sugestão s4 do Sérgio (decisão do PO): se arquivar um exercício próprio FALHA, a tela mostra o aviso (role alert),
// o exercício continua na lista e na tabela, e a pessoa pode tentar de novo. Antes só havia um console.error.
jest.mock('../../src/routines/customExercise', () => ({
  ...jest.requireActual<typeof import('../../src/routines/customExercise')>('../../src/routines/customExercise'),
  archiveCustomExercise: jest.fn(() => Promise.reject(new Error('falha simulada ao arquivar'))),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const NOVO = 'Remada na polia';
const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
let db: Database;
let workoutId: string;

const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  db = criarBancoDeTeste();
  await seedCatalog(db);
  await saveCustomExercise(db, { name: NOVO, primaryMuscle: 'upper_back', equipmentCode: 'cable', trackingType: 'weight_reps' });
  workoutId = await startWorkout(db, { name: 'Livre', now: Date.now() });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('arquivar falha', () => {
  async function tentarArquivar() {
    await renderComTema(
      <DatabaseProvider database={db}>
        <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ExercisePicker', params: { workoutId } }] }}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
            <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute as never} />
          </Stack.Navigator>
        </NavigationContainer>
      </DatabaseProvider>,
    );
    await fireEvent.press(await botao(`Opções de ${NOVO}`));
    await fireEvent.press(await botao('Arquivar exercício'));
    const confirmar = screen.queryAllByRole('button', { name: /^(Arquivar|Confirmar)/ }).pop();
    if (confirmar) await fireEvent.press(confirmar);
  }

  it('mostra um aviso (role alert) com o motivo', async () => {
    await tentarArquivar();
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
  });

  it('o exercício continua na lista e no banco (sem deleted_at)', async () => {
    await tentarArquivar();
    await screen.findByRole('alert');
    expect(await screen.findByRole('checkbox', { name: NOVO })).toBeOnTheScreen();
    const linha = (await db.get<Model>('exercise').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>).find((r) => r.name === NOVO)!;
    expect(linha.deleted_at).toBeNull();
  });
});

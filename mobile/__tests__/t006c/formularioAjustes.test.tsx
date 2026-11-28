import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen, within } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ExercisePickerRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { seedCatalog } from '../../src/routines/repository';
import { startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006c, sugestões do Sérgio (decisão do PO) no formulário de exercício próprio:
//  (s1) "Só repetições" e "Tempo" ficam ESCONDIDOS até a tela de treino saber registrá-los (hoje é sempre carga × reps);
//  (s2) músculo e equipamento escolhidos podem ser DESMARCADOS (tocar de novo) e voltam a null no banco;
//  (s3) cada opção tem alvo de toque ≥ 48 dp também na LARGURA (minWidth), não só na altura;
//  (s7) nome sem limite no repositório: o limite de 80 caracteres vale também em saveCustomExercise (ver exercicioNome abaixo).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
let db: Database;
let workoutId: string;

function montar() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ExercisePicker', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
const form = () => within(screen.getByTestId('exercicio-form'));
const doUsuario = async () =>
  (await db.get<Model>('exercise').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>).filter((r) => r.is_custom === true);
const largura = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minWidth ?? 0, s?.width ?? 0);
};

async function abrirForm() {
  await montar();
  await fireEvent.press(await screen.findByRole('button', { name: /Criar exercício próprio/ }));
  await screen.findByTestId('exercicio-form');
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  workoutId = await startWorkout(db, { name: 'Livre', now: Date.now() });
});

describe('s1 — tipos de registro sem suporte ficam escondidos', () => {
  it('o formulário não oferece "Só repetições" nem "Tempo"', async () => {
    await abrirForm();
    expect(form().queryByRole('button', { name: 'Só repetições' })).toBeNull();
    expect(form().queryByRole('button', { name: 'Tempo' })).toBeNull();
  });

  it('exercício criado sem escolher tipo grava weight_reps', async () => {
    await abrirForm();
    await fireEvent.changeText(form().getByLabelText('Nome do exercício'), 'Remada na polia');
    await fireEvent.press(form().getByRole('button', { name: 'Salvar exercício' }));
    await screen.findByRole('checkbox', { name: 'Remada na polia' });
    expect((await doUsuario())[0].tracking_type).toBe('weight_reps');
  });
});

describe('s2 — músculo e equipamento podem ser desmarcados', () => {
  it('tocar no músculo escolhido de novo o desmarca', async () => {
    await abrirForm();
    await fireEvent.press(form().getByRole('button', { name: 'Costas' }));
    expect(form().getByRole('button', { name: 'Costas' })).toBeSelected();
    await fireEvent.press(form().getByRole('button', { name: 'Costas' }));
    expect(form().getByRole('button', { name: 'Costas' })).not.toBeSelected();
  });

  it('tocar no equipamento escolhido de novo o desmarca', async () => {
    await abrirForm();
    await fireEvent.press(form().getByRole('button', { name: 'Polia' }));
    await fireEvent.press(form().getByRole('button', { name: 'Polia' }));
    expect(form().getByRole('button', { name: 'Polia' })).not.toBeSelected();
  });

  it('desmarcados, o exercício é salvo sem músculo e sem equipamento (null)', async () => {
    await abrirForm();
    await fireEvent.changeText(form().getByLabelText('Nome do exercício'), 'Exercício livre');
    for (const nome of ['Costas', 'Polia']) {
      await fireEvent.press(form().getByRole('button', { name: nome }));
      await fireEvent.press(form().getByRole('button', { name: nome }));
    }
    await fireEvent.press(form().getByRole('button', { name: 'Salvar exercício' }));
    await screen.findByRole('checkbox', { name: 'Exercício livre' });
    expect((await doUsuario())[0]).toMatchObject({ primary_muscle: null, equipment_code: null });
  });

  it('escolher outro músculo troca a escolha (não acumula)', async () => {
    await abrirForm();
    await fireEvent.press(form().getByRole('button', { name: 'Costas' }));
    await fireEvent.press(form().getByRole('button', { name: 'Peito' }));
    expect(form().getByRole('button', { name: 'Peito' })).toBeSelected();
    expect(form().getByRole('button', { name: 'Costas' })).not.toBeSelected();
  });
});

describe('s3 — alvo de toque também na largura', () => {
  it('toda opção do formulário (músculo, equipamento) tem minWidth ≥ 48', async () => {
    await abrirForm();
    const opcoes = ['Peito', 'Costas', 'Polia', 'Barra', 'Máquina'].map((n) => form().getByRole('button', { name: n }));
    for (const o of opcoes) expect(largura(o)).toBeGreaterThanOrEqual(48);
  });
});

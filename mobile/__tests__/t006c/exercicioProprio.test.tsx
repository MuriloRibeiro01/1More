import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen, within } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ExercisePickerRoute, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { addExercise, discardWorkout, finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006c, item 2 (C23, RF-12/RF-13, RN-19): "+ Criar exercício próprio" no seletor; editar e arquivar só o que é da pessoa.
// Contrato de interface (para o Prisma):
//  - seletor: botão "Criar exercício próprio"; abre um formulário (tela ou folha) com testID "exercicio-form", header "Novo exercício"
//    (em edição: "Editar exercício"), campo "Nome do exercício", botões de escolha única (estado `selected`) para músculo
//    (nomes de progress.muscles), equipamento (Barra, Halteres, Polia, Máquina, Peso corporal) e tipo de registro
//    ("Carga e repetições" = weight_reps, "Só repetições" = bodyweight_reps, "Tempo" = duration), e o botão "Salvar exercício".
//  - nome vazio ou repetido (sem diferenciar maiúsculas/acentos, contra catálogo e próprios): nada é gravado e um aviso
//    (role alert) com o motivo aparece no formulário.
//  - linha de exercício PRÓPRIO no seletor tem o botão "Opções de <nome>" → folha com "Editar exercício" e "Arquivar exercício".
//    Linha do catálogo não tem esse botão.
//  - persistência: linha em `exercise` com is_custom = true (migração v5), user_id nulo, colunas de sync; arquivar = deleted_at
//    (nunca DELETE); treinos antigos continuam mostrando o nome.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
const NOVO = 'Remada na polia';
let db: Database;
let workoutId: string;

function montarPicker() {
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

const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const form = () => within(screen.getByTestId('exercicio-form'));
const linhas = async () => (await db.get<Model>('exercise').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);
const doUsuario = async () => (await linhas()).filter((r) => r.is_custom === true);
const alvo = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minHeight ?? 0, s?.height ?? 0);
};

async function abrirForm() {
  await fireEvent.press(await botao(/Criar exercício próprio/));
  await screen.findByTestId('exercicio-form');
}
async function preencher(nome: string, musculo = 'Costas', equipamento = 'Polia', tipo = 'Carga e repetições') {
  await fireEvent.changeText(form().getByLabelText('Nome do exercício'), nome);
  await fireEvent.press(form().getByRole('button', { name: musculo }));
  await fireEvent.press(form().getByRole('button', { name: equipamento }));
  // s1 do Sérgio: só "Carga e repetições" tem suporte na tela de treino; o botão pode estar escondido (único tipo)
  const botaoTipo = form().queryByRole('button', { name: tipo });
  if (botaoTipo) await fireEvent.press(botaoTipo);
}
async function criar(nome = NOVO, ...resto: [string?, string?, string?]) {
  await abrirForm();
  await preencher(nome, ...resto);
  await fireEvent.press(form().getByRole('button', { name: 'Salvar exercício' }));
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  workoutId = await startWorkout(db, { name: 'Livre', now: Date.now() });
});

describe('formulário', () => {
  it('o seletor oferece "Criar exercício próprio" e abre o formulário com os campos do RF-12/RF-13', async () => {
    await montarPicker();
    await abrirForm();
    expect(screen.getByRole('header', { name: 'Novo exercício' })).toBeOnTheScreen();
    expect(form().getByLabelText('Nome do exercício')).toBeOnTheScreen();
    for (const nome of ['Costas', 'Polia', 'Salvar exercício']) {
      expect(form().getByRole('button', { name: nome })).toBeOnTheScreen();
    }
  });

  it('os controles do formulário têm alvo ≥ 48 dp e a escolha fica marcada (selected)', async () => {
    await montarPicker();
    await abrirForm();
    for (const b of form().getAllByRole('button')) expect(alvo(b)).toBeGreaterThanOrEqual(48);
    await fireEvent.press(form().getByRole('button', { name: 'Costas' }));
    expect(form().getByRole('button', { name: 'Costas' })).toBeSelected();
    expect(form().getByRole('button', { name: 'Peito' })).not.toBeSelected();
  });
});

describe('criar "Remada na polia"', () => {
  it('grava uma linha em exercise (is_custom, músculo, equipamento, tipo) com as colunas de sync e sem DELETE', async () => {
    await montarPicker();
    await criar();
    const [novo] = await doUsuario();
    expect(novo).toMatchObject({
      name: NOVO,
      primary_muscle: 'upper_back',
      equipment_code: 'cable',
      tracking_type: 'weight_reps',
      secondary_muscles: '[]',
      is_custom: true,
      user_id: null,
      server_version: null,
      deleted_at: null,
    });
    expect(typeof novo.created_at).toBe('number');
    expect(novo.updated_at).toBe(novo.created_at);
  });

  it('o tipo de registro gravado é weight_reps (o único com suporte na tela de treino; ver formularioAjustes.test.tsx)', async () => {
    await montarPicker();
    await criar('Flexão com carga', 'Peito', 'Peso corporal');
    expect((await doUsuario())[0].tracking_type).toBe('weight_reps');
  });

  it('volta ao seletor e o exercício novo aparece na lista e sob o filtro do músculo', async () => {
    await montarPicker();
    await criar();
    expect(await screen.findByRole('checkbox', { name: NOVO })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Costas' }));
    expect(await screen.findByRole('checkbox', { name: NOVO })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Peito' }));
    expect(screen.queryByRole('checkbox', { name: NOVO })).toBeNull();
  });

  it('pode ser adicionado a um treino', async () => {
    await montarPicker();
    await criar();
    await fireEvent.press(await screen.findByRole('checkbox', { name: NOVO }));
    await fireEvent.press(await botao('Adicionar 1 exercício'));
    const w = await loadWorkout(db, workoutId);
    expect(w.exercises.map((e) => e.name)).toEqual([NOVO]);
  });

  it('pode ser usado em uma rotina e em um treino dela', async () => {
    await montarPicker();
    await criar();
    const exercicio = (await listCatalog(db)).find((e) => e.name === NOVO)!;
    expect(exercicio).toBeTruthy();
    const rotina = await saveRoutine(db, {
      name: 'Costas',
      exercises: [{ exerciseId: exercicio.id, sets: 3, weightKg: 40, repsMin: null, repsMax: 12, restSeconds: 90 }],
    });
    await discardWorkout(db, workoutId); // só pode haver um treino ativo (RN-02): libera o do beforeEach
    const treino = await startWorkout(db, { routineId: rotina, now: Date.now() });
    expect((await loadWorkout(db, treino)).exercises.map((e) => e.name)).toEqual([NOVO]);
  });
});

describe('nome vazio ou repetido é recusado com o motivo', () => {
  it('vazio: nada é gravado e aparece um aviso', async () => {
    await montarPicker();
    await abrirForm();
    await fireEvent.press(form().getByRole('button', { name: 'Salvar exercício' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await doUsuario()).toEqual([]);
  });

  it('só espaços conta como vazio', async () => {
    await montarPicker();
    await criar('   ');
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await doUsuario()).toEqual([]);
  });

  it('igual a um do catálogo (sem diferenciar maiúsculas e acentos)', async () => {
    await montarPicker();
    await criar('SUPINO RETO COM BARRA');
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await doUsuario()).toEqual([]);
  });

  it('igual a outro exercício próprio', async () => {
    await montarPicker();
    await criar();
    await criar('remada na polia');
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await doUsuario()).toHaveLength(1);
  });
});

describe('editar e arquivar só o que é do usuário (RN-19)', () => {
  it('exercício do catálogo não tem opção de editar nem de arquivar', async () => {
    await montarPicker();
    await screen.findByRole('checkbox', { name: 'Supino reto com barra' });
    expect(screen.queryByRole('button', { name: 'Opções de Supino reto com barra' })).toBeNull();
  });

  it('exercício próprio tem "Opções" com "Editar exercício" e "Arquivar exercício"', async () => {
    await montarPicker();
    await criar();
    await fireEvent.press(await botao(`Opções de ${NOVO}`));
    expect(await botao('Editar exercício')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Arquivar exercício' })).toBeOnTheScreen();
  });

  it('editar o nome mantém a mesma linha (id), atualiza updated_at e o seletor mostra o novo nome', async () => {
    await montarPicker();
    await criar();
    const [antes] = await doUsuario();
    await fireEvent.press(await botao(`Opções de ${NOVO}`));
    await fireEvent.press(await botao('Editar exercício'));
    await screen.findByTestId('exercicio-form');
    await fireEvent.changeText(form().getByLabelText('Nome do exercício'), 'Remada baixa na polia');
    await fireEvent.press(form().getByRole('button', { name: 'Salvar exercício' }));
    expect(await screen.findByRole('checkbox', { name: 'Remada baixa na polia' })).toBeOnTheScreen();
    const todos = await doUsuario();
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ id: antes.id, name: 'Remada baixa na polia', primary_muscle: 'upper_back' });
    expect(Number(todos[0].updated_at)).toBeGreaterThanOrEqual(Number(antes.updated_at));
  });

  it('arquivar some do seletor, não apaga a linha (deleted_at) e os treinos antigos mantêm o nome e o histórico', async () => {
    await montarPicker();
    await criar();
    const [proprio] = await doUsuario();
    // treino antigo finalizado com o exercício
    await discardWorkout(db, workoutId); // só pode haver um treino ativo (RN-02): libera o do beforeEach
    const antigo = await startWorkout(db, { name: 'Antigo', now: Date.now() - 3 * 86_400_000 });
    await addExercise(db, antigo, String(proprio.id), Date.now() - 3 * 86_400_000 + 1);
    const w = await loadWorkout(db, antigo);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 40, reps: 10, completed: true }, Date.now() - 3 * 86_400_000 + 60_000);
    await finishWorkout(db, antigo, { now: Date.now() - 3 * 86_400_000 + 120_000 });

    await fireEvent.press(await botao(`Opções de ${NOVO}`));
    await fireEvent.press(await botao('Arquivar exercício'));
    await fireEvent.press(await botao(/^(Arquivar|Confirmar)/).catch(() => botao('Arquivar exercício'))); // confirmação em folha, se houver
    expect(screen.queryByRole('checkbox', { name: NOVO })).toBeNull();

    const linha = (await linhas()).find((r) => r.id === proprio.id)!;
    expect(linha.deleted_at).toEqual(expect.any(Number));
    const depois = await loadWorkout(db, antigo);
    expect(depois.exercises[0]).toMatchObject({ name: NOVO });
    expect(depois.exercises[0].sets[0]).toMatchObject({ weightKg: 40, reps: 10 });
    expect((await listCatalog(db)).map((e) => e.name)).not.toContain(NOVO);
  });
});

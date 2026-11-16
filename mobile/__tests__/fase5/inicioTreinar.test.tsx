import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, screen, within } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { addExercise, finishWorkout, getActiveWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Fase 5 — aba Treinar (protótipo "MAIN.DC.HTML"): rotina do dia, rotinas, semana e atalhos para o treino.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

let db: Database;
let rotA: string;
let rotB: string;

const montar = () =>
  renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const semAbas = () => expect(screen.queryAllByRole('tab')).toHaveLength(0);
const treinos = async () => (await db.get<Model>('workout').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);

/** Treino finalizado da rotina, com 1 série concluída. */
async function treinoFeito(routineId: string, start: number) {
  const id = await startWorkout(db, { routineId, now: start });
  const set = (await loadWorkout(db, id)).exercises[0].sets[0].id;
  await updateSet(db, set, { weightKg: 50, reps: 5, completed: true }, start + 1000);
  await finishWorkout(db, id, { now: start + 2000 });
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
});

async function criarRotinas() {
  const [ex] = await listCatalog(db);
  const exercicio = { exerciseId: ex.id, sets: 1, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 };
  rotA = await saveRoutine(db, { name: 'Treino A — Peito', exercises: [exercicio] });
  rotB = await saveRoutine(db, { name: 'Treino B — Costas', exercises: [exercicio] });
}

describe('sem rotinas', () => {
  it('EmptyState com "Nova rotina" e "Treino livre"; nada de "Começar treino"', async () => {
    await montar();
    expect(await screen.findByTestId('rotinas-vazio')).toBeOnTheScreen();
    expect(await botao('Nova rotina')).toBeOnTheScreen();
    expect(await botao('Treino livre')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Começar treino' })).toBeNull();
  });

  it('Treino livre cria um treino ativo sem rotina e sem exercícios e abre a tela do treino', async () => {
    await montar();
    await fireEvent.press(await botao('Treino livre'));
    const ativo = await getActiveWorkout(db);
    expect(ativo).toMatchObject({ name: 'Treino livre', routineId: null });
    semAbas();
  });
});

describe('rotina do dia', () => {
  it('a rotina há mais tempo sem fazer vem em destaque com o único "Começar treino"', async () => {
    await criarRotinas();
    await treinoFeito(rotA, Date.now() - 86_400_000);
    await montar();
    const comecar = await botao('Começar treino');
    expect(screen.getAllByRole('button', { name: 'Começar treino' })).toHaveLength(1);
    expect(comecar).toBeOnTheScreen();
    expect(screen.getByText('Treino B — Costas', { exact: false })).toBeOnTheScreen(); // a do dia
    // a que acabou de ser feita fica na lista das demais, com a letra A na margem
    const linhaA = await botao(/Treino A — Peito/);
    expect(within(linhaA).getByText('A')).toBeOnTheScreen();
  });

  it('empate (nunca feitas): vale a ordem de criação, A primeiro', async () => {
    await criarRotinas();
    await montar();
    await fireEvent.press(await botao('Começar treino'));
    expect(await getActiveWorkout(db)).toMatchObject({ routineId: rotA });
    semAbas();
  });

  it('1 toque na linha de outra rotina inicia o treino dela', async () => {
    await criarRotinas();
    await montar();
    await fireEvent.press(await botao(/Treino B — Costas/));
    expect(await getActiveWorkout(db)).toMatchObject({ routineId: rotB, name: 'Treino B — Costas' });
    semAbas();
  });

  it('com treino já ativo, não cria outro: abre o que existe', async () => {
    await criarRotinas();
    const existente = await startWorkout(db, { routineId: rotB, now: Date.now() });
    await montar();
    await fireEvent.press(await botao('Começar treino'));
    semAbas();
    expect((await treinos()).filter((w) => w.status === 'active')).toHaveLength(1);
    expect((await getActiveWorkout(db))!.id).toBe(existente);
  });

  it('falha ao gravar no aparelho mostra o aviso e fica na aba', async () => {
    await criarRotinas();
    await montar();
    await botao('Começar treino');
    const spy = jest.spyOn(db, 'write').mockRejectedValueOnce(new Error('disco cheio'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Começar treino' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para abrir o treino no aparelho. Tente de novo.');
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    spy.mockRestore();
    jest.restoreAllMocks();
  });
});

describe('editar rotinas', () => {
  it('"Editar rotinas" troca para "Pronto", esconde "Começar treino" e a linha passa a abrir o editor', async () => {
    await criarRotinas();
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar rotinas' }));
    expect(screen.queryByRole('button', { name: 'Começar treino' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar rotinas' })).toBeNull();
    await fireEvent.press(await botao(/Treino A — Peito/)); // também a do dia fica editável
    expect(await screen.findByLabelText('Nome da rotina')).toHaveProp('value', 'Treino A — Peito');
    expect(await getActiveWorkout(db)).toBeNull();
  });

  it('"Pronto" volta ao modo de treinar', async () => {
    await criarRotinas();
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar rotinas' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Pronto' }));
    expect(await botao('Começar treino')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editar rotinas' })).toBeOnTheScreen();
  });

  it('"Nova rotina" abre o editor vazio', async () => {
    await criarRotinas();
    await montar();
    await fireEvent.press(await botao('Nova rotina'));
    expect(await screen.findByLabelText('Nome da rotina')).toHaveProp('value', '');
  });
});

describe('semana', () => {
  it('mostra os 7 dias e marca hoje quando há treino finalizado hoje', async () => {
    await criarRotinas();
    await treinoFeito(rotA, Date.now());
    await montar();
    expect(await screen.findAllByTestId(/^dia-\d$/)).toHaveLength(7);
    expect(screen.getAllByTestId('dia-treinado')).toHaveLength(1);
  });
});

describe('treino ativo e a rotina do dia', () => {
  it('um treino ativo ainda não conta como feito: a do dia continua a mesma', async () => {
    await criarRotinas();
    const id = await startWorkout(db, { routineId: rotA, now: Date.now() });
    await addExercise(db, id, (await listCatalog(db))[0].id);
    await montar();
    expect(await botao('Começar treino')).toBeOnTheScreen();
    expect(screen.getByText('Treino A — Peito', { exact: false })).toBeOnTheScreen();
  });
});

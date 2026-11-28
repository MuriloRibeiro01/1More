import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { archiveCustomExercise, saveCustomExercise } from '../../src/routines/customExercise';
import { createFolder } from '../../src/routines/folders';
import { listCatalog, listRoutines, loadRoutine, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { loadWorkout, startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006c, bloqueante B1 do Sérgio (decisão do PO): arquivar um exercício próprio que está numa rotina NÃO quebra a rotina.
//  - `saveRoutine` (até só renomear ou mudar de pasta) continua aceitando o exercício arquivado que JÁ está na rotina;
//  - o seletor não o oferece mais; adicioná-lo a uma rotina NOVA, ou a uma rotina que não o tinha, continua recusado;
//  - o histórico antigo e os treinos já feitos seguem; o treino novo da rotina também funciona.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const NOVO = 'Remada na polia';
let db: Database;
let proprio: string;
let supino: string;
let rotina: string;

const linhas = async (tabela: string) =>
  (await db.get<Model>(tabela).query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);
const serie = (exerciseId: string) => ({ exerciseId, sets: 3, weightKg: 40, repsMin: null, repsMax: 12, restSeconds: 90 });

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
  proprio = await saveCustomExercise(db, { name: NOVO, primaryMuscle: 'upper_back', equipmentCode: 'cable', trackingType: 'weight_reps' });
  rotina = await saveRoutine(db, { name: 'Costas', exercises: [serie(supino), serie(proprio)] });
  await archiveCustomExercise(db, proprio);
});

describe('salvar uma rotina que já tem o exercício arquivado', () => {
  it('só renomear a rotina funciona e o exercício arquivado continua nela', async () => {
    const draft = await loadRoutine(db, rotina);
    await saveRoutine(db, { ...draft, name: 'Costas e bíceps' });
    expect((await listRoutines(db)).map((r) => r.name)).toEqual(['Costas e bíceps']);
    const doProprio = (await linhas('routine_exercise')).filter((r) => r.exercise_id === proprio);
    expect(doProprio).toHaveLength(1);
    expect(doProprio[0].deleted_at).toBeNull();
  });

  it('mudar de pasta funciona', async () => {
    const pasta = await createFolder(db, 'Divisão ABC');
    const draft = await loadRoutine(db, rotina);
    await saveRoutine(db, { ...draft, folderId: pasta });
    expect((await loadRoutine(db, rotina)).folderId).toBe(pasta);
  });

  it('ajustar séries, carga e reps do exercício arquivado funciona (reaproveita a mesma linha, R-13)', async () => {
    const draft = await loadRoutine(db, rotina);
    const antes = (await linhas('routine_exercise')).find((r) => r.exercise_id === proprio)!;
    await saveRoutine(db, { ...draft, exercises: draft.exercises.map((e) => (e.exerciseId === proprio ? { ...e, sets: 4, weightKg: 45 } : e)) });
    const depois = (await linhas('routine_exercise')).find((r) => r.exercise_id === proprio)!;
    expect(depois.id).toBe(antes.id);
    expect((await loadRoutine(db, rotina)).exercises.find((e) => e.exerciseId === proprio)).toMatchObject({ sets: 4, weightKg: 45 });
  });

  it('a pessoa pode tirar o arquivado da rotina (vira tombstone da linha da rotina, nunca do exercício)', async () => {
    const draft = await loadRoutine(db, rotina);
    await saveRoutine(db, { ...draft, exercises: draft.exercises.filter((e) => e.exerciseId !== proprio) });
    const linha = (await linhas('routine_exercise')).find((r) => r.exercise_id === proprio)!;
    expect(linha.deleted_at).toEqual(expect.any(Number));
    const exercicio = (await linhas('exercise')).find((r) => r.id === proprio)!;
    expect(exercicio.name).toBe(NOVO);
  });

  it('um treino novo da rotina inclui o exercício arquivado (a rotina não perde o exercício às escondidas)', async () => {
    const id = await startWorkout(db, { routineId: rotina, now: Date.now() });
    expect((await loadWorkout(db, id)).exercises.map((e) => e.name)).toEqual(['Supino reto com barra', NOVO]);
  });
});

describe('o arquivado continua fora de onde não estava', () => {
  it('rotina NOVA com o exercício arquivado é recusada', async () => {
    await expect(saveRoutine(db, { name: 'Outra', exercises: [serie(proprio)] })).rejects.toThrow();
  });

  it('rotina existente que NÃO o tinha não pode recebê-lo', async () => {
    const outra = await saveRoutine(db, { name: 'Peito', exercises: [serie(supino)] });
    const draft = await loadRoutine(db, outra);
    await expect(saveRoutine(db, { ...draft, exercises: [...draft.exercises, serie(proprio)] })).rejects.toThrow();
  });

  it('o seletor (catálogo) não o oferece', async () => {
    expect((await listCatalog(db)).map((e) => e.name)).not.toContain(NOVO);
  });
});

describe('na tela: abrir e salvar a rotina com o exercício arquivado', () => {
  it('o editor mostra o nome do exercício arquivado e salvar com outro nome funciona sem erro', async () => {
    await renderComTema(
      <DatabaseProvider database={db}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </DatabaseProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar rotinas' }));
    await fireEvent.press(await screen.findByRole('button', { name: /Costas/ }));
    const nome = await screen.findByLabelText('Nome da rotina');
    expect(await screen.findByText(NOVO)).toBeOnTheScreen();
    await fireEvent.changeText(nome, 'Costas pesadas');
    await fireEvent.press(await screen.findByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('button', { name: /Costas pesadas/ })).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect((await listRoutines(db)).map((r) => r.name)).toEqual(['Costas pesadas']);
  }, 30_000);
});

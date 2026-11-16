import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { exerciseName, exerciseRepRange, getExerciseNote, saveExerciseNote } from '../../src/exercise/data';
import { deleteRoutine, listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// Dados da tela Exercício: faixa de reps da rotina mais recente, nome e nota do usuário (tabela própria, RN-19).
let db: Database;
let supino: string;
let agachamento: string;
const linhas = async () => (await db.get<Model>('exercise_note').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  supino = cat.find((e) => e.name === 'Supino reto com barra')!.id;
  agachamento = cat.find((e) => e.name === 'Agachamento livre')!.id;
});

const ex = (exerciseId: string, repsMin: number | null, repsMax: number | null) => ({ exerciseId, sets: 3, weightKg: null, repsMin, repsMax, restSeconds: 90 });

describe('exerciseName', () => {
  it('devolve o nome do catálogo', async () => {
    expect(await exerciseName(db, supino)).toBe('Supino reto com barra');
  });
});

describe('exerciseRepRange', () => {
  it('null quando nenhuma rotina tem o exercício', async () => {
    expect(await exerciseRepRange(db, supino)).toBeNull();
  });

  it('traz min/max da rotina mais recente que contém o exercício', async () => {
    await saveRoutine(db, { name: 'Velha', exercises: [ex(supino, 6, 8)] });
    await new Promise((r) => setTimeout(r, 5));
    await saveRoutine(db, { name: 'Nova', exercises: [ex(supino, 8, 12), ex(agachamento, null, 5)] });
    expect(await exerciseRepRange(db, supino)).toEqual({ repsMin: 8, repsMax: 12 });
    expect(await exerciseRepRange(db, agachamento)).toEqual({ repsMin: null, repsMax: 5 });
  });

  it('rotina excluída não conta', async () => {
    const id = await saveRoutine(db, { name: 'A', exercises: [ex(supino, 8, 10)] });
    await deleteRoutine(db, id);
    expect(await exerciseRepRange(db, supino)).toBeNull();
  });

  it('exercício sem reps definidas na rotina devolve null', async () => {
    await saveRoutine(db, { name: 'A', exercises: [ex(supino, null, null)] });
    expect(await exerciseRepRange(db, supino)).toBeNull();
  });
});

describe('nota do exercício', () => {
  it('sem nota devolve null', async () => {
    expect(await getExerciseNote(db, supino)).toBeNull();
  });

  it('salva, apara espaços e relê; fica em tabela própria com colunas de sync', async () => {
    await saveExerciseNote(db, supino, '  Pegada média, banco 3  ', 1000);
    expect(await getExerciseNote(db, supino)).toBe('Pegada média, banco 3');
    expect(await linhas()).toEqual([expect.objectContaining({ exercise_id: supino, user_id: null, created_at: 1000, deleted_at: null })]);
  });

  it('salvar de novo atualiza a mesma linha (upsert por exercício)', async () => {
    await saveExerciseNote(db, supino, 'um', 1000);
    await saveExerciseNote(db, supino, 'dois', 2000);
    expect(await getExerciseNote(db, supino)).toBe('dois');
    const rs = await linhas();
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ created_at: 1000, updated_at: 2000 });
  });

  it('texto vazio ou só espaços faz tombstone; voltar a escrever reativa a mesma linha', async () => {
    await saveExerciseNote(db, supino, 'algo', 1000);
    await saveExerciseNote(db, supino, '   ', 2000);
    expect(await getExerciseNote(db, supino)).toBeNull();
    expect((await linhas())[0].deleted_at).toBe(2000);
    await saveExerciseNote(db, supino, 'de volta', 3000);
    expect(await getExerciseNote(db, supino)).toBe('de volta');
    const rs = await linhas();
    expect(rs).toHaveLength(1);
    expect(rs[0].deleted_at).toBeNull();
  });

  it('vazio sem nota prévia não cria linha', async () => {
    await saveExerciseNote(db, supino, '  ', 1000);
    expect(await linhas()).toEqual([]);
  });

  it('notas de exercícios diferentes não se misturam e o catálogo não é alterado', async () => {
    await saveExerciseNote(db, supino, 'a', 1000);
    await saveExerciseNote(db, agachamento, 'b', 1000);
    expect(await getExerciseNote(db, supino)).toBe('a');
    expect(await getExerciseNote(db, agachamento)).toBe('b');
    const ex = await db.get<Model>('exercise').find(supino);
    expect((ex._raw as unknown as Record<string, unknown>).updated_at).not.toBe(1000);
  });
});

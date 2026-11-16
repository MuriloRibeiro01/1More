import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { listCatalog, loadRoutine, saveRoutine, seedCatalog } from '../../src/routines/repository';
import type { ExerciseDraft } from '../../src/routines/types';
import { criarBancoDeTeste } from '../../test-utils/db';

// R-13 (Sérgio): routine_exercise tem identidade própria. Reordenar ou remover não pode trocar o exercício de uma linha.

type Raw = Record<string, unknown>;
const ativas = async (db: Database) =>
  (await db.get<Model>('routine_exercise').query().fetch()).map((m) => m._raw as unknown as Raw).filter((r) => r.deleted_at == null);

let db: Database;
let supino: string;
let agachamento: string;
let remada: string;

const ex = (exerciseId: string, over: Partial<ExerciseDraft> = {}): ExerciseDraft => ({
  exerciseId,
  sets: 3,
  weightKg: null,
  repsMin: null,
  repsMax: null,
  restSeconds: 90,
  ...over,
});

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const catalogo = await listCatalog(db);
  const id = (nome: string) => catalogo.find((e) => e.name === nome)!.id;
  supino = id('Supino reto com barra');
  agachamento = id('Agachamento livre');
  remada = catalogo.find((e) => e.id !== supino && e.id !== agachamento)!.id;
});

describe('identidade de routine_exercise (R-13)', () => {
  it('loadRoutine devolve o routineExerciseId de cada exercício', async () => {
    const id = await saveRoutine(db, { name: 'A', exercises: [ex(supino), ex(agachamento)] });
    const rotina = await loadRoutine(db, id);
    const ids = (await ativas(db)).map((r) => r.id);
    expect(rotina.exercises.map((e) => e.routineExerciseId).sort()).toEqual([...ids].sort());
  });

  it('reordenar mantém cada id colado ao seu exercício', async () => {
    const id = await saveRoutine(db, { name: 'A', exercises: [ex(supino), ex(agachamento)] });
    const [primeiro, segundo] = (await loadRoutine(db, id)).exercises;
    await saveRoutine(db, { id, name: 'A', exercises: [segundo, primeiro] });
    const depois = await loadRoutine(db, id);
    expect(depois.exercises.map((e) => [e.routineExerciseId, e.exerciseId])).toEqual([
      [segundo.routineExerciseId, agachamento],
      [primeiro.routineExerciseId, supino],
    ]);
  });

  it('remover o primeiro apaga só o id dele; o outro mantém id e exercício', async () => {
    const id = await saveRoutine(db, { name: 'A', exercises: [ex(supino), ex(agachamento)] });
    const [primeiro, segundo] = (await loadRoutine(db, id)).exercises;
    await saveRoutine(db, { id, name: 'A', exercises: [segundo] });
    const linhas = await ativas(db);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ id: segundo.routineExerciseId, exercise_id: agachamento });
    expect(linhas.map((r) => r.id)).not.toContain(primeiro.routineExerciseId);
  });

  it('exercício novo ganha id novo, sem herdar o de um removido', async () => {
    const id = await saveRoutine(db, { name: 'A', exercises: [ex(supino)] });
    const [antigo] = (await loadRoutine(db, id)).exercises;
    await saveRoutine(db, { id, name: 'A', exercises: [ex(remada)] });
    const [novo] = (await loadRoutine(db, id)).exercises;
    expect(novo.routineExerciseId).not.toBe(antigo.routineExerciseId);
    expect(novo.exerciseId).toBe(remada);
  });
});

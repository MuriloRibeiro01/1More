import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { resolvePending } from '../../src/workout/rules';
import type { ExerciseLog } from '../../src/workout/types';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-006e, item 1 (S1): "pendentes → concluir" não pode criar série concluída sem repetições,
// que `updateSet` já proíbe ("repetições inválidas"). As duas regras têm de concordar.
const T0 = Date.now() - 3_600_000;
const min = (n: number) => n * 60_000;

let db: Database;
let rotinaId: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const [ex] = await listCatalog(db);
  // sem reps alvo: as séries nascem com reps = null
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ex.id, sets: 3, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }],
  });
});

const linhasSet = async () =>
  (await db.get<Model>('workout_set').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);

describe('finishWorkout(pending: "complete") e séries sem repetições', () => {
  async function treinoComPendentes() {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    const [s1, s2, s3] = w.exercises[0].sets;
    await updateSet(db, s1.id, { weightKg: 60, reps: 10, completed: true }, T0 + min(5)); // concluída
    await updateSet(db, s2.id, { weightKg: 60, reps: 8 }, T0 + min(6)); // pendente COM reps
    // s3: pendente SEM reps (null)
    return { id, s2: s2.id, s3: s3.id };
  }

  it('nenhuma série fica concluída sem repetições', async () => {
    const { id } = await treinoComPendentes();
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(30) });
    const invalidas = (await linhasSet()).filter(
      (r) => r.deleted_at === null && r.completed_at !== null && !(typeof r.reps === 'number' && r.reps > 0),
    );
    expect(invalidas).toEqual([]);
  });

  it('a pendente com repetições é concluída; a sem repetições não é', async () => {
    const { id, s2, s3 } = await treinoComPendentes();
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(30) });
    const linhas = await linhasSet();
    expect(linhas.find((r) => r.id === s2)).toMatchObject({ completed_at: T0 + min(30), reps: 8 });
    expect(linhas.find((r) => r.id === s3)?.completed_at).toBeNull();
  });

  it('o treino termina normalmente (finalizado) mesmo com uma pendente sem repetições', async () => {
    const { id } = await treinoComPendentes();
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(30) });
    expect((await loadWorkout(db, id)).status).toBe('finished');
  });
});

describe('resolvePending("complete") — a regra pura concorda com updateSet', () => {
  const logs = (): ExerciseLog[] => [
    {
      exerciseId: 'e1',
      sets: [
        { type: 'normal', weightKg: 60, reps: 10, completedAt: 1 },
        { type: 'normal', weightKg: 60, reps: 8, completedAt: null },
        { type: 'normal', weightKg: 60, reps: null, completedAt: null },
      ],
    },
  ];

  it('conclui só as pendentes com repetições; a sem repetições não ganha completedAt', () => {
    const [e] = resolvePending(logs(), 'complete', 99);
    expect(e.sets.filter((s) => s.completedAt !== null).every((s) => (s.reps ?? 0) > 0)).toBe(true);
    expect(e.sets.find((s) => s.reps === 8)?.completedAt).toBe(99);
    expect(e.sets.find((s) => s.reps === null)?.completedAt ?? null).toBeNull();
  });

  it('não muta a entrada', () => {
    const entrada = logs();
    const copia = JSON.stringify(entrada);
    resolvePending(entrada, 'complete', 99);
    expect(JSON.stringify(entrada)).toBe(copia);
  });
});

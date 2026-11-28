import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-006e, bloqueante B2 do Sérgio (RN-03, RN-06): com `pending: 'complete'`, uma pendente SEM repetições não é concluída
// (S1) e, portanto, não pode puxar o fim do treino: ended_at = a última série REALMENTE concluída, não o toque em Finalizar.
// E ela não fica viva num treino finalizado: é tombstonada (deleted_at).
const T0 = Date.now() - 3_600_000;
const min = (n: number) => n * 60_000;

let db: Database;
let rotinaId: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const [ex] = await listCatalog(db);
  // reps alvo nulas: as séries nascem sem repetições
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ex.id, sets: 3, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }],
  });
});

const linhasSet = async () =>
  (await db.get<Model>('workout_set').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);

/** s1 concluída em T0+5; s2 e s3 pendentes. Quem recebe reps (ou não) é decidido pelo teste. */
async function preparar(repsDaSegunda: number | null) {
  const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
  const w = await loadWorkout(db, id);
  const [s1, s2, s3] = w.exercises[0].sets;
  await updateSet(db, s1.id, { weightKg: 60, reps: 10, completed: true }, T0 + min(5));
  if (repsDaSegunda !== null) await updateSet(db, s2.id, { weightKg: 60, reps: repsDaSegunda }, T0 + min(6));
  return { id, s2: s2.id, s3: s3.id };
}

describe('B2 — fim do treino com pendentes sem repetições', () => {
  it('só pendentes SEM reps: ended_at é a última série concluída (T0+5), não o toque em Finalizar (T0+30)', async () => {
    const { id } = await preparar(null); // s2 e s3 sem reps: nenhuma pendente vira concluída no ato
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(30) });
    const w = await loadWorkout(db, id);
    expect(w.status).toBe('finished');
    expect(w.endedAt).toBe(T0 + min(5));
  });

  it('as pendentes sem reps são tombstonadas (deleted_at) e não ficam vivas no treino finalizado', async () => {
    const { id, s2, s3 } = await preparar(null);
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(30) });
    const linhas = await linhasSet();
    expect(linhas.find((r) => r.id === s2)?.deleted_at).toBe(T0 + min(30));
    expect(linhas.find((r) => r.id === s3)?.deleted_at).toBe(T0 + min(30));
    const vivas = (await loadWorkout(db, id)).exercises.flatMap((e) => e.sets);
    expect(vivas).toHaveLength(1);
    expect(vivas[0].completedAt).toBe(T0 + min(5));
  });

  it('nenhuma série viva do treino finalizado fica pendente', async () => {
    const { id } = await preparar(null);
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(30) });
    const vivas = (await linhasSet()).filter((r) => r.deleted_at === null);
    expect(vivas.every((r) => r.completed_at !== null)).toBe(true);
  });

  it('controle (anti-máscara): uma pendente COM reps é concluída no ato, e aí ended_at = T0+30 (a última concluída é essa)', async () => {
    const { id, s2, s3 } = await preparar(8); // s2 com reps; s3 sem
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(30) });
    const linhas = await linhasSet();
    expect(linhas.find((r) => r.id === s2)?.completed_at).toBe(T0 + min(30));
    expect(linhas.find((r) => r.id === s3)?.deleted_at).toBe(T0 + min(30)); // a sem reps continua tombstonada
    expect((await loadWorkout(db, id)).endedAt).toBe(T0 + min(30));
  });

  it('com pending: "discard" o fim continua sendo a última série concluída (sem regressão)', async () => {
    const { id } = await preparar(8);
    await finishWorkout(db, id, { pending: 'discard', now: T0 + min(30) });
    expect((await loadWorkout(db, id)).endedAt).toBe(T0 + min(5));
  });
});

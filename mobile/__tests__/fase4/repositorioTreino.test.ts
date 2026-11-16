import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import {
  ActiveWorkoutError,
  NothingToSaveError,
  PendingSetsError,
  addExercise,
  addSet,
  discardWorkout,
  finishWorkout,
  getActiveWorkout,
  loadWorkout,
  removeExercise,
  repeatWorkout,
  startWorkout,
  updateSet,
} from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// Fase 4 — treino ativo e histórico no SQLite. Critérios: RN-02, RN-03, RN-05, RN-06, RN-20, RNF-02, UUID v7.

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Raw = Record<string, unknown>;
const linhas = async (db: Database, tabela: string): Promise<Raw[]> =>
  (await db.get<Model>(tabela).query().fetch()).map((m) => m._raw as unknown as Raw);
const ativas = (rs: Raw[]) => rs.filter((r) => r.deleted_at == null);

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const min = (n: number) => n * 60_000;

let db: Database;
let supino: string;
let agachamento: string;
let rotinaId: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const catalogo = await listCatalog(db);
  supino = catalogo.find((e) => e.name === 'Supino reto com barra')!.id;
  agachamento = catalogo.find((e) => e.name === 'Agachamento livre')!.id;
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [
      { exerciseId: supino, sets: 3, weightKg: 80, repsMin: 8, repsMax: 10, restSeconds: 90 },
      { exerciseId: agachamento, sets: 2, weightKg: null, repsMin: null, repsMax: null, restSeconds: 120 },
    ],
  });
});

describe('iniciar o treino', () => {
  it('da rotina: copia exercícios e séries pendentes com carga/reps alvo e descanso', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    expect(id).toMatch(UUID_V7);
    expect(w).toMatchObject({ name: 'Treino A', routineId: rotinaId, status: 'active', startedAt: T0, endedAt: null });
    expect(w.exercises.map((e) => [e.exerciseId, e.sets.length, e.restSeconds])).toEqual([
      [supino, 3, 90],
      [agachamento, 2, 120],
    ]);
    expect(w.exercises[0].sets[0]).toMatchObject({ type: 'normal', weightKg: 80, reps: 10, completedAt: null });
    expect(w.exercises[1].sets[0]).toMatchObject({ weightKg: null, reps: null, completedAt: null });
  });

  it('livre: sem exercícios, com o nome pedido', async () => {
    const id = await startWorkout(db, { name: 'Treino livre', now: T0 });
    expect(await loadWorkout(db, id)).toMatchObject({ name: 'Treino livre', routineId: null, exercises: [] });
  });

  it('só um treino ativo por aparelho (RN-02): o segundo falha apontando o ativo', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    await expect(startWorkout(db, { name: 'Outro', now: T0 + 1 })).rejects.toMatchObject({
      name: 'ActiveWorkoutError',
      activeId: id,
    });
    await expect(startWorkout(db, {})).rejects.toBeInstanceOf(ActiveWorkoutError);
    expect(ativas(await linhas(db, 'workout'))).toHaveLength(1);
  });

  it('grava o fuso do aparelho e as colunas de sync (user_id nulo, created/updated, deleted_at nulo)', async () => {
    const id = await startWorkout(db, { name: 'x', now: T0, tzOffsetMin: -180 });
    const [linha] = (await linhas(db, 'workout')).filter((r) => r.id === id);
    expect(linha).toMatchObject({ tz_offset_min: -180, status: 'active', user_id: null, created_at: T0, updated_at: T0, deleted_at: null });
  });

  it('getActiveWorkout: nulo sem treino; com treino traz a última atividade (início ou última série)', async () => {
    expect(await getActiveWorkout(db)).toBeNull();
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    expect(await getActiveWorkout(db)).toMatchObject({ id, name: 'Treino A', startedAt: T0, lastActivityAt: T0 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 80, reps: 10, completed: true }, T0 + min(7));
    expect((await getActiveWorkout(db))!.lastActivityAt).toBe(T0 + min(7));
  });
});

describe('séries (RNF-02: cada toque já está no banco)', () => {
  it('concluir grava carga, reps e completed_at na hora; desmarcar limpa o completed_at', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const setId = (await loadWorkout(db, id)).exercises[0].sets[0].id;
    await updateSet(db, setId, { weightKg: 82.555, reps: 9, completed: true }, T0 + 1000);
    let linha = (await linhas(db, 'workout_set')).find((r) => r.id === setId)!;
    expect(linha).toMatchObject({ weight_kg: 82.56, reps: 9, completed_at: T0 + 1000, updated_at: T0 + 1000 });
    await updateSet(db, setId, { completed: false }, T0 + 2000);
    linha = (await linhas(db, 'workout_set')).find((r) => r.id === setId)!;
    expect(linha).toMatchObject({ weight_kg: 82.56, reps: 9, completed_at: null });
  });

  it('tipo da série (A/D/F) e valores inválidos', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const setId = (await loadWorkout(db, id)).exercises[0].sets[0].id;
    await updateSet(db, setId, { type: 'warmup' }, T0 + 1);
    expect((await loadWorkout(db, id)).exercises[0].sets[0].type).toBe('warmup');
    await expect(updateSet(db, setId, { reps: 0, completed: true }, T0)).rejects.toThrow();
    await expect(updateSet(db, setId, { weightKg: -1 }, T0)).rejects.toThrow();
    await expect(updateSet(db, setId, { reps: 2.5 }, T0)).rejects.toThrow();
  });

  it('+ série copia carga e reps da última; + exercício entra com 1 série; remover faz tombstone', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[1].sets[1].id, { weightKg: 100, reps: 5 }, T0);
    await addSet(db, w.exercises[1].id, T0 + 1);
    const depois = await loadWorkout(db, id);
    expect(depois.exercises[1].sets).toHaveLength(3);
    expect(depois.exercises[1].sets[2]).toMatchObject({ weightKg: 100, reps: 5, completedAt: null, type: 'normal' });

    await addExercise(db, id, supino, T0 + 2);
    const com3 = await loadWorkout(db, id);
    expect(com3.exercises).toHaveLength(3);
    expect(com3.exercises[2].sets).toHaveLength(1);

    await removeExercise(db, com3.exercises[0].id, T0 + 3);
    expect((await loadWorkout(db, id)).exercises.map((e) => e.exerciseId)).toEqual([agachamento, supino]);
    expect(ativas(await linhas(db, 'workout_exercise'))).toHaveLength(2);
    expect((await linhas(db, 'workout_exercise')).filter((r) => r.deleted_at != null)).toHaveLength(1);
  });

  it('valores da sessão anterior entram sozinhos no próximo treino do mesmo exercício', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 85, reps: 8, completed: true }, T0 + min(5));
    await finishWorkout(db, id, { pending: 'discard', now: T0 + min(30) });

    const novo = await loadWorkout(db, await startWorkout(db, { routineId: rotinaId, now: T0 + min(2000) }));
    expect(novo.exercises[0].sets[0]).toMatchObject({ weightKg: 85, reps: 8, completedAt: null });
    // as séries sem equivalente na sessão anterior ficam com o alvo da rotina
    expect(novo.exercises[0].sets[1]).toMatchObject({ weightKg: 80, reps: 10 });
  });
});

describe('finalizar (RN-03, RN-05, RN-06)', () => {
  async function comSeries(concluidas: number) {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    for (let i = 0; i < concluidas; i++) {
      await updateSet(db, w.exercises[0].sets[i].id, { weightKg: 80, reps: 10, completed: true }, T0 + min(10 * (i + 1)));
    }
    return id;
  }

  it('tudo concluído: finaliza com ended_at = última série concluída, não o toque em Finalizar', async () => {
    const id = await startWorkout(db, { name: 'Livre', now: T0 });
    await addExercise(db, id, supino, T0 + 1);
    const setId = (await loadWorkout(db, id)).exercises[0].sets[0].id;
    await updateSet(db, setId, { weightKg: 60, reps: 10, completed: true }, T0 + min(40));
    await finishWorkout(db, id, { now: T0 + min(90) });
    expect(await loadWorkout(db, id)).toMatchObject({ status: 'finished', endedAt: T0 + min(40) });
    expect(await getActiveWorkout(db)).toBeNull();
  });

  it('nenhuma série concluída: não salva (RN-05) e o treino segue ativo até descartar', async () => {
    const id = await comSeries(0);
    await expect(finishWorkout(db, id, { now: T0 + 5 })).rejects.toBeInstanceOf(NothingToSaveError);
    expect((await loadWorkout(db, id)).status).toBe('active');
  });

  it('com pendentes pergunta (RN-06); sem resposta não muda nada', async () => {
    const id = await comSeries(1);
    await expect(finishWorkout(db, id, { now: T0 + min(60) })).rejects.toBeInstanceOf(PendingSetsError);
    expect((await loadWorkout(db, id)).status).toBe('active');
  });

  it('pendentes → concluir: marca com os valores preenchidos e finaliza', async () => {
    const id = await comSeries(1);
    await finishWorkout(db, id, { pending: 'complete', now: T0 + min(60) });
    const w = await loadWorkout(db, id);
    expect(w.status).toBe('finished');
    expect(w.exercises.flatMap((e) => e.sets).every((s) => s.completedAt !== null)).toBe(true);
    expect(w.endedAt).toBe(T0 + min(60));
  });

  it('pendentes → descartar: tombstone nas séries pendentes e nos exercícios que ficam vazios', async () => {
    const id = await comSeries(1);
    await finishWorkout(db, id, { pending: 'discard', now: T0 + min(60) });
    const w = await loadWorkout(db, id);
    expect(w.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([[supino, 1]]);
    expect(w.endedAt).toBe(T0 + min(10));
    expect((await linhas(db, 'workout_set')).filter((r) => r.deleted_at != null)).toHaveLength(4);
  });

  it('atomicidade: falha na gravação mantém o treino ativo e as séries como estavam', async () => {
    const id = await comSeries(1);
    const spy = jest.spyOn(db, 'batch').mockRejectedValueOnce(new Error('disco cheio'));
    await expect(finishWorkout(db, id, { pending: 'complete', now: T0 + min(60) })).rejects.toThrow('disco cheio');
    spy.mockRestore();
    const w = await loadWorkout(db, id);
    expect(w.status).toBe('active');
    expect(w.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt !== null)).toHaveLength(1);
  });
});

describe('descartar e repetir', () => {
  it('descartar faz tombstone do treino e dos filhos (RN-20) e libera um novo treino', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    await discardWorkout(db, id, T0 + 10);
    expect(await getActiveWorkout(db)).toBeNull();
    for (const t of ['workout', 'workout_exercise', 'workout_set']) {
      const rs = await linhas(db, t);
      expect(rs.length).toBeGreaterThan(0);
      expect(ativas(rs)).toHaveLength(0);
    }
    await expect(startWorkout(db, { name: 'novo', now: T0 + 20 })).resolves.toMatch(UUID_V7);
  });

  it('repetir cria treino ativo com os mesmos exercícios e valores, tudo pendente', async () => {
    const id = await startWorkout(db, { routineId: rotinaId, now: T0 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 90, reps: 6, completed: true }, T0 + min(5));
    await finishWorkout(db, id, { pending: 'discard', now: T0 + min(20) });

    const copia = await loadWorkout(db, await repeatWorkout(db, id, T0 + min(3000)));
    expect(copia).toMatchObject({ status: 'active', name: 'Treino A', routineId: rotinaId, startedAt: T0 + min(3000) });
    expect(copia.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([[supino, 1]]);
    expect(copia.exercises[0].sets[0]).toMatchObject({ weightKg: 90, reps: 6, completedAt: null });
    expect(copia.id).not.toBe(id);
  });

  it('repetir com outro treino ativo falha (RN-02)', async () => {
    const id = await startWorkout(db, { name: 'a', now: T0 });
    await addExercise(db, id, supino, T0 + 1);
    await updateSet(db, (await loadWorkout(db, id)).exercises[0].sets[0].id, { weightKg: 50, reps: 5, completed: true }, T0 + 2);
    await finishWorkout(db, id, { now: T0 + 3 });
    await startWorkout(db, { name: 'b', now: T0 + 4 });
    await expect(repeatWorkout(db, id, T0 + 5)).rejects.toBeInstanceOf(ActiveWorkoutError);
  });
});

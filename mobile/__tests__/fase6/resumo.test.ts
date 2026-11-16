import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { buildSummary, formatDuration, loadSummary, saveNotes } from '../../src/workout/summary';
import type { WorkoutSnapshot } from '../../src/workout/repository';
import type { SetLog } from '../../src/workout/types';
import { criarBancoDeTeste } from '../../test-utils/db';

// Fase 6 — resumo do treino finalizado (RF-38, RF-40, RN-03, RN-08, RN-09, RN-11).
const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const min = (n: number) => n * 60_000;

const s = (weightKg: number | null, reps: number | null, at: number | null, type: SetLog['type'] = 'normal') => ({
  id: `s-${Math.random()}`, type, weightKg, reps, completedAt: at,
});
const treino = (exercises: { id: string; name: string; sets: ReturnType<typeof s>[] }[]): WorkoutSnapshot => ({
  id: 'w', name: 'A', routineId: null, status: 'finished', startedAt: T0, endedAt: null, tzOffsetMin: -180, notes: null,
  exercises: exercises.map((e) => ({ id: `we-${e.id}`, exerciseId: e.id, name: e.name, restSeconds: 90, sets: e.sets })),
});
const log = (weightKg: number, reps: number): SetLog => ({ type: 'normal', weightKg, reps, completedAt: 1 });

describe('formatDuration', () => {
  it.each([
    [null, '—'],
    [0, '0 min'],
    [min(52), '52 min'],
    [min(59.6), '1 h 00 min'],
    [min(65), '1 h 05 min'],
    [min(130), '2 h 10 min'],
  ])('%p → %p', (ms, texto) => expect(formatDuration(ms as number | null)).toBe(texto));
});

describe('buildSummary', () => {
  it('duração até a última série concluída, volume e séries só das válidas (aquecimento e pendentes fora)', () => {
    const r = buildSummary(
      treino([
        { id: 'sup', name: 'Supino', sets: [s(40, 12, T0 + min(2), 'warmup'), s(80, 10, T0 + min(8)), s(80, 8, T0 + min(14)), s(80, 8, null)] },
        { id: 'agu', name: 'Agachamento', sets: [s(100, 5, T0 + min(40))] },
      ]),
      {},
    );
    expect(r.durationMs).toBe(min(40));
    expect(r.validSets).toBe(3);
    expect(r.volumeKg).toBe(80 * 10 + 80 * 8 + 100 * 5);
  });

  it('treino sem séries concluídas: duração nula e tudo zero', () => {
    expect(buildSummary(treino([{ id: 'sup', name: 'Supino', sets: [s(80, 10, null)] }]), {})).toMatchObject({
      durationMs: null, volumeKg: 0, validSets: 0, records: [],
    });
  });

  it('recordes: compara com o histórico; sem histórico não há recorde', () => {
    const t = treino([{ id: 'sup', name: 'Supino', sets: [s(82.5, 8, T0 + min(5))] }]);
    expect(buildSummary(t, {}).records).toEqual([]);
    const r = buildSummary(t, { sup: [log(80, 10)] });
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ exerciseId: 'sup', name: 'Supino', weightKg: 82.5, reps: 8 });
    // 82,5×8 tem 1RM (104,5) menor que 80×10 (106,7): só a carga é recorde
    expect(r.records[0].types).toEqual(['weight']);
  });

  it('um recorde por exercício: a última série que bateu recorde, com os tipos acumulados', () => {
    const t = treino([
      { id: 'sup', name: 'Supino', sets: [s(82.5, 8, T0 + min(5)), s(85, 8, T0 + min(10)), s(70, 10, T0 + min(15))] },
    ]);
    const r = buildSummary(t, { sup: [log(80, 10)] });
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ weightKg: 85, reps: 8 });
  });

  it('séries anteriores do mesmo treino entram na comparação (repetir a carga não é recorde)', () => {
    const t = treino([{ id: 'sup', name: 'Supino', sets: [s(85, 8, T0 + min(5)), s(85, 8, T0 + min(10))] }]);
    const r = buildSummary(t, { sup: [log(80, 10)] });
    expect(r.records.map((x) => x.weightKg)).toEqual([85]);
  });

  it('aquecimento nunca gera recorde', () => {
    const t = treino([{ id: 'sup', name: 'Supino', sets: [s(200, 5, T0 + min(1), 'warmup')] }]);
    expect(buildSummary(t, { sup: [log(80, 10)] }).records).toEqual([]);
  });
});

describe('loadSummary e saveNotes (banco)', () => {
  let db: Database;
  let supino: string;
  let rotinaId: string;

  beforeEach(async () => {
    db = criarBancoDeTeste();
    await seedCatalog(db);
    supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
    rotinaId = await saveRoutine(db, {
      name: 'A',
      exercises: [{ exerciseId: supino, sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
    });
  });

  async function feito(inicio: number, carga: number) {
    const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin: 0 });
    const w = await loadWorkout(db, id);
    await updateSet(db, w.exercises[0].sets[0].id, { weightKg: carga, reps: 10, completed: true }, inicio + min(9));
    await finishWorkout(db, id, { pending: 'discard', now: inicio + min(30) });
    return id;
  }

  it('lê duração, volume, recordes contra os treinos anteriores e a semana', async () => {
    await feito(T0 - 3 * 86_400_000, 60);
    const id = await feito(T0, 65);
    const r = await loadSummary(db, id);
    expect(r).toMatchObject({ name: 'A', startedAt: T0, durationMs: min(9), volumeKg: 650, validSets: 1, notes: null });
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ name: 'Supino reto com barra', weightKg: 65 });
    expect(r.weekDays).toBeGreaterThanOrEqual(1);
  });

  it('só treinos anteriores contam como histórico (ver um treino antigo não usa os mais novos)', async () => {
    const antigo = await feito(T0, 65);
    await feito(T0 + 5 * 86_400_000, 100);
    expect((await loadSummary(db, antigo)).records).toEqual([]);
  });

  it('o primeiro treino não tem recordes (o próprio treino não conta como histórico)', async () => {
    const id = await feito(T0, 65);
    expect((await loadSummary(db, id)).records).toEqual([]);
  });

  it('nota: salva com o treino, apara espaços e vazio vira nulo', async () => {
    const id = await feito(T0, 65);
    await saveNotes(db, id, '  Ombro estalando  ');
    expect((await loadSummary(db, id)).notes).toBe('Ombro estalando');
    expect((await loadWorkout(db, id)).notes).toBe('Ombro estalando');
    await saveNotes(db, id, '   ');
    expect((await loadSummary(db, id)).notes).toBeNull();
  });
});

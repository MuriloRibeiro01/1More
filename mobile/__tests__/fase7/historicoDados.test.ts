import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { createRetroactiveWorkout, discardWorkout, finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { groupByWeek, listWorkoutHistory, weekRangeLabel, workoutsByDay, type HistoryItem } from '../../src/workout/history';
import { criarBancoDeTeste } from '../../test-utils/db';

// Fase 7 — dados da aba Histórico: só treinos finalizados com série concluída; semana (segunda) e dia local (RN-24).
const min = (n: number) => n * 60_000;
const DIA = 86_400_000;
const T0 = Date.UTC(2026, 10, 12, 13, 0, 0); // qui 12/11/2026 13:00 UTC

let db: Database;
let supino: string;
let rotinaId: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [{ exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});

/** Treino finalizado: 1ª série em +10 min (aquecimento opcional em +5), 2ª em `fim` min. */
async function feito(inicio: number, opts: { fim?: number; aquecimento?: boolean; tz?: number; name?: string } = {}) {
  const id = await startWorkout(db, { routineId: rotinaId, name: opts.name, now: inicio, tzOffsetMin: opts.tz ?? 0 });
  const w = await loadWorkout(db, id);
  const [a, b, c] = w.exercises[0].sets;
  if (opts.aquecimento) await updateSet(db, c.id, { type: 'warmup', weightKg: 20, reps: 10, completed: true }, inicio + min(5));
  await updateSet(db, a.id, { weightKg: 60, reps: 10, completed: true }, inicio + min(10));
  await updateSet(db, b.id, { weightKg: 70, reps: 5, completed: true }, inicio + min(opts.fim ?? 25));
  await finishWorkout(db, id, { pending: 'discard', now: inicio + min(60) });
  return id;
}

describe('listWorkoutHistory', () => {
  it('sem treinos devolve vazio', async () => {
    expect(await listWorkoutHistory(db)).toEqual([]);
  });

  it('traz só finalizados e não excluídos com série concluída, do mais novo ao mais antigo', async () => {
    const velho = await feito(T0 - 5 * DIA);
    const novo = await feito(T0);
    await startWorkout(db, { name: 'ativo', now: T0 + DIA }); // ativo não entra
    await createRetroactiveWorkout(db, { startedAt: T0 - DIA, now: T0 + DIA }); // finalizado e vazio fica oculto
    const lista = await listWorkoutHistory(db);
    expect(lista.map((i) => i.id)).toEqual([novo, velho]);
  });

  it('calcula nome, fuso, duração até a última série, séries válidas e volume', async () => {
    const id = await feito(T0, { aquecimento: true, fim: 30, tz: -180 });
    const [item] = await listWorkoutHistory(db);
    expect(item).toMatchObject({
      id, name: 'Treino A', startedAt: T0, tzOffsetMin: -180,
      durationMs: min(30), // aquecimento (5 min) não é a última; a série de 30 min é
      validSets: 2, // aquecimento não conta (RN-08)
      volumeKg: 60 * 10 + 70 * 5,
    });
  });

  it('treino excluído (tombstone) some da lista', async () => {
    const id = await feito(T0);
    await discardWorkout(db, id, T0 + DIA);
    expect(await listWorkoutHistory(db)).toEqual([]);
  });
});

const item = (id: string, startedAt: number, tz = 0): HistoryItem => ({ id, name: id, startedAt, tzOffsetMin: tz, durationMs: min(30), validSets: 2, volumeKg: 100 });

describe('groupByWeek (semana começa na segunda, RN-24)', () => {
  it('agrupa pela segunda-feira, grupos do mais novo ao mais antigo', () => {
    // 12/11/2026 é quinta; 8/11 domingo (semana anterior); 9/11 segunda (mesma semana)
    const g = groupByWeek([item('qui', T0), item('seg', T0 - 3 * DIA), item('dom', T0 - 4 * DIA), item('velho', T0 - 20 * DIA)]);
    expect(g.map((x) => x.items.map((i) => i.id))).toEqual([['qui', 'seg'], ['dom'], ['velho']]);
    expect(g[0].weekStart.getDay()).toBe(1);
    expect(g[0].weekStart.getDate()).toBe(9);
  });

  it('usa o dia local gravado: domingo 23h30 em UTC-3 continua na semana que acabou', () => {
    const domNoite = Date.UTC(2026, 10, 9, 2, 30, 0); // 02:30 UTC de segunda = domingo 23:30 em UTC-3
    const g = groupByWeek([item('noite', domNoite, -180), item('seg', T0 - 3 * DIA)]);
    expect(g.map((x) => x.items.map((i) => i.id))).toEqual([['seg'], ['noite']]);
  });
});

describe('workoutsByDay (RN-24)', () => {
  it('chave é o dia local do início, com o fuso de cada treino; vários no mesmo dia, o mais novo primeiro', () => {
    const m = workoutsByDay([
      item('a', Date.UTC(2026, 10, 12, 1, 0, 0), -180), // 11/11 22:00 local
      item('b', Date.UTC(2026, 10, 12, 15, 0, 0), -180), // 12/11 12:00 local
      item('c', Date.UTC(2026, 10, 12, 20, 0, 0), -180), // 12/11 17:00 local
    ]);
    expect([...m.keys()].sort()).toEqual(['2026-11-11', '2026-11-12']);
    expect(m.get('2026-11-12')!.map((i) => i.id)).toEqual(['c', 'b']);
    expect(m.get('2026-11-11')!.map((i) => i.id)).toEqual(['a']);
  });
});

describe('weekRangeLabel', () => {
  it('mesmo mês: "9–15 nov"; meses diferentes: "26 out – 1 nov"', () => {
    expect(weekRangeLabel(new Date(2026, 10, 9), 'pt-BR')).toBe('9–15 nov');
    expect(weekRangeLabel(new Date(2026, 9, 26), 'pt-BR')).toBe('26 out – 1 nov');
  });
});

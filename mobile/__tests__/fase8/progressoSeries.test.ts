import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import type { ExerciseSession } from '../../src/workout/sessions';
import { metricSeries, scalePoints } from '../../src/progress/series';
import { weeklyMuscleSets } from '../../src/progress/weeklyMuscles';
import { criarBancoDeTeste } from '../../test-utils/db';

// Fase 8 — Progresso: séries do gráfico (RN-10, RN-11) e séries por músculo na semana (RF-45).
const D = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 10, 0, 0);
const set = (w: number, r: number) => ({ type: 'normal' as const, weightKg: w, reps: r, completedAt: 1 });
const sessao = (i: number, sets: ReturnType<typeof set>[]): ExerciseSession => ({
  workoutId: `w${i}`, startedAt: T0 + i * D, tzOffsetMin: 0, sets,
});

describe('metricSeries', () => {
  const sessoes = [
    sessao(0, [set(60, 10), set(60, 8)]),
    sessao(1, [set(62.5, 10), set(65, 10)]),
    sessao(2, [set(60, 10)]),
    sessao(3, [set(70, 5)]),
  ];

  it('1RM: o maior Epley da sessão (só 1 a 12 reps)', () => {
    expect(metricSeries(sessoes, 'oneRm').map((p) => p.y)).toEqual([80, 86.67, 80, 81.67]);
  });

  it('1RM ignora sessões sem série entre 1 e 12 reps', () => {
    expect(metricSeries([sessao(0, [set(20, 15)]), sessao(1, [set(60, 10)])], 'oneRm')).toHaveLength(1);
  });

  it('melhor série: a maior carga da sessão', () => {
    expect(metricSeries(sessoes, 'bestSet').map((p) => p.y)).toEqual([60, 65, 60, 70]);
  });

  it('volume: soma carga×reps das séries válidas', () => {
    expect(metricSeries(sessoes, 'volume').map((p) => p.y)).toEqual([1080, 1275, 600, 350]);
  });

  it('marca como recorde o ponto que supera todos os anteriores (o primeiro nunca é)', () => {
    expect(metricSeries(sessoes, 'bestSet').map((p) => p.record)).toEqual([false, true, false, true]);
    expect(metricSeries(sessoes, 'volume').map((p) => p.record)).toEqual([false, true, false, false]);
  });

  it('x é o início do treino e guarda o id do treino; sem sessões devolve vazio', () => {
    const [p] = metricSeries(sessoes, 'volume');
    expect(p).toMatchObject({ x: T0, workoutId: 'w0' });
    expect(metricSeries([], 'volume')).toEqual([]);
  });
});

describe('scalePoints', () => {
  const area = { width: 300, height: 100, pad: 10 };

  it('x proporcional ao tempo, y invertido (maior valor em cima) dentro do padding', () => {
    const r = scalePoints([{ x: 0, y: 10 }, { x: 50, y: 30 }, { x: 100, y: 20 }], area);
    expect(r.map((p) => Math.round(p.px))).toEqual([10, 150, 290]);
    expect(r.map((p) => Math.round(p.py))).toEqual([90, 10, 50]);
  });

  it('um ponto só (ou valores iguais) fica centrado, sem dividir por zero', () => {
    expect(scalePoints([{ x: 5, y: 7 }], area)).toEqual([{ x: 5, y: 7, px: 150, py: 50 }]);
    const iguais = scalePoints([{ x: 0, y: 7 }, { x: 10, y: 7 }], area);
    expect(iguais.map((p) => p.py)).toEqual([50, 50]);
    expect(iguais.every((p) => Number.isFinite(p.px))).toBe(true);
  });

  it('preserva campos extras do ponto (record)', () => {
    expect(scalePoints([{ x: 0, y: 1, record: true }], area)[0]).toMatchObject({ record: true });
  });
});

describe('weeklyMuscleSets (banco)', () => {
  let db: Database;
  let rotinaId: string;
  const weekStart = new Date(2026, 10, 9); // segunda, 9 nov 2026 (local)

  beforeEach(async () => {
    db = criarBancoDeTeste();
    await seedCatalog(db);
    const cat = await listCatalog(db);
    const id = (n: string) => cat.find((e) => e.name === n)!.id;
    rotinaId = await saveRoutine(db, {
      name: 'A',
      exercises: [
        { exerciseId: id('Supino reto com barra'), sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
        { exerciseId: id('Agachamento livre'), sets: 2, weightKg: 100, repsMin: null, repsMax: 5, restSeconds: 90 },
      ],
    });
  });

  async function treino(inicio: number, feitas: number[]) {
    const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin: 0 });
    const w = await loadWorkout(db, id);
    let t = 1;
    for (let e = 0; e < w.exercises.length; e++) {
      for (let i = 0; i < (feitas[e] ?? 0); i++) {
        await updateSet(db, w.exercises[e].sets[i].id, { weightKg: 50, reps: 10, completed: true }, inicio + t++ * 60_000);
      }
    }
    await finishWorkout(db, id, { pending: 'discard', now: inicio + 3_600_000 });
  }

  it('conta séries válidas por músculo primário, maior primeiro', async () => {
    await treino(weekStart.getTime() + D + 10 * 3_600_000, [3, 1]);
    expect(await weeklyMuscleSets(db, weekStart)).toEqual([
      { muscle: 'chest', sets: 3 },
      { muscle: 'quads', sets: 1 },
    ]);
  });

  it('soma vários treinos da semana e ignora os de fora e o aquecimento/pendentes', async () => {
    await treino(weekStart.getTime() + 10 * 3_600_000, [2, 0]);
    await treino(weekStart.getTime() + 3 * D + 10 * 3_600_000, [1, 2]);
    await treino(weekStart.getTime() - 2 * D, [3, 2]); // semana anterior
    await treino(weekStart.getTime() + 8 * D, [3, 2]); // semana seguinte
    expect(await weeklyMuscleSets(db, weekStart)).toEqual([
      { muscle: 'chest', sets: 3 },
      { muscle: 'quads', sets: 2 },
    ]);
  });

  it('sem treinos na semana devolve vazio', async () => {
    expect(await weeklyMuscleSets(db, weekStart)).toEqual([]);
  });
});

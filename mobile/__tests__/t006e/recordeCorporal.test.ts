import { describe, expect, it } from '@jest/globals';
import { exerciseRecords } from '../../src/exercise/records';
import type { ExerciseSession } from '../../src/workout/sessions';
import { prsForSet } from '../../src/workout/rules';

// T-006e, item 4 (S8, RN-11): exercício de peso corporal (barra fixa, flexão) é registrado com 0 kg ou sem carga.
// Carga 0 não é "maior carga": não vale recorde de carga. O recorde de repetições continua valendo.
const sessao = (id: string, dia: number, series: [number | null, number][]): ExerciseSession => ({
  workoutId: id,
  startedAt: Date.UTC(2026, 10, dia, 10),
  tzOffsetMin: 0,
  sets: series.map(([weightKg, reps]) => ({ type: 'normal' as const, weightKg, reps, completedAt: 1 })),
});

describe('exerciseRecords com peso corporal', () => {
  it('só séries sem carga: não existe recorde de carga, mas existe o de repetições', () => {
    const r = exerciseRecords([sessao('a', 1, [[null, 12]]), sessao('b', 2, [[0, 15]])]);
    expect(r.weight).toBeUndefined();
    expect(r.reps).toMatchObject({ reps: 15 });
  });

  it('carga 0 explícita também não é recorde de carga', () => {
    expect(exerciseRecords([sessao('a', 1, [[0, 10]])]).weight).toBeUndefined();
  });

  it('com uma série carregada (lastro de 10 kg) o recorde de carga é ela, não o 0', () => {
    const r = exerciseRecords([sessao('a', 1, [[0, 20]]), sessao('b', 2, [[10, 8]])]);
    expect(r.weight).toMatchObject({ weightKg: 10, reps: 8 });
  });

  it('não gera 1RM nem volume para peso corporal (carga 0)', () => {
    const r = exerciseRecords([sessao('a', 1, [[0, 12]])]);
    expect(r.oneRm).toBeUndefined();
    expect(r.setVolume).toBeUndefined();
  });
});

describe('prsForSet com peso corporal (controle: já vale hoje)', () => {
  const prev = [{ type: 'normal' as const, weightKg: 0, reps: 10, completedAt: 1 }];
  it('0 kg × 12 depois de 0 kg × 10: só repetições, nunca carga', () => {
    const prs = prsForSet({ type: 'normal', weightKg: 0, reps: 12, completedAt: 2 }, prev);
    expect(prs).toContain('repsAtWeight');
    expect(prs).not.toContain('weight');
  });
});

import { describe, expect, it } from '@jest/globals';
import { exerciseRecords } from '../../src/exercise/records';
import type { ExerciseSession } from '../../src/workout/sessions';

// Recordes de um exercício (RN-11), derivados das sessões. Empate: vale quem bateu primeiro.
const sessao = (id: string, startedAt: number, sets: [number | null, number][]): ExerciseSession => ({
  workoutId: id, startedAt, tzOffsetMin: 0,
  sets: sets.map(([weightKg, reps]) => ({ type: 'normal' as const, weightKg, reps, completedAt: startedAt })),
});

describe('exerciseRecords', () => {
  it('sem sessões não há recorde nenhum', () => {
    expect(exerciseRecords([])).toEqual({});
  });

  it('maior carga: desempate por mais reps e depois pela ocorrência mais antiga', () => {
    const r = exerciseRecords([
      sessao('a', 1, [[80, 8]]),
      sessao('b', 2, [[100, 5], [100, 6]]),
      sessao('c', 3, [[100, 6]]),
    ]);
    expect(r.weight).toMatchObject({ weightKg: 100, reps: 6, workoutId: 'b', startedAt: 2, value: 100 });
  });

  it('1RM por Epley, só com 1 a 12 reps (13+ reps não entram)', () => {
    const r = exerciseRecords([sessao('a', 1, [[100, 5], [60, 20], [90, 12]])]);
    // 100×5 = 116,67 · 90×12 = 126 · 60×20 não conta
    expect(r.oneRm).toMatchObject({ weightKg: 90, reps: 12, value: 126 });
    expect(exerciseRecords([sessao('a', 1, [[60, 20]])]).oneRm).toBeUndefined();
  });

  it('maior volume numa série (carga × reps)', () => {
    const r = exerciseRecords([sessao('a', 1, [[100, 5], [60, 15], [80, 10]])]);
    expect(r.setVolume).toMatchObject({ weightKg: 60, reps: 15, value: 900 }); // 100×5=500 · 60×15=900 · 80×10=800
  });

  it('mais repetições: desempate por carga maior', () => {
    const r = exerciseRecords([sessao('a', 1, [[40, 20], [50, 20], [100, 5]])]);
    expect(r.reps).toMatchObject({ weightKg: 50, reps: 20, value: 20 });
  });

  it('empate exato vale a ocorrência mais antiga', () => {
    const r = exerciseRecords([sessao('novo', 9, [[80, 8]]), sessao('velho', 3, [[80, 8]])]);
    expect(r.weight!.workoutId).toBe('velho');
    expect(r.setVolume!.workoutId).toBe('velho');
  });

  it('carga nula (peso corporal) conta como 0 kg e só aparecem recordes de reps', () => {
    const r = exerciseRecords([sessao('a', 1, [[null, 12]])]);
    expect(r.reps).toMatchObject({ weightKg: 0, reps: 12 });
    expect(r.weight).toMatchObject({ weightKg: 0 });
  });
});

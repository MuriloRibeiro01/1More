import { describe, expect, it } from '@jest/globals';
import { suggestLoad } from '../../src/exercise/suggestion';
import type { ExerciseSession } from '../../src/workout/sessions';

// RN-12 (progressão dupla), SEMPRE só sugestão. Decisões documentadas aqui:
//  - usa a ÚLTIMA sessão; carga de trabalho = a maior carga entre as séries válidas dela;
//  - sobe quando TODAS as séries válidas da última sessão chegaram ao topo da faixa (repsMax);
//  - reduz 10% quando TODAS as séries válidas de CADA UMA das 2 últimas sessões ficaram abaixo do mínimo;
//  - senão mantém. Sem sessão ou sem faixa de reps: nada a sugerir (null).
const s = (startedAt: number, sets: [number, number][]): ExerciseSession => ({
  workoutId: `w${startedAt}`, startedAt, tzOffsetMin: 0,
  sets: sets.map(([weightKg, reps]) => ({ type: 'normal' as const, weightKg, reps, completedAt: startedAt })),
});
const faixa = { repsMin: 8, repsMax: 10 };

describe('suggestLoad', () => {
  it('sem sessões ou sem faixa de reps não sugere nada', () => {
    expect(suggestLoad({ sessions: [], ...faixa })).toBeNull();
    expect(suggestLoad({ sessions: [s(1, [[80, 10]])], repsMin: null, repsMax: null })).toBeNull();
  });

  it('sobe o incremento quando todas as séries bateram o topo da faixa', () => {
    expect(suggestLoad({ sessions: [s(1, [[80, 10], [80, 10], [82.5, 11]])], ...faixa })).toEqual({ kind: 'raise', weightKg: 85 });
  });

  it('o incremento é configurável (padrão 2,5 kg)', () => {
    expect(suggestLoad({ sessions: [s(1, [[40, 10]])], ...faixa, incrementKg: 1.25 })).toEqual({ kind: 'raise', weightKg: 41.25 });
  });

  it('uma série abaixo do topo basta para manter a carga', () => {
    expect(suggestLoad({ sessions: [s(1, [[80, 10], [80, 9]])], ...faixa })).toEqual({ kind: 'keep', weightKg: 80 });
  });

  it('só olha a última sessão para subir', () => {
    expect(suggestLoad({ sessions: [s(1, [[80, 10]]), s(2, [[80, 9]])], ...faixa })).toEqual({ kind: 'keep', weightKg: 80 });
  });

  it('abaixo do mínimo em 2 sessões seguidas sugere reduzir 10% (2 casas)', () => {
    const r = suggestLoad({ sessions: [s(1, [[82.5, 6], [82.5, 7]]), s(2, [[82.5, 5], [82.5, 7]])], ...faixa });
    expect(r).toEqual({ kind: 'reduce', weightKg: 74.25 });
  });

  it('abaixo do mínimo em uma sessão só mantém', () => {
    expect(suggestLoad({ sessions: [s(1, [[80, 9]]), s(2, [[80, 6]])], ...faixa })).toEqual({ kind: 'keep', weightKg: 80 });
  });

  it('uma série dentro da faixa numa das 2 sessões impede reduzir', () => {
    expect(suggestLoad({ sessions: [s(1, [[80, 6], [80, 8]]), s(2, [[80, 6]])], ...faixa })).toEqual({ kind: 'keep', weightKg: 80 });
  });

  it('com uma única sessão abaixo do mínimo não há 2 seguidas: mantém', () => {
    expect(suggestLoad({ sessions: [s(1, [[80, 5]])], ...faixa })).toEqual({ kind: 'keep', weightKg: 80 });
  });

  it('faixa só com topo (sem mínimo) nunca reduz', () => {
    expect(suggestLoad({ sessions: [s(1, [[80, 3]]), s(2, [[80, 3]])], repsMin: null, repsMax: 10 })).toEqual({ kind: 'keep', weightKg: 80 });
  });

  it('usa a maior carga da última sessão como carga de trabalho', () => {
    expect(suggestLoad({ sessions: [s(1, [[60, 10], [80, 10]])], ...faixa })).toEqual({ kind: 'raise', weightKg: 82.5 });
  });
});

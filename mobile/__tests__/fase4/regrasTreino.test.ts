import { describe, expect, it } from '@jest/globals';
import {
  STALE_MS,
  dayXp,
  epley1RM,
  finishDecision,
  grantsXp,
  isForgotten,
  isPurgeable,
  isValidSet,
  kgToLb,
  lbToKg,
  overlaps,
  pickTodayRoutine,
  prsForSet,
  resolvePending,
  roundToIncrement,
  setVolume,
  validateRetroactive,
  workoutDuration,
  workoutVolume,
} from '../../src/workout/rules';
import { daysTrainedInWeek, localDayKey, startOfWeek } from '../../src/workout/week';
import type { ExerciseLog, SetLog } from '../../src/workout/types';

// Fase 4 — regras puras do treino (RN-03 a RN-16, RN-20, RN-24). Escritas antes do código (TDD).

const H = 3_600_000;
const D = 24 * H;
const done = (weightKg: number | null, reps: number | null, at = 1000, type: SetLog['type'] = 'normal'): SetLog => ({
  type,
  weightKg,
  reps,
  completedAt: at,
});
const pending = (weightKg: number | null = 80, reps: number | null = 10, type: SetLog['type'] = 'normal'): SetLog => ({
  type,
  weightKg,
  reps,
  completedAt: null,
});
const ex = (exerciseId: string, ...sets: SetLog[]): ExerciseLog => ({ exerciseId, sets });

describe('RN-04 treino esquecido', () => {
  it('STALE_MS é 4 h', () => expect(STALE_MS).toBe(4 * H));
  it('exatamente 4 h não é esquecido; 1 ms a mais é', () => {
    expect(isForgotten(0, 4 * H)).toBe(false);
    expect(isForgotten(0, 4 * H + 1)).toBe(true);
    expect(isForgotten(10 * H, 11 * H)).toBe(false);
  });
});

describe('RN-10 Epley', () => {
  it('w×(1+r/30) com 2 casas', () => {
    expect(epley1RM(100, 10)).toBe(133.33);
    expect(epley1RM(80, 1)).toBe(82.67);
    expect(epley1RM(82.5, 6)).toBe(99);
  });
  it('só 1 a 12 reps inteiras: 12 calcula, 13 e 0 não', () => {
    expect(epley1RM(50, 12)).toBe(70);
    expect(epley1RM(50, 13)).toBeNull();
    expect(epley1RM(50, 0)).toBeNull();
    expect(epley1RM(50, 5.5)).toBeNull();
  });
  it('sem carga positiva não há 1RM', () => {
    expect(epley1RM(0, 8)).toBeNull();
    expect(epley1RM(-5, 8)).toBeNull();
  });
});

describe('RN-08 série válida', () => {
  it('concluída e não aquecimento, com reps > 0', () => {
    expect(isValidSet(done(80, 10))).toBe(true);
    expect(isValidSet(done(80, 8, 1, 'drop'))).toBe(true);
    expect(isValidSet(done(80, 3, 1, 'failure'))).toBe(true);
  });
  it('aquecimento, pendente ou sem reps não valem', () => {
    expect(isValidSet(done(40, 10, 1, 'warmup'))).toBe(false);
    expect(isValidSet(pending())).toBe(false);
    expect(isValidSet(done(80, 0))).toBe(false);
    expect(isValidSet(done(80, null))).toBe(false);
  });
  it('carga null conta como 0 kg (peso corporal): é válida; negativa não', () => {
    expect(isValidSet(done(null, 12))).toBe(true);
    expect(isValidSet(done(-5, 12))).toBe(false);
  });
});

describe('RN-09 volume', () => {
  it('carga × reps da série válida; null = 0; 2 casas', () => {
    expect(setVolume(done(82.5, 10))).toBe(825);
    expect(setVolume(done(null, 10))).toBe(0);
    expect(setVolume(done(33.33, 3))).toBe(99.99);
  });
  it('série inválida vale 0', () => {
    expect(setVolume(done(60, 10, 1, 'warmup'))).toBe(0);
    expect(setVolume(pending(80, 10))).toBe(0);
  });
  it('soma só as válidas de todos os exercícios', () => {
    const lista = [
      ex('a', done(40, 10, 1, 'warmup'), done(80, 10), done(80, 8), pending(80, 8)),
      ex('b', done(20.5, 10)),
    ];
    expect(workoutVolume(lista)).toBe(800 + 640 + 205);
    expect(workoutVolume([])).toBe(0);
  });
});

describe('RN-03 duração', () => {
  it('do início até a última série concluída (inclui aquecimento), não até Finalizar', () => {
    const lista = [ex('a', done(40, 10, 5000, 'warmup'), done(80, 10, 9000), pending()), ex('b', done(20, 10, 7000))];
    expect(workoutDuration(1000, lista)).toBe(8000);
  });
  it('sem série concluída não há duração', () => {
    expect(workoutDuration(1000, [ex('a', pending())])).toBeNull();
    expect(workoutDuration(1000, [])).toBeNull();
  });
});

describe('RN-05 e RN-06 finalizar', () => {
  it('nenhuma concluída (ou vazio) → só descartar', () => {
    expect(finishDecision([])).toBe('discard_only');
    expect(finishDecision([ex('a', pending(), pending())])).toBe('discard_only');
  });
  it('concluídas com pendentes → perguntar', () => {
    expect(finishDecision([ex('a', done(80, 10), pending())])).toBe('ask_pending');
    expect(finishDecision([ex('a', done(80, 10)), ex('b', pending())])).toBe('ask_pending');
  });
  it('tudo concluído → finalizar', () => {
    expect(finishDecision([ex('a', done(80, 10), done(40, 10, 2, 'warmup'))])).toBe('finish');
  });
  it('resolvePending complete marca as pendentes com os valores preenchidos e now', () => {
    const entrada = [ex('a', done(80, 10, 100), pending(82.5, 8))];
    const saida = resolvePending(entrada, 'complete', 999);
    expect(saida[0].sets[1]).toEqual({ type: 'normal', weightKg: 82.5, reps: 8, completedAt: 999 });
    expect(saida[0].sets[0].completedAt).toBe(100);
    expect(entrada[0].sets[1].completedAt).toBeNull(); // não muta
  });
  it('resolvePending discard remove as pendentes e o exercício que ficar vazio', () => {
    const entrada = [ex('a', done(80, 10), pending()), ex('b', pending(), pending())];
    const saida = resolvePending(entrada, 'discard', 999);
    expect(saida).toEqual([ex('a', done(80, 10))]);
    expect(entrada[1].sets).toHaveLength(2); // não muta
  });
});

describe('RN-11 PR', () => {
  const historico = [done(80, 10), done(100, 5), done(60, 12)];

  it('sem histórico válido anterior não há PR', () => {
    expect(prsForSet(done(100, 10), [])).toEqual([]);
    expect(prsForSet(done(100, 10), [done(50, 10, 1, 'warmup'), pending(90, 10)])).toEqual([]);
  });
  it('carga maior → weight (e o que mais bater)', () => {
    expect(prsForSet(done(105, 3), historico)).toEqual(expect.arrayContaining(['weight']));
    expect(prsForSet(done(105, 3), historico)).not.toContain('repsAtWeight');
  });
  it('mais reps na mesma carga → repsAtWeight', () => {
    // 80×11 também vale volume (880 > 800), mas não carga nem 1RM (109,33 < 116,67).
    expect(prsForSet(done(80, 11), historico)).toEqual(['setVolume', 'repsAtWeight']);
  });
  it('1RM e volume maiores sem bater carga', () => {
    // 90×9: 1RM 117 > 133,33? não; volume 810 > 800? sim → setVolume. 1RM de 80×10 = 106,67; 90×9 = 117 → oneRm também.
    const prs = prsForSet(done(90, 9), historico);
    expect(prs).toEqual(expect.arrayContaining(['oneRm', 'setVolume']));
    expect(prs).not.toContain('weight');
  });
  it('empate não é PR', () => {
    expect(prsForSet(done(100, 5), historico)).toEqual([]);
    expect(prsForSet(done(80, 10), historico)).toEqual([]);
  });
  it('reps acima de 12 não geram 1RM (RN-10)', () => {
    const prs = prsForSet(done(60, 15), [done(60, 12)]);
    expect(prs).not.toContain('oneRm');
    expect(prs).toContain('repsAtWeight');
  });
  it('candidata inválida (aquecimento, pendente) nunca é PR', () => {
    expect(prsForSet(done(200, 10, 1, 'warmup'), historico)).toEqual([]);
    expect(prsForSet(pending(200, 10), historico)).toEqual([]);
  });
  it('aquecimento do histórico não conta como marca a superar', () => {
    expect(prsForSet(done(80, 10), [done(100, 10, 1, 'warmup'), done(70, 10)])).toContain('weight');
  });
});

describe('rotina do dia', () => {
  it('a que está há mais tempo sem ser feita', () => {
    expect(
      pickTodayRoutine([
        { id: 'a', order: 0, lastDoneAt: 300 },
        { id: 'b', order: 1, lastDoneAt: 100 },
        { id: 'c', order: 2, lastDoneAt: 200 },
      ]),
    ).toBe('b');
  });
  it('nunca feita vem primeiro; desempate por ordem e depois por id', () => {
    expect(
      pickTodayRoutine([
        { id: 'a', order: 0, lastDoneAt: 1 },
        { id: 'z', order: 2, lastDoneAt: null },
        { id: 'm', order: 1, lastDoneAt: null },
      ]),
    ).toBe('m');
    expect(
      pickTodayRoutine([
        { id: 'y', order: 1, lastDoneAt: 5 },
        { id: 'x', order: 1, lastDoneAt: 5 },
      ]),
    ).toBe('x');
  });
  it('lista vazia → null', () => expect(pickTodayRoutine([])).toBeNull());
});

describe('RN-13 kg/lb', () => {
  it('converte com o fator exato', () => {
    expect(kgToLb(100)).toBeCloseTo(220.46226, 4);
    expect(lbToKg(225)).toBe(102.06);
    expect(lbToKg(2.2)).toBe(1);
  });
  it('lb → kg → guarda 2 casas', () => {
    expect(lbToKg(45)).toBe(20.41);
    expect(String(lbToKg(135)).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
  it('roundToIncrement vai ao múltiplo mais próximo sem erro de ponto flutuante', () => {
    expect(roundToIncrement(101.3, 2.5)).toBe(102.5);
    expect(roundToIncrement(101.2, 2.5)).toBe(100);
    expect(roundToIncrement(21.1, 1.25)).toBe(21.25);
    expect(roundToIncrement(0.3, 0.1)).toBe(0.3);
    expect(roundToIncrement(82.5, 0)).toBe(82.5);
  });
});

describe('RN-07 retroativo', () => {
  it('futuro é recusado; agora e passado são ok', () => {
    expect(validateRetroactive(2000, 1000)).toBe('future');
    expect(validateRetroactive(1000, 1000)).toBe('ok');
    expect(validateRetroactive(500, 1000)).toBe('ok');
  });
  it('sobreposição é estrita: encostar não conta', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 5, end: 15 })).toBe(true);
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 10 }, { start: 2, end: 3 })).toBe(true);
    expect(overlaps({ start: 20, end: 30 }, { start: 0, end: 10 })).toBe(false);
  });
});

describe('RN-20 expurgo', () => {
  it('30 dias ou mais', () => {
    expect(isPurgeable(0, 30 * D - 1)).toBe(false);
    expect(isPurgeable(0, 30 * D)).toBe(true);
  });
});

describe('RN-16 XP derivado', () => {
  it('10 por treino, 1 por série válida, 25 por PR', () => {
    expect(dayXp({ finishedWorkouts: 1, validSets: 12, prs: 1 })).toBe(10 + 12 + 25);
    expect(dayXp({ finishedWorkouts: 0, validSets: 0, prs: 0 })).toBe(0);
  });
  it('teto de 150 por dia', () => {
    expect(dayXp({ finishedWorkouts: 2, validSets: 100, prs: 10 })).toBe(150);
    expect(dayXp({ finishedWorkouts: 1, validSets: 60, prs: 3 })).toBe(145);
  });
  it('é função pura dos dados: editar sem mudar os dados não muda o XP (não duplica)', () => {
    const dados = { finishedWorkouts: 1, validSets: 9, prs: 0 };
    expect(dayXp(dados)).toBe(dayXp({ ...dados }));
    expect(dayXp(dados)).toBe(19);
  });
  it('retroativo com mais de 7 dias não gera XP', () => {
    expect(grantsXp(0, 7 * D)).toBe(true);
    expect(grantsXp(0, 7 * D + 1)).toBe(false);
    expect(grantsXp(5 * D, 5 * D)).toBe(true);
  });
});

describe('RN-24 semana e dia local', () => {
  // Datas locais: new Date(a, m, d) respeita o fuso do ambiente de teste.
  it('semana começa na segunda por padrão (domingo pertence à semana anterior)', () => {
    const quarta = new Date(2026, 10, 11, 15, 30); // qua 11 nov 2026
    expect(startOfWeek(quarta)).toEqual(new Date(2026, 10, 9));
    expect(startOfWeek(new Date(2026, 10, 9, 0, 0))).toEqual(new Date(2026, 10, 9));
    expect(startOfWeek(new Date(2026, 10, 15, 23, 59))).toEqual(new Date(2026, 10, 9)); // domingo
    expect(startOfWeek(new Date(2026, 10, 16))).toEqual(new Date(2026, 10, 16)); // segunda seguinte
  });
  it('configurável: semana começando no domingo', () => {
    expect(startOfWeek(new Date(2026, 10, 11), 0)).toEqual(new Date(2026, 10, 8));
    expect(startOfWeek(new Date(2026, 10, 15, 23, 59), 0)).toEqual(new Date(2026, 10, 15));
  });
  it('não muta a data de entrada', () => {
    const d = new Date(2026, 10, 11, 15);
    startOfWeek(d);
    expect(d).toEqual(new Date(2026, 10, 11, 15));
  });
  it('localDayKey usa o fuso informado (início 02:30 UTC em UTC-3 ainda é o dia anterior)', () => {
    const ms = Date.UTC(2026, 10, 12, 2, 30);
    expect(localDayKey(ms, 0)).toBe('2026-11-12');
    expect(localDayKey(ms, -180)).toBe('2026-11-11');
    expect(localDayKey(ms, 14 * 60)).toBe('2026-11-12');
    expect(localDayKey(Date.UTC(2026, 0, 5, 12), 0)).toBe('2026-01-05');
  });
  it('daysTrainedInWeek conta dias distintos dentro da semana', () => {
    const tz = -180;
    const local = (dia: number, h = 12) => Date.UTC(2026, 10, dia, h + 3); // dia local em UTC-3
    const semana = new Date(2026, 10, 9); // segunda 9 nov
    const treinos = [local(9, 8), local(9, 19), local(11), local(15, 23), local(8), local(16)];
    // 8/nov (domingo anterior) e 16/nov (segunda seguinte) ficam de fora; 9 conta 1 vez.
    expect(daysTrainedInWeek(treinos, semana, tz)).toBe(3);
    expect(daysTrainedInWeek([], semana, tz)).toBe(0);
  });
});

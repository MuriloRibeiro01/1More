import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_REST_S,
  DEFAULT_SETS,
  MAX_REST_S,
  MAX_SETS,
  MIN_SETS,
  REST_STEP_S,
  formatRest,
  normalizeSearch,
  parseKg,
  searchExercises,
  validateRoutine,
} from '../../src/routines/rules';
import type { ExerciseDraft, RoutineDraft } from '../../src/routines/types';

// T-005 — regras puras da planilha (critérios: padrões, carga, validação, busca).

const ex = (over: Partial<ExerciseDraft> = {}): ExerciseDraft => ({
  exerciseId: 'e1',
  sets: DEFAULT_SETS,
  weightKg: null,
  repsMin: null,
  repsMax: null,
  restSeconds: DEFAULT_REST_S,
  ...over,
});
const rotina = (over: Partial<RoutineDraft> = {}): RoutineDraft => ({ name: 'Treino A', exercises: [ex()], ...over });

describe('padrões e limites', () => {
  it('3 séries (1..10) e descanso 1:30 (0..10:00, passo 15 s)', () => {
    expect([DEFAULT_SETS, MIN_SETS, MAX_SETS]).toEqual([3, 1, 10]);
    expect([DEFAULT_REST_S, REST_STEP_S, MAX_REST_S]).toEqual([90, 15, 600]);
  });
});

describe('parseKg (RN-13)', () => {
  it.each<[string, number | null]>([
    ['82,5', 82.5],
    ['82.5', 82.5],
    [' 100 ', 100],
    ['0', 0],
    ['1,25', 1.25],
    ['82,555', 82.56],
    ['', null],
    ['   ', null],
  ])('%p → %p', (texto, valor) => {
    expect(parseKg(texto)).toEqual({ ok: true, value: valor });
  });

  it.each(['-5', '-0,5'])('negativa %p não vale', (texto) => {
    expect(parseKg(texto)).toEqual({ ok: false, error: 'negative' });
  });

  it.each(['abc', '82,5kg', '1,2,3', '8 2', 'NaN', 'Infinity'])('texto inválido %p não vale', (texto) => {
    expect(parseKg(texto)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('formatRest', () => {
  it.each<[number, string]>([
    [0, '0:00'],
    [15, '0:15'],
    [90, '1:30'],
    [105, '1:45'],
    [600, '10:00'],
  ])('%d s → %s', (s, texto) => {
    expect(formatRest(s)).toBe(texto);
  });
});

describe('validateRoutine', () => {
  it('rotina válida não tem erros', () => {
    expect(validateRoutine(rotina())).toEqual([]);
    expect(validateRoutine(rotina({ name: 'x'.repeat(80) }))).toEqual([]);
  });

  it.each(['', '   '])('sem nome (%p) → name_required', (name) => {
    expect(validateRoutine(rotina({ name }))).toContain('name_required');
  });

  it('nome com mais de 80 caracteres → name_too_long', () => {
    expect(validateRoutine(rotina({ name: 'x'.repeat(81) }))).toContain('name_too_long');
  });

  it('sem exercício → no_exercises', () => {
    expect(validateRoutine(rotina({ exercises: [] }))).toContain('no_exercises');
  });

  it('acumula os motivos', () => {
    expect(validateRoutine({ name: '', exercises: [] })).toEqual(expect.arrayContaining(['name_required', 'no_exercises']));
  });

  it.each([0, 11, 2.5])('séries fora de 1..10 (%p) → invalid_sets', (sets) => {
    expect(validateRoutine(rotina({ exercises: [ex({ sets })] }))).toContain('invalid_sets');
  });

  it.each([-1, Number.NaN])('carga %p → invalid_weight', (weightKg) => {
    expect(validateRoutine(rotina({ exercises: [ex({ weightKg })] }))).toContain('invalid_weight');
  });

  it('reps mín > máx ou ≤ 0 → invalid_reps; mín = máx vale', () => {
    expect(validateRoutine(rotina({ exercises: [ex({ repsMin: 12, repsMax: 8 })] }))).toContain('invalid_reps');
    expect(validateRoutine(rotina({ exercises: [ex({ repsMin: 0 })] }))).toContain('invalid_reps');
    expect(validateRoutine(rotina({ exercises: [ex({ repsMin: 10, repsMax: 10 })] }))).toEqual([]);
  });

  it.each([-15, 615, 20])('descanso %p (fora de 0..600 ou fora do passo 15) → invalid_rest', (restSeconds) => {
    expect(validateRoutine(rotina({ exercises: [ex({ restSeconds })] }))).toContain('invalid_rest');
  });
});

describe('busca no catálogo', () => {
  const catalogo = [
    { id: '1', name: 'Agachamento livre' },
    { id: '2', name: 'Supino reto com barra' },
    { id: '3', name: 'Tríceps na polia' },
    { id: '4', name: 'Elevação lateral' },
  ];
  const nomes = (q: string) => searchExercises(catalogo, q).map((e) => e.name);

  it('normalizeSearch tira acento, caixa e espaços das pontas', () => {
    expect(normalizeSearch('  Elevação LATERAL ')).toBe('elevacao lateral');
  });

  it('"agach" encontra "Agachamento livre"', () => {
    expect(nomes('agach')).toEqual(['Agachamento livre']);
  });

  it('sem acento encontra nome com acento, e vice-versa', () => {
    expect(nomes('triceps')).toEqual(['Tríceps na polia']);
    expect(nomes('elevacao')).toEqual(['Elevação lateral']);
    expect(nomes('SÚPINO')).toEqual(['Supino reto com barra']);
  });

  it('acha no meio do nome; busca vazia devolve tudo; sem resultado devolve vazio', () => {
    expect(nomes('barra')).toEqual(['Supino reto com barra']);
    expect(nomes('  ')).toHaveLength(4);
    expect(nomes('zzz')).toEqual([]);
  });
});

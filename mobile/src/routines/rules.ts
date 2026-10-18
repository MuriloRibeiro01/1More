import type { CatalogExercise, RoutineDraft, RoutineError } from './types';

// Regras da planilha de treino (T-005). Puras: sem banco, sem tela.

export const DEFAULT_SETS = 3;
export const MIN_SETS = 1;
export const MAX_SETS = 10;
export const DEFAULT_REST_S = 90;
export const REST_STEP_S = 15;
export const MAX_REST_S = 600;
export const MAX_NAME = 80;

export type ParseKgResult = { ok: true; value: number | null } | { ok: false; error: 'invalid' | 'negative' };

const NUMBER = /^\d+(?:[.,]\d+)?$/;

/** Arredonda para 2 casas sem o erro de ponto flutuante (82,555 → 82,56). */
export function roundKg(value: number): number {
  return Number(`${Math.round(Number(`${value}e2`))}e-2`);
}

/** "82,5" → 82.5; "" → null; arredonda para 2 casas (RN-13: carga sempre em kg). */
export function parseKg(text: string): ParseKgResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.startsWith('-') && NUMBER.test(trimmed.slice(1))) return { ok: false, error: 'negative' };
  if (!NUMBER.test(trimmed)) return { ok: false, error: 'invalid' };
  return { ok: true, value: roundKg(Number(trimmed.replace(',', '.'))) };
}

/** Repetições: "" → null; inteiro positivo; qualquer outra coisa → undefined (inválido). */
export function parseReps(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value > 0 ? value : undefined;
}

/** 90 → "1:30". */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const isPositiveIntOrNull = (n: number | null) => n === null || (Number.isInteger(n) && n > 0);

export function validateRoutine(draft: RoutineDraft): RoutineError[] {
  const errors = new Set<RoutineError>();
  const name = draft.name.trim();
  if (name.length === 0) errors.add('name_required');
  else if (name.length > MAX_NAME) errors.add('name_too_long');
  if (draft.exercises.length === 0) errors.add('no_exercises');

  for (const ex of draft.exercises) {
    if (!Number.isInteger(ex.sets) || ex.sets < MIN_SETS || ex.sets > MAX_SETS) errors.add('invalid_sets');
    if (ex.weightKg !== null && !(Number.isFinite(ex.weightKg) && ex.weightKg >= 0)) errors.add('invalid_weight');
    if (
      !isPositiveIntOrNull(ex.repsMin) ||
      !isPositiveIntOrNull(ex.repsMax) ||
      (ex.repsMin !== null && ex.repsMax !== null && ex.repsMin > ex.repsMax)
    ) {
      errors.add('invalid_reps');
    }
    if (
      !Number.isInteger(ex.restSeconds) ||
      ex.restSeconds < 0 ||
      ex.restSeconds > MAX_REST_S ||
      ex.restSeconds % REST_STEP_S !== 0
    ) {
      errors.add('invalid_rest');
    }
  }
  return [...errors];
}

/** Minúsculas, sem acento, sem espaços nas pontas. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function searchExercises(list: readonly CatalogExercise[], query: string): CatalogExercise[] {
  const q = normalizeSearch(query);
  if (!q) return [...list];
  return list.filter((e) => normalizeSearch(e.name).includes(q));
}

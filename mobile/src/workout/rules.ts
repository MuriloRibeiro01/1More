import { roundKg } from '../routines/rules';
import type { ExerciseLog, PRType, SetLog } from './types';

// Regras puras do treino (Fase 4): sem banco, sem tela, sem relógio (o "agora" entra por parâmetro).

const H = 3_600_000;
const D = 24 * H;
/** Treino ativo sem série nova há mais disso é "esquecido" (RN-04). */
export const STALE_MS = 4 * H;

export const isForgotten = (lastActivityAt: number, now: number) => now - lastActivityAt > STALE_MS;

/** RN-10: Epley, só para 1–12 reps inteiras e carga > 0; acima disso o valor não é exibido. */
export function epley1RM(weightKg: number, reps: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > 12 || !(weightKg > 0)) return null;
  return roundKg(weightKg * (1 + reps / 30));
}

/** RN-08: concluída, não aquecimento, com reps. Carga null vale 0 kg (peso corporal). */
export function isValidSet(s: SetLog): boolean {
  return s.completedAt !== null && s.type !== 'warmup' && (s.reps ?? 0) > 0 && (s.weightKg ?? 0) >= 0;
}

/** RN-09: carga × reps da série válida; inválida vale 0. */
export const setVolume = (s: SetLog) => (isValidSet(s) ? roundKg((s.weightKg ?? 0) * (s.reps as number)) : 0);

export const workoutVolume = (exercises: ExerciseLog[]) =>
  roundKg(exercises.reduce((sum, e) => sum + e.sets.reduce((a, s) => a + setVolume(s), 0), 0));

/** RN-03: do início à última série concluída (aquecimento inclui), em ms. */
export function workoutDuration(startedAt: number, exercises: ExerciseLog[]): number | null {
  const ends = exercises.flatMap((e) => e.sets.map((s) => s.completedAt).filter((t): t is number => t !== null));
  return ends.length ? Math.max(...ends) - startedAt : null;
}

/** RN-05 (nada feito: só descartar) e RN-06 (pendentes: perguntar). */
export function finishDecision(exercises: ExerciseLog[]): 'discard_only' | 'ask_pending' | 'finish' {
  const sets = exercises.flatMap((e) => e.sets);
  const feitas = sets.filter((s) => s.completedAt !== null).length;
  if (feitas === 0) return 'discard_only';
  return feitas < sets.length ? 'ask_pending' : 'finish';
}

/** RN-06: completa as pendentes com os valores preenchidos ou as descarta. Não muta a entrada. */
export function resolvePending(exercises: ExerciseLog[], mode: 'complete' | 'discard', now: number): ExerciseLog[] {
  return exercises
    .map((e) => ({
      ...e,
      sets:
        mode === 'complete'
          ? e.sets.map((s) => (s.completedAt === null ? { ...s, completedAt: now } : { ...s }))
          : e.sets.filter((s) => s.completedAt !== null).map((s) => ({ ...s })),
    }))
    .filter((e) => e.sets.length > 0);
}

/** RN-11: o que a série candidata supera no histórico válido do exercício. Sem histórico, não há PR; empate não é PR. */
export function prsForSet(candidate: SetLog, previous: SetLog[]): PRType[] {
  const prev = previous.filter(isValidSet);
  if (!isValidSet(candidate) || prev.length === 0) return [];
  const w = candidate.weightKg ?? 0;
  const reps = candidate.reps as number;
  const prs: PRType[] = [];

  if (w > Math.max(...prev.map((s) => s.weightKg ?? 0))) prs.push('weight');
  const rm = epley1RM(w, reps);
  if (rm !== null && rm > Math.max(...prev.map((s) => epley1RM(s.weightKg ?? 0, s.reps as number) ?? 0))) prs.push('oneRm');
  if (setVolume(candidate) > Math.max(...prev.map(setVolume))) prs.push('setVolume');
  const same = prev.filter((s) => (s.weightKg ?? 0) === w);
  if (same.length && reps > Math.max(...same.map((s) => s.reps as number))) prs.push('repsAtWeight');
  return prs;
}

/** Rotina do dia: a há mais tempo sem fazer; nunca feita primeiro; desempate por ordem e id. */
export function pickTodayRoutine(routines: { id: string; order: number; lastDoneAt: number | null }[]): string | null {
  const sorted = [...routines].sort(
    (a, b) =>
      (a.lastDoneAt ?? -Infinity) - (b.lastDoneAt ?? -Infinity) || a.order - b.order || a.id.localeCompare(b.id),
  );
  return sorted[0]?.id ?? null;
}

const KG_PER_LB = 0.45359237;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
/** RN-13: o que se guarda é kg com 2 casas. */
export const lbToKg = (lb: number) => roundKg(lb * KG_PER_LB);

/** Múltiplo mais próximo do incremento; arredonda a 8 casas para tirar o ruído de ponto flutuante. */
export function roundToIncrement(value: number, increment: number): number {
  if (!(increment > 0)) return value;
  return Number((Math.round(value / increment) * increment).toFixed(8));
}

/** RN-07: sem data futura. Sobreposição só gera aviso (nunca bloqueia). */
export const validateRetroactive = (startedAt: number, now: number): 'ok' | 'future' => (startedAt > now ? 'future' : 'ok');
export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end;

/** RN-20: expurgo físico após 30 dias do tombstone. */
export const isPurgeable = (deletedAt: number, now: number) => now - deletedAt >= 30 * D;

/** RN-16: XP derivado dos dados (função pura, então editar sem mudar os dados não duplica), teto de 150 por dia. */
export const dayXp = (i: { finishedWorkouts: number; validSets: number; prs: number }) =>
  Math.min(150, 10 * i.finishedWorkouts + i.validSets + 25 * i.prs);

/** RN-16: treino registrado com mais de 7 dias de atraso não gera XP. */
export const grantsXp = (startedAt: number, registeredAt: number) => registeredAt - startedAt <= 7 * D;


export interface CatalogExercise {
  id: string;
  name: string;
}

export interface ExerciseDraft {
  exerciseId: string;
  sets: number;
  /** kg com até 2 casas; null = sem carga alvo. */
  weightKg: number | null;
  repsMin: number | null;
  repsMax: number | null;
  restSeconds: number;
}

export interface RoutineDraft {
  /** Ausente = rotina nova. */
  id?: string;
  name: string;
  exercises: ExerciseDraft[];
}

export interface RoutineSummary {
  id: string;
  name: string;
  /** Na ordem da rotina. */
  exerciseNames: string[];
}

export type RoutineError =
  | 'name_required'
  | 'name_too_long'
  | 'no_exercises'
  | 'invalid_sets'
  | 'invalid_weight'
  | 'invalid_reps'
  | 'invalid_rest';

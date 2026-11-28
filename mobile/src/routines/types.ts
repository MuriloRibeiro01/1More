
export interface CatalogExercise {
  id: string;
  name: string;
  /** Chave de `progress.muscles` (ex.: chest). */
  primaryMuscle?: string | null;
  /** barbell | dumbbell | cable | machine | bodyweight. */
  equipmentCode?: string | null;
  trackingType?: string;
  /** Criado pela pessoa (RF-12): só este pode ser editado ou arquivado. */
  isCustom?: boolean;
}

export interface ExerciseDraft {
  /** Identidade da linha em routine_exercise (R-13). Ausente = exercício novo na rotina. */
  routineExerciseId?: string;
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
  /** Pasta (RF-24). Ausente = não mexe (rotina existente) ou sem pasta (rotina nova); null = sem pasta. */
  folderId?: string | null;
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

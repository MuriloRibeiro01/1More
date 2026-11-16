// Tipos do treino (Fase 4). Puros: sem banco, sem tela. Instantes em ms desde a época (UTC); carga em kg.

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface SetLog {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  /** null = série ainda não concluída. */
  completedAt: number | null;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export type PRType = 'weight' | 'oneRm' | 'setVolume' | 'repsAtWeight';

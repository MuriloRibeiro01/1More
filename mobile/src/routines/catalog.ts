// Catálogo embarcado mínimo (T-005, RN-19): seed da nota "untitled". Só leitura no app.
// O catálogo definitivo depende da decisão "base própria ou licenciada" (ADR-001, em aberto).

export interface CatalogSeed {
  name: string;
  trackingType: 'weight_reps' | 'reps_only' | 'bodyweight_reps' | 'duration' | 'distance_duration' | 'weight_duration';
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
}

export const CATALOG_SEED: readonly CatalogSeed[] = [
  { name: 'Supino reto com barra', trackingType: 'weight_reps', primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'barbell' },
  { name: 'Supino inclinado com halteres', trackingType: 'weight_reps', primaryMuscle: 'chest', secondaryMuscles: ['shoulders', 'triceps'], equipment: 'dumbbell' },
  { name: 'Agachamento livre', trackingType: 'weight_reps', primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings'], equipment: 'barbell' },
  { name: 'Levantamento terra', trackingType: 'weight_reps', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes', 'lower_back', 'traps'], equipment: 'barbell' },
  { name: 'Desenvolvimento militar', trackingType: 'weight_reps', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'barbell' },
  { name: 'Remada curvada', trackingType: 'weight_reps', primaryMuscle: 'upper_back', secondaryMuscles: ['biceps'], equipment: 'barbell' },
  { name: 'Puxada frontal', trackingType: 'weight_reps', primaryMuscle: 'upper_back', secondaryMuscles: ['biceps'], equipment: 'cable' },
  { name: 'Barra fixa', trackingType: 'bodyweight_reps', primaryMuscle: 'upper_back', secondaryMuscles: ['biceps'], equipment: 'bodyweight' },
  { name: 'Leg press 45°', trackingType: 'weight_reps', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'machine' },
  { name: 'Cadeira extensora', trackingType: 'weight_reps', primaryMuscle: 'quads', secondaryMuscles: [], equipment: 'machine' },
  { name: 'Mesa flexora', trackingType: 'weight_reps', primaryMuscle: 'hamstrings', secondaryMuscles: [], equipment: 'machine' },
  { name: 'Rosca direta', trackingType: 'weight_reps', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'], equipment: 'barbell' },
  { name: 'Tríceps na polia', trackingType: 'weight_reps', primaryMuscle: 'triceps', secondaryMuscles: [], equipment: 'cable' },
  { name: 'Elevação lateral', trackingType: 'weight_reps', primaryMuscle: 'shoulders', secondaryMuscles: [], equipment: 'dumbbell' },
  { name: 'Panturrilha em pé', trackingType: 'weight_reps', primaryMuscle: 'calves', secondaryMuscles: [], equipment: 'machine' },
  { name: 'Prancha', trackingType: 'duration', primaryMuscle: 'abs', secondaryMuscles: ['obliques'], equipment: 'bodyweight' },
];

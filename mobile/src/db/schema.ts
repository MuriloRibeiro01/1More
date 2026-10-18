import { appSchema, tableSchema, type ColumnSchema } from '@nozbe/watermelondb';

// Colunas de sync de toda tabela sincronizável (o id UUID v7 vem do app; ver uuid.ts).
// user_id nulo = modo local sem conta (RF-02) ou, em `exercise`, item do catálogo embarcado.
const syncColumns: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
  { name: 'created_at', type: 'number' },
  { name: 'updated_at', type: 'number' },
  { name: 'server_version', type: 'number', isOptional: true },
  { name: 'deleted_at', type: 'number', isOptional: true },
];

// Tabelas da planilha de treino (T-005), modelo da nota "untitled" com os ajustes C (sem defaults) e D (arrays em JSON).
export const exerciseTable = tableSchema({
  name: 'exercise',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'tracking_type', type: 'string' },
    { name: 'primary_muscle', type: 'string', isOptional: true },
    { name: 'secondary_muscles', type: 'string' }, // JSON: ["triceps","shoulders"]
    { name: 'equipment_code', type: 'string', isOptional: true },
    ...syncColumns,
  ],
});

export const routineTable = tableSchema({
  name: 'routine',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'sort_order', type: 'number' },
    ...syncColumns,
  ],
});

export const routineExerciseTable = tableSchema({
  name: 'routine_exercise',
  columns: [
    { name: 'routine_id', type: 'string', isIndexed: true },
    { name: 'exercise_id', type: 'string', isIndexed: true },
    { name: 'sort_order', type: 'number' },
    { name: 'rest_seconds', type: 'number', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true },
    ...syncColumns,
  ],
});

export const routineSetTable = tableSchema({
  name: 'routine_set',
  columns: [
    { name: 'routine_exercise_id', type: 'string', isIndexed: true },
    { name: 'sort_order', type: 'number' },
    { name: 'set_type', type: 'string' }, // warmup | normal | drop | failure
    { name: 'reps_min', type: 'number', isOptional: true },
    { name: 'reps_max', type: 'number', isOptional: true },
    { name: 'target_weight_kg', type: 'number', isOptional: true }, // kg, 2 casas (RN-13)
    ...syncColumns,
  ],
});

// Ao mudar o schema: suba `version` e adicione o passo correspondente em migrations.ts.
export const schema = appSchema({
  version: 2,
  tables: [exerciseTable, routineTable, routineExerciseTable, routineSetTable],
});

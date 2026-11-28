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
    { name: 'is_custom', type: 'boolean' }, // v5: exercício criado pela pessoa (RF-12)
    ...syncColumns,
  ],
});

export const routineTable = tableSchema({
  name: 'routine',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'sort_order', type: 'number' },
    { name: 'folder_id', type: 'string', isOptional: true, isIndexed: true }, // v6: pasta (RF-24)
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

// Treino (Fase 4): execução e histórico. Série gravada a cada toque (RNF-02); status 'active' nunca sai como finalizado sem ação.
export const workoutTable = tableSchema({
  name: 'workout',
  columns: [
    { name: 'routine_id', type: 'string', isOptional: true, isIndexed: true },
    { name: 'name', type: 'string' },
    { name: 'started_at', type: 'number' }, // UTC em ms (RN-24)
    { name: 'ended_at', type: 'number', isOptional: true }, // última série concluída (RN-03)
    { name: 'tz_offset_min', type: 'number' }, // fuso do aparelho no início; o dia do treino é a data local
    { name: 'status', type: 'string', isIndexed: true }, // active | finished
    { name: 'notes', type: 'string', isOptional: true },
    ...syncColumns,
  ],
});

export const workoutExerciseTable = tableSchema({
  name: 'workout_exercise',
  columns: [
    { name: 'workout_id', type: 'string', isIndexed: true },
    { name: 'exercise_id', type: 'string', isIndexed: true },
    { name: 'sort_order', type: 'number' },
    { name: 'superset_group', type: 'number', isOptional: true },
    { name: 'rest_seconds', type: 'number', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true },
    ...syncColumns,
  ],
});

export const workoutSetTable = tableSchema({
  name: 'workout_set',
  columns: [
    { name: 'workout_exercise_id', type: 'string', isIndexed: true },
    { name: 'sort_order', type: 'number' },
    { name: 'set_type', type: 'string' }, // warmup | normal | drop | failure
    { name: 'weight_kg', type: 'number', isOptional: true }, // kg, 2 casas (RN-13)
    { name: 'reps', type: 'number', isOptional: true },
    { name: 'completed_at', type: 'number', isOptional: true }, // nulo = pendente
    ...syncColumns,
  ],
});

// Nota do usuário sobre um exercício (v4). Tabela própria: o catálogo é read-only (RN-19).
export const exerciseNoteTable = tableSchema({
  name: 'exercise_note',
  columns: [
    { name: 'exercise_id', type: 'string', isIndexed: true },
    { name: 'text', type: 'string' },
    ...syncColumns,
  ],
});

// Pasta de rotinas (v6). Excluir a pasta é tombstone; as rotinas voltam para "sem pasta".
export const routineFolderTable = tableSchema({
  name: 'routine_folder',
  columns: [{ name: 'name', type: 'string' }, { name: 'sort_order', type: 'number' }, ...syncColumns],
});

// Ao mudar o schema: suba `version` e adicione o passo correspondente em migrations.ts.
export const schema = appSchema({
  version: 6,
  tables: [
    exerciseTable,
    routineTable,
    routineExerciseTable,
    routineSetTable,
    workoutTable,
    workoutExerciseTable,
    workoutSetTable,
    exerciseNoteTable,
    routineFolderTable,
  ],
});

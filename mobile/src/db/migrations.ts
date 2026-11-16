import { createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import type { ColumnSchema } from '@nozbe/watermelondb';

// Migrações do banco local. Nunca altere um passo já publicado: adicione um novo
// ({ toVersion: N, steps: [...] }) junto com o aumento de `version` em schema.ts.
// Cada passo tem as colunas escritas aqui, CONGELADAS: nunca derive de schema.ts, senão uma
// coluna nova da v3 entraria em silêncio na criação da v2 e o addColumns da v3 quebraria.

// v2 (T-005): colunas de sync como publicadas.
const syncColumnsV2: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
  { name: 'created_at', type: 'number' },
  { name: 'updated_at', type: 'number' },
  { name: 'server_version', type: 'number', isOptional: true },
  { name: 'deleted_at', type: 'number', isOptional: true },
];

// v3 (Fase 4): mesmas colunas de sync (idênticas às da v2 por enquanto, mas congeladas à parte).
const syncColumnsV3: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
  { name: 'created_at', type: 'number' },
  { name: 'updated_at', type: 'number' },
  { name: 'server_version', type: 'number', isOptional: true },
  { name: 'deleted_at', type: 'number', isOptional: true },
];

// v4 (Fase 8): colunas de sync congeladas à parte.
const syncColumnsV4: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
  { name: 'created_at', type: 'number' },
  { name: 'updated_at', type: 'number' },
  { name: 'server_version', type: 'number', isOptional: true },
  { name: 'deleted_at', type: 'number', isOptional: true },
];

export const migrations = schemaMigrations({
  migrations: [
    {
      // T-005: catálogo e planilha de treino.
      toVersion: 2,
      steps: [
        createTable({
          name: 'exercise',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'tracking_type', type: 'string' },
            { name: 'primary_muscle', type: 'string', isOptional: true },
            { name: 'secondary_muscles', type: 'string' },
            { name: 'equipment_code', type: 'string', isOptional: true },
            ...syncColumnsV2,
          ],
        }),
        createTable({
          name: 'routine',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'sort_order', type: 'number' },
            ...syncColumnsV2,
          ],
        }),
        createTable({
          name: 'routine_exercise',
          columns: [
            { name: 'routine_id', type: 'string', isIndexed: true },
            { name: 'exercise_id', type: 'string', isIndexed: true },
            { name: 'sort_order', type: 'number' },
            { name: 'rest_seconds', type: 'number', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            ...syncColumnsV2,
          ],
        }),
        createTable({
          name: 'routine_set',
          columns: [
            { name: 'routine_exercise_id', type: 'string', isIndexed: true },
            { name: 'sort_order', type: 'number' },
            { name: 'set_type', type: 'string' },
            { name: 'reps_min', type: 'number', isOptional: true },
            { name: 'reps_max', type: 'number', isOptional: true },
            { name: 'target_weight_kg', type: 'number', isOptional: true },
            ...syncColumnsV2,
          ],
        }),
      ],
    },
    {
      // Fase 4: treino ativo e histórico.
      toVersion: 3,
      steps: [
        createTable({
          name: 'workout',
          columns: [
            { name: 'routine_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'started_at', type: 'number' },
            { name: 'ended_at', type: 'number', isOptional: true },
            { name: 'tz_offset_min', type: 'number' },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'notes', type: 'string', isOptional: true },
            ...syncColumnsV3,
          ],
        }),
        createTable({
          name: 'workout_exercise',
          columns: [
            { name: 'workout_id', type: 'string', isIndexed: true },
            { name: 'exercise_id', type: 'string', isIndexed: true },
            { name: 'sort_order', type: 'number' },
            { name: 'superset_group', type: 'number', isOptional: true },
            { name: 'rest_seconds', type: 'number', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            ...syncColumnsV3,
          ],
        }),
        createTable({
          name: 'workout_set',
          columns: [
            { name: 'workout_exercise_id', type: 'string', isIndexed: true },
            { name: 'sort_order', type: 'number' },
            { name: 'set_type', type: 'string' },
            { name: 'weight_kg', type: 'number', isOptional: true },
            { name: 'reps', type: 'number', isOptional: true },
            { name: 'completed_at', type: 'number', isOptional: true },
            ...syncColumnsV3,
          ],
        }),
      ],
    },
    {
      // Fase 8: nota do usuário sobre um exercício (o catálogo é read-only, RN-19).
      toVersion: 4,
      steps: [
        createTable({
          name: 'exercise_note',
          columns: [
            { name: 'exercise_id', type: 'string', isIndexed: true },
            { name: 'text', type: 'string' },
            ...syncColumnsV4,
          ],
        }),
      ],
    },
  ],
});

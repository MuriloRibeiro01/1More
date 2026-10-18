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
  ],
});

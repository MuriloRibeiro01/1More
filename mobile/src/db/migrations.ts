import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Migrações do banco local. Nunca altere um passo já publicado: adicione um novo
// ({ toVersion: N, steps: [...] }) junto com o aumento de `version` em schema.ts.
export const migrations = schemaMigrations({
  migrations: [],
});

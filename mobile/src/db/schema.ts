import { appSchema } from '@nozbe/watermelondb';

// Schema inicial vazio (T-001). Tabelas sincronizáveis entram com as próximas tarefas e
// sempre com: id (UUID v7 do cliente), user_id, created_at, updated_at, server_version, deleted_at.
// Ao mudar o schema: suba `version` e adicione o passo correspondente em migrations.ts.
export const schema = appSchema({
  version: 1,
  tables: [],
});

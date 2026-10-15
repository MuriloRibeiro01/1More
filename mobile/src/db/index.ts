import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';

// Banco local (SQLite). A UI lê e grava só aqui; o motor de sync (src/sync) replica em segundo plano.
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'onemore',
  jsi: true,
  onSetUpError: (error) => {
    // Sem telas usando o banco ainda (T-001). Tratamento/recuperação entra com o registro de treino.
    console.error('[db] falha ao abrir o banco local', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [],
});

export { schema, migrations };

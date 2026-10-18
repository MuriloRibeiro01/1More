import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from '../src/db/schema';
import { migrations } from '../src/db/migrations';
import { modelClasses } from '../src/db/models';

let seq = 0;

/** Banco WatermelonDB em memória (LokiJS), com o schema/migrations/models reais do app. */
export function criarBancoDeTeste() {
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    dbName: `teste-${Date.now()}-${seq++}`,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    // Só memória e sem autosave: senão o Loki usa o disco no Node e deixa o jest pendurado ao fim.
    extraLokiOptions: { autosave: false, persistenceMethod: 'memory' } as never,
    onSetUpError: (e) => {
      throw e;
    },
  });
  return new Database({ adapter, modelClasses });
}

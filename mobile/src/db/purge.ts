import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { isPurgeable } from '../workout/rules';

// T-003: quando houver sync, só expurgar o tombstone depois que o servidor o confirmar (RN-21);
// um aparelho offline por 30+ dias não pode perdê-lo antes de propagar.
// RN-20: tombstone com 30 dias ou mais é removido de verdade. Só toca linhas com `deleted_at`;
// catálogo, preferências e dado vivo ficam intactos. Filhos de um pai expurgado vão junto (sem órfãos).
type Raw = Record<string, unknown>;
const raw = (m: Model) => m._raw as unknown as Raw;

/** Tabela → [tabela filha, coluna que aponta para o pai]. Ordem: pai antes do filho. */
const ARVORES: { pai: string; filhos: { tabela: string; fk: string }[] }[] = [
  { pai: 'workout', filhos: [{ tabela: 'workout_exercise', fk: 'workout_id' }] },
  { pai: 'workout_exercise', filhos: [{ tabela: 'workout_set', fk: 'workout_exercise_id' }] },
  { pai: 'routine', filhos: [{ tabela: 'routine_exercise', fk: 'routine_id' }] },
  { pai: 'routine_exercise', filhos: [{ tabela: 'routine_set', fk: 'routine_exercise_id' }] },
];
const SOLTAS = ['workout_set', 'routine_set', 'exercise_note'];

/** Apaga fisicamente os tombstones vencidos e devolve quantas linhas removeu. Idempotente. */
export async function purgeExpiredTombstones(db: Database, now: number = Date.now()): Promise<number> {
  return db.write(async () => {
    const apagar = new Map<string, Model>(); // `${tabela}:${id}` → registro
    const marcar = (tabela: string, m: Model) => apagar.set(`${tabela}:${m.id}`, m);
    const idsPorTabela = new Map<string, Set<string>>();
    const ids = (tabela: string) => {
      let s = idsPorTabela.get(tabela);
      if (!s) idsPorTabela.set(tabela, (s = new Set()));
      return s;
    };

    const vencidos = async (tabela: string) =>
      (await db.get<Model>(tabela).query(Q.where('deleted_at', Q.notEq(null))).fetch()).filter((m) =>
        isPurgeable(Number(raw(m).deleted_at), now),
      );

    for (const { pai } of ARVORES) for (const m of await vencidos(pai)) (marcar(pai, m), ids(pai).add(m.id));
    for (const t of SOLTAS) for (const m of await vencidos(t)) (marcar(t, m), ids(t).add(m.id));

    // Filhos de pais expurgados (vivos ou não), em cascata: workout → exercício → série.
    for (const { pai, filhos } of ARVORES) {
      const paiIds = [...ids(pai)];
      if (paiIds.length === 0) continue;
      for (const { tabela, fk } of filhos) {
        for (const m of await db.get<Model>(tabela).query(Q.where(fk, Q.oneOf(paiIds))).fetch()) {
          marcar(tabela, m);
          ids(tabela).add(m.id);
        }
      }
    }

    const registros = [...apagar.values()];
    if (registros.length > 0) await db.batch(registros.map((m) => m.prepareDestroyPermanently()));
    return registros.length;
  });
}

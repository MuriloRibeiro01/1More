/// <reference types="node" />
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../../src/App';
import { loadThemePreference, saveThemePreference } from '../../src/db/preferences';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { saveExerciseNote } from '../../src/exercise/data';
import { discardWorkout, finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-006e, item 2 (S2 / C43, RN-20): tombstones com 30 dias ou mais são removidos fisicamente, na abertura do app.
// Contrato proposto ao Prisma (combinado por maestri ask):
//   src/db/purge.ts  →  export async function purgeExpiredTombstones(db: Database, now?: number): Promise<number>
//   (devolve quantas linhas apagou; usa `isPurgeable` de src/workout/rules.ts; só toca linhas com deleted_at)
//   src/App.tsx chama isso na abertura, junto do seedCatalog, sem impedir o app de abrir se falhar.
const D = 86_400_000;
const AGORA = Date.now();
const TABELAS = ['workout', 'workout_exercise', 'workout_set', 'routine', 'routine_exercise', 'routine_set', 'exercise_note'];

let db: Database;
let rotinaId: string;

type Purge = (db: Database, now?: number) => Promise<number>;
async function carregarPurge(): Promise<Purge | undefined> {
  try {
    // caminho montado em tempo de execução: o módulo ainda não existe e o tsc não pode tentar resolvê-lo
    const modulo = require('../../src/db/' + 'purge') as { purgeExpiredTombstones?: Purge };
    return modulo.purgeExpiredTombstones;
  } catch {
    return undefined;
  }
}

async function exigirPurge(): Promise<Purge> {
  const fn = await carregarPurge();
  if (!fn) throw new Error('funcionalidade ausente: src/db/purge.ts não exporta purgeExpiredTombstones');
  return fn;
}

const linhas = async (tabela: string) =>
  (await db.get<Model>(tabela).query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);
const total = async () => (await Promise.all(TABELAS.map(async (t) => (await linhas(t)).length))).reduce((a, b) => a + b, 0);

/** Marca o deleted_at de uma linha à força (o expurgo olha só para ele). */
async function apagarEm(tabela: string, id: string, quando: number) {
  await db.write(async () => {
    const r = await db.get<Model>(tabela).find(id);
    await r.update(() => {
      r._setRaw('deleted_at', quando);
    });
  });
}

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const [ex] = await listCatalog(db);
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ex.id, sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});

// Decisão do Atlas (B1): ENQUANTO NÃO EXISTE SYNC, o expurgo é por idade (>= 30 dias) e só.
// T-003: quando houver sync, só expurgar após o servidor confirmar o tombstone (RN-21) — este bloco muda junto.
describe('purgeExpiredTombstones (RN-20)', () => {
  it('existe em src/db/purge.ts', async () => {
    expect(typeof (await carregarPurge())).toBe('function');
  });

  it('tombstone com 31 dias é removido de verdade (a linha some do banco)', async () => {
    const purge = await exigirPurge();
    const id = await startWorkout(db, { routineId: rotinaId, now: AGORA - 40 * D });
    await discardWorkout(db, id, AGORA - 31 * D);
    expect((await linhas('workout')).some((r) => r.id === id)).toBe(true);
    await purge(db, AGORA);
    expect((await linhas('workout')).some((r) => r.id === id)).toBe(false);
  });

  it('tombstone com 29 dias permanece', async () => {
    const purge = await exigirPurge();
    const id = await startWorkout(db, { routineId: rotinaId, now: AGORA - 40 * D });
    await discardWorkout(db, id, AGORA - 29 * D);
    await purge(db, AGORA);
    expect((await linhas('workout')).find((r) => r.id === id)).toMatchObject({ deleted_at: AGORA - 29 * D });
  });

  it('o limite: 30 dias exatos expurga; 30 dias menos 1 ms permanece', async () => {
    const purge = await exigirPurge();
    const a = await startWorkout(db, { routineId: rotinaId, now: AGORA - 40 * D });
    await discardWorkout(db, a, AGORA - 30 * D);
    const [ex] = await listCatalog(db);
    const b = await saveRoutine(db, {
      name: 'B',
      exercises: [{ exerciseId: ex.id, sets: 1, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }],
    });
    await apagarEm('routine', b, AGORA - 30 * D + 1);
    await purge(db, AGORA);
    expect((await linhas('workout')).some((r) => r.id === a)).toBe(false);
    expect((await linhas('routine')).some((r) => r.id === b)).toBe(true);
  });

  it('leva junto os filhos tombstonados (séries e exercícios do treino) e não deixa órfãos', async () => {
    const purge = await exigirPurge();
    const id = await startWorkout(db, { routineId: rotinaId, now: AGORA - 40 * D });
    await discardWorkout(db, id, AGORA - 31 * D);
    expect((await linhas('workout_set')).length).toBeGreaterThan(0);
    await purge(db, AGORA);
    expect(await linhas('workout_set')).toEqual([]);
    expect(await linhas('workout_exercise')).toEqual([]);
  });

  it('devolve quantas linhas apagou', async () => {
    const purge = await exigirPurge();
    const id = await startWorkout(db, { routineId: rotinaId, now: AGORA - 40 * D });
    await discardWorkout(db, id, AGORA - 31 * D);
    const antes = await total();
    const n = await purge(db, AGORA);
    expect(n).toBeGreaterThan(0);
    expect(await total()).toBe(antes - n);
  });

  it('nunca toca em dado vivo, por mais antigo que seja (deleted_at nulo)', async () => {
    const purge = await exigirPurge();
    const velho = await startWorkout(db, { routineId: rotinaId, now: AGORA - 400 * D });
    const w = await loadWorkout(db, velho);
    // conclui as 2 séries: com pendentes descartadas o próprio finishWorkout geraria um tombstone (vencido de verdade)
    for (const [i, serie] of w.exercises[0].sets.entries()) {
      await updateSet(db, serie.id, { weightKg: 60, reps: 10, completed: true }, AGORA - 400 * D + (i + 1) * 60_000);
    }
    await finishWorkout(db, velho, { now: AGORA - 400 * D + 300_000 });
    await saveExerciseNote(db, w.exercises[0].exerciseId, 'nota antiga', AGORA - 400 * D);
    const antes = await total();
    const n = await purge(db, AGORA);
    expect(n).toBe(0);
    expect(await total()).toBe(antes);
    expect((await linhas('workout')).find((r) => r.id === velho)).toMatchObject({ deleted_at: null, status: 'finished' });
  });

  it('o catálogo e as preferências ficam intactos', async () => {
    const purge = await exigirPurge();
    const catalogo = (await linhas('exercise')).length;
    await purge(db, AGORA + 400 * D);
    expect((await linhas('exercise')).length).toBe(catalogo);
  });

  it('as preferências do aparelho (tema) ficam intactas, mesmo com o relógio 1 ano à frente', async () => {
    const purge = await exigirPurge();
    await saveThemePreference(db, 'dark');
    await purge(db, AGORA + 365 * D);
    expect(await loadThemePreference(db)).toBe('dark');
  });

  it('mistura: expurga só o vencido, e rodar de novo não apaga mais nada (idempotente)', async () => {
    const purge = await exigirPurge();
    const velho = await startWorkout(db, { routineId: rotinaId, now: AGORA - 50 * D });
    await discardWorkout(db, velho, AGORA - 45 * D);
    const novo = await startWorkout(db, { routineId: rotinaId, now: AGORA - 5 * D });
    await discardWorkout(db, novo, AGORA - 2 * D);
    await purge(db, AGORA);
    const ids = (await linhas('workout')).map((r) => r.id);
    expect(ids).toContain(novo);
    expect(ids).not.toContain(velho);
    expect(await purge(db, AGORA)).toBe(0);
  });
});

// A rotina tem de rodar na ABERTURA do app. Monta o App de verdade, com o banco de teste no lugar do SQLite.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn() }));
// o App usa SafeAreaProvider sem métricas iniciais: sem este mock ele não renderiza os filhos no jest
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../src/db', () => {
  const { criarBancoDeTeste: criar } = require('../../test-utils/db') as typeof import('../../test-utils/db');
  const { schema } = require('../../src/db/schema') as typeof import('../../src/db/schema');
  const { migrations } = require('../../src/db/migrations') as typeof import('../../src/db/migrations');
  return { database: criar(), schema, migrations };
});

describe('abertura do app', () => {
  it('expurga os tombstones vencidos ao abrir (31 dias some, 29 dias fica; dado vivo intocado)', async () => {
    const { database } = jest.requireMock('../../src/db') as { database: Database };
    await seedCatalog(database);
    const [ex] = await listCatalog(database);
    const r = await saveRoutine(database, {
      name: 'A',
      exercises: [{ exerciseId: ex.id, sets: 1, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
    });
    const vencido = await startWorkout(database, { routineId: r, now: Date.now() - 40 * D });
    await discardWorkout(database, vencido, Date.now() - 31 * D);
    const recente = await startWorkout(database, { routineId: r, now: Date.now() - 35 * D });
    await discardWorkout(database, recente, Date.now() - 29 * D);

    await render(<App />);
    expect(await screen.findAllByRole('tab')).toHaveLength(4); // o app abriu (a ferramenta de teste funciona)
    await waitFor(
      async () => {
        const ids = (await database.get<Model>('workout').query().fetch()).map((m) => m.id);
        expect(ids).not.toContain(vencido);
      },
      { timeout: 2500 },
    );
    const ids = (await database.get<Model>('workout').query().fetch()).map((m) => m.id);
    expect(ids).toContain(recente);
    const rotinas = (await database.get<Model>('routine').query().fetch()).map((m) => m.id);
    expect(rotinas).toContain(r);
  }, 20_000);
});

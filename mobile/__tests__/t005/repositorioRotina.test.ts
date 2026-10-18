import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import {
  RoutineValidationError,
  deleteRoutine,
  listCatalog,
  listRoutines,
  loadRoutine,
  saveRoutine,
  seedCatalog,
} from '../../src/routines/repository';
import type { ExerciseDraft } from '../../src/routines/types';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-005 — persistência local (WatermelonDB, schema v2). Critérios: persistência, séries materializadas,
// carga em kg, tombstone, atomicidade, UUID v7, colunas de sync.

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Raw = Record<string, unknown>;
async function linhas(db: Database, tabela: string): Promise<Raw[]> {
  const todos = await db.get<Model>(tabela).query().fetch();
  return todos.map((m) => m._raw as unknown as Raw);
}
const ativas = (rs: Raw[]) => rs.filter((r) => r.deleted_at == null);

let db: Database;
let supino: string;
let agachamento: string;

const ex = (exerciseId: string, over: Partial<ExerciseDraft> = {}): ExerciseDraft => ({
  exerciseId,
  sets: 3,
  weightKg: null,
  repsMin: null,
  repsMax: null,
  restSeconds: 90,
  ...over,
});

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const catalogo = await listCatalog(db);
  supino = catalogo.find((e) => e.name === 'Supino reto com barra')!.id;
  agachamento = catalogo.find((e) => e.name === 'Agachamento livre')!.id;
});

describe('catálogo embarcado (RN-19)', () => {
  it('semeia ~20 exercícios de musculação, ordenados por nome, com ids UUID v7', async () => {
    const catalogo = await listCatalog(db);
    expect(catalogo.length).toBeGreaterThanOrEqual(15);
    expect(catalogo.map((e) => e.name)).toEqual(expect.arrayContaining(['Agachamento livre', 'Supino reto com barra']));
    expect(catalogo.map((e) => e.name)).toEqual([...catalogo.map((e) => e.name)].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    catalogo.forEach((e) => expect(e.id).toMatch(UUID_V7));
  });

  it('é idempotente: semear de novo não duplica', async () => {
    const antes = (await listCatalog(db)).length;
    await seedCatalog(db);
    expect(await listCatalog(db)).toHaveLength(antes);
  });

  it('exercícios do catálogo têm user_id nulo', async () => {
    (await linhas(db, 'exercise')).forEach((r) => expect(r.user_id ?? null).toBeNull());
  });
});

describe('salvar e reabrir', () => {
  it('rotina com 2 exercícios volta com os mesmos valores e na mesma ordem', async () => {
    const draft = {
      name: 'Treino A — Peito',
      exercises: [
        ex(supino, { sets: 4, weightKg: 82.5, repsMin: 8, repsMax: 12, restSeconds: 120 }),
        ex(agachamento, { sets: 3, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }),
      ],
    };
    const id = await saveRoutine(db, draft);
    expect(id).toMatch(UUID_V7);
    expect(await loadRoutine(db, id)).toEqual({ id, ...draft });
    expect(await listRoutines(db)).toEqual([
      { id, name: 'Treino A — Peito', exerciseNames: ['Supino reto com barra', 'Agachamento livre'] },
    ]);
  });

  it('padrão do exercício: 3 séries e descanso 90 s gravados', async () => {
    const id = await saveRoutine(db, { name: 'B', exercises: [ex(supino)] });
    const re = ativas(await linhas(db, 'routine_exercise'));
    expect(re).toHaveLength(1);
    expect(re[0].rest_seconds).toBe(90);
    expect(ativas(await linhas(db, 'routine_set'))).toHaveLength(3);
    expect((await loadRoutine(db, id)).exercises[0]).toMatchObject({ sets: 3, restSeconds: 90 });
  });

  it('carga 82,5 é gravada como 82.50 kg em target_weight_kg', async () => {
    await saveRoutine(db, { name: 'C', exercises: [ex(supino, { weightKg: 82.5, sets: 2 })] });
    ativas(await linhas(db, 'routine_set')).forEach((s) => expect(s.target_weight_kg).toBe(82.5));
  });

  it('ids UUID v7 e colunas de sync preenchidas em routine, routine_exercise e routine_set', async () => {
    await saveRoutine(db, { name: 'D', exercises: [ex(supino)] });
    for (const tabela of ['routine', 'routine_exercise', 'routine_set']) {
      for (const r of await linhas(db, tabela)) {
        expect(r.id).toMatch(UUID_V7);
        expect(r.user_id ?? null).toBeNull();
        expect(r.created_at).toEqual(expect.any(Number));
        expect(r.updated_at).toEqual(expect.any(Number));
        expect(r.deleted_at ?? null).toBeNull();
      }
    }
  });

  it('cada routine_set guarda reps, carga e ordens distintas ligados ao routine_exercise', async () => {
    await saveRoutine(db, { name: 'E', exercises: [ex(supino, { sets: 3, weightKg: 60, repsMin: 8, repsMax: 10 })] });
    const [re] = ativas(await linhas(db, 'routine_exercise'));
    const sets = ativas(await linhas(db, 'routine_set'));
    expect(sets.map((s) => s.routine_exercise_id)).toEqual([re.id, re.id, re.id]);
    expect(new Set(sets.map((s) => s.sort_order)).size).toBe(3);
    sets.forEach((s) => expect(s).toMatchObject({ reps_min: 8, reps_max: 10, target_weight_kg: 60 }));
  });
});

describe('editar', () => {
  it('4 séries viram 4 routine_set; mudar para 2 deixa só 2 ativas (o resto com deleted_at)', async () => {
    const id = await saveRoutine(db, { name: 'F', exercises: [ex(supino, { sets: 4 })] });
    expect(ativas(await linhas(db, 'routine_set'))).toHaveLength(4);

    await saveRoutine(db, { id, name: 'F', exercises: [ex(supino, { sets: 2 })] });
    const todas = await linhas(db, 'routine_set');
    expect(ativas(todas)).toHaveLength(2);
    expect(todas.length).toBeGreaterThanOrEqual(2);
    todas.filter((s) => s.deleted_at != null).forEach((s) => expect(s.deleted_at).toEqual(expect.any(Number)));
    expect((await loadRoutine(db, id)).exercises[0].sets).toBe(2);
  });

  it('atualiza a mesma rotina (mesmo id), troca nome, ordem e remove exercício', async () => {
    const id = await saveRoutine(db, { name: 'G', exercises: [ex(supino), ex(agachamento)] });
    await saveRoutine(db, { id, name: 'G2', exercises: [ex(agachamento, { sets: 5 })] });

    expect(await listRoutines(db)).toEqual([{ id, name: 'G2', exerciseNames: ['Agachamento livre'] }]);
    expect(ativas(await linhas(db, 'routine'))).toHaveLength(1);
    expect(ativas(await linhas(db, 'routine_exercise'))).toHaveLength(1);
    expect(ativas(await linhas(db, 'routine_set'))).toHaveLength(5);
  });

  it('reordenar persiste a nova ordem', async () => {
    const id = await saveRoutine(db, { name: 'H', exercises: [ex(supino), ex(agachamento)] });
    await saveRoutine(db, { id, name: 'H', exercises: [ex(agachamento), ex(supino)] });
    expect((await loadRoutine(db, id)).exercises.map((e) => e.exerciseId)).toEqual([agachamento, supino]);
  });
});

describe('validação no salvar', () => {
  it.each([
    [{ name: '', exercises: [] as ExerciseDraft[] }, ['name_required', 'no_exercises']],
    [{ name: 'X', exercises: [] as ExerciseDraft[] }, ['no_exercises']],
  ])('rotina inválida não salva e diz o motivo', async (draft, motivos) => {
    const erro = await saveRoutine(db, draft).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(RoutineValidationError);
    expect((erro as RoutineValidationError).errors).toEqual(expect.arrayContaining(motivos));
    expect(await linhas(db, 'routine')).toHaveLength(0);
  });

  it('carga negativa não salva', async () => {
    const erro = await saveRoutine(db, { name: 'X', exercises: [ex(supino, { weightKg: -2.5 })] }).catch((e: unknown) => e);
    expect((erro as RoutineValidationError).errors).toContain('invalid_weight');
    expect(await linhas(db, 'routine_set')).toHaveLength(0);
  });

  it('exercício inexistente no catálogo não salva nada', async () => {
    await expect(saveRoutine(db, { name: 'X', exercises: [ex(supino), ex('nao-existe')] })).rejects.toThrow();
    expect(await linhas(db, 'routine')).toHaveLength(0);
    expect(await linhas(db, 'routine_exercise')).toHaveLength(0);
  });
});

describe('atomicidade (RNF-02)', () => {
  it('falha ao gravar as séries não deixa rotina nem exercício pela metade', async () => {
    // Derruba qualquer gravação que contenha routine_set. Se o salvar usar uma só transação, nada fica.
    const adapter = db.adapter as unknown as { batch: (ops: unknown[][]) => Promise<void> };
    const original = adapter.batch.bind(adapter);
    jest.spyOn(adapter, 'batch').mockImplementation(async (ops) => {
      if (ops.some((op) => op[1] === 'routine_set')) throw new Error('disco cheio');
      return original(ops);
    });

    await expect(saveRoutine(db, { name: 'Atômica', exercises: [ex(supino), ex(agachamento)] })).rejects.toThrow();
    jest.restoreAllMocks();

    expect(await linhas(db, 'routine')).toHaveLength(0);
    expect(await linhas(db, 'routine_exercise')).toHaveLength(0);
    expect(await linhas(db, 'routine_set')).toHaveLength(0);
  });

  it('falha ao editar mantém a versão anterior inteira', async () => {
    const id = await saveRoutine(db, { name: 'Antes', exercises: [ex(supino, { sets: 4 })] });
    const adapter = db.adapter as unknown as { batch: (ops: unknown[][]) => Promise<void> };
    jest.spyOn(adapter, 'batch').mockRejectedValue(new Error('disco cheio'));

    await expect(saveRoutine(db, { id, name: 'Depois', exercises: [ex(agachamento, { sets: 2 })] })).rejects.toThrow();
    jest.restoreAllMocks();

    expect(await loadRoutine(db, id)).toEqual({ id, name: 'Antes', exercises: [ex(supino, { sets: 4 })] });
  });
});

describe('excluir (tombstone, RN-20)', () => {
  it('some da lista e no banco fica com deleted_at, sem DELETE físico', async () => {
    const fica = await saveRoutine(db, { name: 'Fica', exercises: [ex(supino)] });
    const sai = await saveRoutine(db, { name: 'Sai', exercises: [ex(agachamento)] });

    await deleteRoutine(db, sai);

    expect((await listRoutines(db)).map((r) => r.id)).toEqual([fica]);
    const rotinas = await linhas(db, 'routine');
    expect(rotinas).toHaveLength(2);
    const excluida = rotinas.find((r) => r.id === sai)!;
    expect(excluida.deleted_at).toEqual(expect.any(Number));
    expect(excluida._status).not.toBe('deleted');
  });
});

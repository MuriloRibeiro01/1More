import { describe, expect, it } from '@jest/globals';
import { migrations } from '../../src/db/migrations';
import { schema } from '../../src/db/schema';

// A v3 (treino) chega por migração: o passo toVersion 3 cria exatamente as colunas do schema atual dessas tabelas.
// Quando a v4 mudar uma delas, este teste passa a comparar só o que a v3 publicou: congele aqui, como a v2.
type Col = { name: string; type: string; isOptional?: boolean; isIndexed?: boolean };
type Passo = { type: string; schema: { name: string; columnArray: Col[] } };
const limpa = (c: Col): Col => ({ name: c.name, type: c.type, ...(c.isOptional ? { isOptional: true } : {}), ...(c.isIndexed ? { isIndexed: true } : {}) });

describe('migração v3 (Fase 4)', () => {
  const v3 = (migrations as unknown as { sortedMigrations: { toVersion: number; steps: Passo[] }[] }).sortedMigrations.find(
    (m) => m.toVersion === 3,
  )!;

  it('o schema está na versão 3 e a migração cria as 3 tabelas do treino', () => {
    expect(schema.version).toBeGreaterThanOrEqual(3);
    expect(v3.steps.every((s) => s.type === 'create_table')).toBe(true);
    expect(v3.steps.map((s) => s.schema.name)).toEqual(['workout', 'workout_exercise', 'workout_set']);
  });

  it.each(['workout', 'workout_exercise', 'workout_set'])('colunas de %s iguais às do schema', (tabela) => {
    const passo = v3.steps.find((s) => s.schema.name === tabela)!;
    const atual = (schema.tables as unknown as Record<string, { columnArray: Col[] }>)[tabela];
    expect(passo.schema.columnArray.map(limpa)).toEqual(atual.columnArray.map(limpa));
  });

  it('toda tabela do treino tem as colunas de sync', () => {
    for (const s of v3.steps) {
      const nomes = s.schema.columnArray.map((c) => c.name);
      expect(nomes).toEqual(expect.arrayContaining(['user_id', 'created_at', 'updated_at', 'server_version', 'deleted_at']));
    }
  });
});

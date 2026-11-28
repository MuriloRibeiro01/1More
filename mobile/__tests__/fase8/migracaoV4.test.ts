import { describe, expect, it } from '@jest/globals';
import { migrations } from '../../src/db/migrations';
import { schema } from '../../src/db/schema';

// A v4 só ADICIONA a tabela exercise_note (nota do usuário sobre um exercício; o catálogo é read-only, RN-19).
type Col = { name: string; type: string; isOptional?: boolean; isIndexed?: boolean };
type Passo = { type: string; schema: { name: string; columnArray: Col[] } };
const limpa = (c: Col): Col => ({ name: c.name, type: c.type, ...(c.isOptional ? { isOptional: true } : {}), ...(c.isIndexed ? { isIndexed: true } : {}) });

describe('migração v4 (nota do exercício)', () => {
  const v4 = (migrations as unknown as { sortedMigrations: { toVersion: number; steps: Passo[] }[] }).sortedMigrations.find(
    (m) => m.toVersion === 4,
  )!;

  it('o schema está na versão 4 e o passo cria só exercise_note', () => {
    expect(schema.version).toBeGreaterThanOrEqual(4); // v5 e v6 vêm da T-006c e T-006b
    expect(v4.steps.map((s) => [s.type, s.schema.name])).toEqual([['create_table', 'exercise_note']]);
  });

  it('colunas congeladas: exercise_id indexada, text e as colunas de sync', () => {
    expect(v4.steps[0].schema.columnArray.map(limpa)).toEqual([
      { name: 'exercise_id', type: 'string', isIndexed: true },
      { name: 'text', type: 'string' },
      { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
      { name: 'created_at', type: 'number' },
      { name: 'updated_at', type: 'number' },
      { name: 'server_version', type: 'number', isOptional: true },
      { name: 'deleted_at', type: 'number', isOptional: true },
    ]);
  });

  it('o schema atual tem a mesma tabela', () => {
    const atual = (schema.tables as unknown as Record<string, { columnArray: Col[] }>).exercise_note;
    expect(atual.columnArray.map(limpa)).toEqual(v4.steps[0].schema.columnArray.map(limpa));
  });
});

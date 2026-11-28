import { describe, expect, it } from '@jest/globals';
import { migrations } from '../../src/db/migrations';
import { schema } from '../../src/db/schema';

// T-006b (pastas de rotinas, C37 / RF-24): a v6 cria a tabela `routine_folder` e liga `routine.folder_id` (nulo = "sem pasta").
// Numeração combinada: v5 = T-006c (exercise.is_custom), v6 = T-006b. Se a v5 mudar de dono, renumere aqui.
type Col = { name: string; type: string; isOptional?: boolean; isIndexed?: boolean };
type Passo = { type: string; table?: string; columns?: Col[]; schema?: { name: string; columnArray: Col[] } };
const limpa = (c: Col): Col => ({ name: c.name, type: c.type, ...(c.isOptional ? { isOptional: true } : {}), ...(c.isIndexed ? { isIndexed: true } : {}) });
const todas = (migrations as unknown as { sortedMigrations: { toVersion: number; steps: Passo[] }[] }).sortedMigrations;
const SYNC: Col[] = [
  { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
  { name: 'created_at', type: 'number' },
  { name: 'updated_at', type: 'number' },
  { name: 'server_version', type: 'number', isOptional: true },
  { name: 'deleted_at', type: 'number', isOptional: true },
];

function passo6() {
  const m = todas.find((x) => x.toVersion === 6);
  if (!m) throw new Error('funcionalidade ausente: migração toVersion 6 não existe em src/db/migrations.ts');
  return m;
}

describe('migração v6 (pastas de rotinas)', () => {
  it('existe o passo toVersion 6 e o schema está na versão 6 ou acima', () => {
    expect(todas.some((m) => m.toVersion === 6)).toBe(true);
    expect(schema.version).toBeGreaterThanOrEqual(6);
  });

  it('o passo cria routine_folder e adiciona routine.folder_id (nessa ordem, nada mais)', () => {
    const v6 = passo6();
    expect(v6.steps.map((s) => [s.type, s.schema?.name ?? s.table])).toEqual([
      ['create_table', 'routine_folder'],
      ['add_columns', 'routine'],
    ]);
  });

  it('colunas congeladas de routine_folder: name, sort_order e as de sync (exclusão lógica)', () => {
    const v6 = passo6();
    expect(v6.steps[0].schema!.columnArray.map(limpa)).toEqual([
      { name: 'name', type: 'string' },
      { name: 'sort_order', type: 'number' },
      ...SYNC,
    ]);
  });

  it('routine ganha folder_id opcional e indexado', () => {
    const v6 = passo6();
    expect(v6.steps[1].columns!.map(limpa)).toEqual([{ name: 'folder_id', type: 'string', isOptional: true, isIndexed: true }]);
  });

  it('o schema atual tem a tabela nova igual ao passo e a coluna em routine', () => {
    const tabelas = schema.tables as unknown as Record<string, { columnArray: Col[] }>;
    const v6 = passo6();
    expect(tabelas.routine_folder.columnArray.map(limpa)).toEqual(v6.steps[0].schema!.columnArray.map(limpa));
    expect(tabelas.routine.columnArray.map((c) => c.name)).toContain('folder_id');
  });
});

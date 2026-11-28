import { describe, expect, it } from '@jest/globals';
import { migrations } from '../../src/db/migrations';
import { schema } from '../../src/db/schema';

// T-006c: a v5 só ADICIONA a `exercise` a coluna `is_custom` (exercício criado pela pessoa, RF-12/RN-19).
// Proposta de numeração combinada com o Prisma: v5 = T-006c, v6 = T-006b (pastas). Colunas novas: sem default no schema,
// as linhas antigas (catálogo embarcado) valem false.
type Col = { name: string; type: string; isOptional?: boolean; isIndexed?: boolean };
type Passo = { type: string; table?: string; columns?: Col[] };
const limpa = (c: Col): Col => ({ name: c.name, type: c.type, ...(c.isOptional ? { isOptional: true } : {}), ...(c.isIndexed ? { isIndexed: true } : {}) });
const todas = (migrations as unknown as { sortedMigrations: { toVersion: number; steps: Passo[] }[] }).sortedMigrations;

function passo5() {
  const m = todas.find((x) => x.toVersion === 5);
  if (!m) throw new Error('funcionalidade ausente: migração toVersion 5 não existe em src/db/migrations.ts');
  return m;
}

describe('migração v5 (exercício próprio)', () => {
  it('existe o passo toVersion 5 e o schema está na versão 5 ou acima', () => {
    expect(todas.some((m) => m.toVersion === 5)).toBe(true);
    expect(schema.version).toBeGreaterThanOrEqual(5);
  });

  it('o passo só adiciona a coluna is_custom (boolean) à tabela exercise', () => {
    const v5 = passo5();
    expect(v5.steps.map((s) => [s.type, s.table])).toEqual([['add_columns', 'exercise']]);
    expect(v5.steps[0].columns!.map(limpa)).toEqual([{ name: 'is_custom', type: 'boolean' }]);
  });

  it('o schema atual da tabela exercise tem a coluna e mantém as anteriores e as de sync', () => {
    const colunas = (schema.tables as unknown as Record<string, { columnArray: Col[] }>).exercise.columnArray.map((c) => c.name);
    expect(colunas).toEqual(
      expect.arrayContaining([
        'name', 'tracking_type', 'primary_muscle', 'secondary_muscles', 'equipment_code', 'is_custom',
        'user_id', 'created_at', 'updated_at', 'server_version', 'deleted_at',
      ]),
    );
  });

  it('as migrações 2, 3 e 4 continuam no lugar (nada já mergeado foi alterado)', () => {
    expect(todas.map((m) => m.toVersion).slice(0, 3)).toEqual([2, 3, 4]);
  });
});

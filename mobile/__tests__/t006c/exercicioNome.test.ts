import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database, Model } from '@nozbe/watermelondb';
import { saveCustomExercise } from '../../src/routines/customExercise';
import { seedCatalog } from '../../src/routines/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-006c, sugestão s7 do Sérgio: o nome do exercício próprio tem limite de 80 caracteres também no REPOSITÓRIO (hoje só a tela limita),
// como a rotina faz com MAX_NAME. 80 passa; 81 é recusado sem gravar nada; os espaços das pontas não contam.
let db: Database;
const base = { primaryMuscle: null, equipmentCode: null, trackingType: 'weight_reps' as const };
const proprios = async () =>
  (await db.get<Model>('exercise').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>).filter((r) => r.is_custom === true);

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
});

describe('limite de tamanho do nome (s7)', () => {
  it('80 caracteres é aceito', async () => {
    await expect(saveCustomExercise(db, { ...base, name: 'a'.repeat(80) })).resolves.toEqual(expect.any(String));
  });

  it('81 caracteres é recusado e nada é gravado', async () => {
    await expect(saveCustomExercise(db, { ...base, name: 'a'.repeat(81) })).rejects.toThrow();
    expect(await proprios()).toEqual([]);
  });

  it('espaços nas pontas não contam para o limite (80 letras + espaços passa)', async () => {
    await expect(saveCustomExercise(db, { ...base, name: `  ${'b'.repeat(80)}  ` })).resolves.toEqual(expect.any(String));
  });

  it('editar um exercício próprio para um nome com 81 caracteres também é recusado', async () => {
    const id = await saveCustomExercise(db, { ...base, name: 'Curto' });
    await expect(saveCustomExercise(db, { ...base, name: 'c'.repeat(81) }, id)).rejects.toThrow();
    expect((await proprios())[0].name).toBe('Curto');
  });
});

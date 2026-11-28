import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, swapExercise, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-006a (a) do Sérgio, validações de swapExercise: recusa trocar pelo MESMO exercício, treino inexistente
// (linha de workout_exercise que não existe) e treino que não está ativo; nada é gravado quando recusa.
const SUPINO = 'Supino reto com barra';
const ROSCA = 'Rosca direta';
let db: Database;
let ids: Record<string, string>;
let workoutId: string;
let exercicioDoTreino: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  ids = Object.fromEntries([SUPINO, ROSCA].map((n) => [n, cat.find((e) => e.name === n)!.id]));
  const rotina = await saveRoutine(db, {
    name: 'A',
    exercises: [{ exerciseId: ids[SUPINO], sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
  workoutId = await startWorkout(db, { routineId: rotina, now: Date.now() });
  exercicioDoTreino = (await loadWorkout(db, workoutId)).exercises[0].id;
});

describe('swapExercise recusa', () => {
  it('trocar pelo mesmo exercício', async () => {
    const antes = await loadWorkout(db, workoutId);
    await expect(swapExercise(db, exercicioDoTreino, ids[SUPINO])).rejects.toThrow();
    expect(await loadWorkout(db, workoutId)).toEqual(antes);
  });

  it('uma linha de exercício do treino que não existe', async () => {
    await expect(swapExercise(db, 'id-que-nao-existe', ids[ROSCA])).rejects.toThrow();
  });

  it('um exercício novo que não existe no catálogo, sem gravar nada', async () => {
    const antes = await loadWorkout(db, workoutId);
    await expect(swapExercise(db, exercicioDoTreino, 'exercicio-fantasma')).rejects.toThrow();
    expect(await loadWorkout(db, workoutId)).toEqual(antes);
  });

  it('um treino que já foi finalizado (só o treino ativo troca de exercício)', async () => {
    const w = await loadWorkout(db, workoutId);
    for (const [i, s] of w.exercises[0].sets.entries()) await updateSet(db, s.id, { weightKg: 60, reps: 10, completed: true }, Date.now() + i);
    await finishWorkout(db, workoutId);
    const antes = await loadWorkout(db, workoutId);
    await expect(swapExercise(db, exercicioDoTreino, ids[ROSCA])).rejects.toThrow();
    expect(await loadWorkout(db, workoutId)).toEqual(antes);
  });

  it('controle: a troca válida continua funcionando', async () => {
    await expect(swapExercise(db, exercicioDoTreino, ids[ROSCA])).resolves.toEqual(expect.any(String));
  });
});

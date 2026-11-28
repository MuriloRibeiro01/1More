import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { weeklyMuscleSets } from '../../src/progress/weeklyMuscles';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { loadSummary } from '../../src/workout/summary';
import { criarBancoDeTeste } from '../../test-utils/db';

// T-006e, item 3 (S7, RN-24): a semana de um treino é cortada pelo fuso GRAVADO no treino (tz_offset_min),
// não pelo fuso do aparelho de agora. Os casos são montados em função do fuso da máquina que roda o teste,
// então valem em qualquer fuso (UTC, UTC-3...): o treino sempre fica 3 h à frente ou atrás do aparelho.
const MIN = 60_000;
const SEGUNDA = new Date(2026, 10, 9); // segunda, 9 nov 2026, meia-noite local do aparelho
const DEV = -SEGUNDA.getTimezoneOffset(); // deslocamento do aparelho, em minutos

/** Instante UTC em que o relógio do fuso `tz` marca AAAA-MM-DD hh:mm. */
const noFuso = (dia: number, hora: number, tz: number, mes = 10) => Date.UTC(2026, mes, dia, hora, 0) - tz * MIN;

let db: Database;
let rotinaId: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const cat = await listCatalog(db);
  rotinaId = await saveRoutine(db, {
    name: 'A',
    exercises: [
      { exerciseId: cat.find((e) => e.name === 'Supino reto com barra')!.id, sets: 2, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 },
    ],
  });
});

async function treino(inicio: number, tzOffsetMin: number) {
  const id = await startWorkout(db, { routineId: rotinaId, now: inicio, tzOffsetMin });
  const w = await loadWorkout(db, id);
  for (let i = 0; i < 2; i++) {
    await updateSet(db, w.exercises[0].sets[i].id, { weightKg: 60, reps: 10, completed: true }, inicio + (i + 1) * MIN);
  }
  await finishWorkout(db, id, { pending: 'discard', now: inicio + 30 * MIN });
  return id;
}
const totalSeries = (r: { sets: number }[]) => r.reduce((n, m) => n + m.sets, 0);

describe('weeklyMuscleSets usa o fuso do treino', () => {
  it('feito na segunda 01:00 do fuso do treino (para o aparelho ainda é domingo): conta na semana de segunda', async () => {
    await treino(noFuso(9, 1, DEV + 180), DEV + 180);
    expect(totalSeries(await weeklyMuscleSets(db, SEGUNDA))).toBe(2);
  });

  it('feito no domingo 23:00 do fuso do treino (para o aparelho já é segunda): NÃO conta na semana seguinte', async () => {
    await treino(noFuso(8, 23, DEV - 180), DEV - 180);
    expect(totalSeries(await weeklyMuscleSets(db, SEGUNDA))).toBe(0);
  });

  it('borda de cima: domingo 23:00 do fuso do treino (15 nov) ainda é a semana de 9 nov', async () => {
    await treino(noFuso(15, 23, DEV - 180), DEV - 180);
    expect(totalSeries(await weeklyMuscleSets(db, SEGUNDA))).toBe(2);
  });

  it('borda de cima: segunda 00:00 do fuso do treino (16 nov) já é a outra semana', async () => {
    await treino(noFuso(16, 0, DEV + 180), DEV + 180);
    expect(totalSeries(await weeklyMuscleSets(db, SEGUNDA))).toBe(0);
  });

  it('sem diferença de fuso o resultado de antes continua igual (controle)', async () => {
    await treino(noFuso(11, 12, DEV), DEV);
    expect(totalSeries(await weeklyMuscleSets(db, SEGUNDA))).toBe(2);
  });
});

describe('loadSummary: dias treinados na semana (weekDays) pelo fuso do treino', () => {
  it('treino de segunda 01:00 no fuso dele (domingo para o aparelho) conta 1 dia na própria semana', async () => {
    const id = await treino(noFuso(9, 1, DEV + 180), DEV + 180);
    expect((await loadSummary(db, id)).weekDays).toBe(1);
  });

  it('treino de domingo 23:00 no fuso dele (segunda para o aparelho) conta 1 dia na própria semana', async () => {
    const id = await treino(noFuso(15, 23, DEV - 180), DEV - 180);
    expect((await loadSummary(db, id)).weekDays).toBe(1);
  });

  it('dois treinos na mesma semana do fuso do treino somam 2 dias', async () => {
    await treino(noFuso(9, 1, DEV + 180), DEV + 180); // segunda
    const id = await treino(noFuso(11, 12, DEV + 180), DEV + 180); // quarta
    expect((await loadSummary(db, id)).weekDays).toBe(2);
  });
});

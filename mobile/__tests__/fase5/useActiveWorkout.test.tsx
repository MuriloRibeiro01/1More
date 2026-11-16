import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { useActiveWorkout } from '../../src/workout/useActiveWorkout';
import { discardWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';

// Reativo: a faixa "Retomar" aparece e some sozinha conforme o banco muda (inclusive treino já ativo ao abrir o app).

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
let db: Database;
let rotina: string;

beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const [ex] = await listCatalog(db);
  rotina = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [{ exerciseId: ex.id, sets: 2, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }],
  });
});

describe('useActiveWorkout', () => {
  it('sem treino ativo devolve null', async () => {
    const { result } = await renderHook(() => useActiveWorkout(db));
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it('já ativo ao montar (app reaberto/crash): devolve o treino', async () => {
    const id = await startWorkout(db, { routineId: rotina, now: T0 });
    const { result } = await renderHook(() => useActiveWorkout(db));
    await waitFor(() => expect(result.current).toMatchObject({ id, name: 'Treino A', lastActivityAt: T0 }));
  });

  it('aparece ao iniciar, avança a última atividade ao concluir série e some ao descartar', async () => {
    const { result } = await renderHook(() => useActiveWorkout(db));
    await act(async () => {});
    expect(result.current).toBeNull();

    const id = await act(async () => startWorkout(db, { routineId: rotina, now: T0 }));
    await waitFor(() => expect(result.current?.id).toBe(id));

    const set = (await loadWorkout(db, id)).exercises[0].sets[0].id;
    await act(async () => updateSet(db, set, { weightKg: 50, reps: 5, completed: true }, T0 + 60_000));
    await waitFor(() => expect(result.current?.lastActivityAt).toBe(T0 + 60_000));

    await act(async () => discardWorkout(db, id, T0 + 70_000));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('forgotten (RN-04): falso se mexeu há pouco, verdadeiro se parado há mais de 4 h', async () => {
    const recente = await startWorkout(db, { routineId: rotina, now: Date.now() - 3_600_000 });
    const { result, unmount } = await renderHook(() => useActiveWorkout(db));
    await waitFor(() => expect(result.current).toMatchObject({ id: recente, forgotten: false }));
    await unmount();
    await discardWorkout(db, recente);

    await startWorkout(db, { routineId: rotina, now: Date.now() - 5 * 3_600_000 });
    const outro = await renderHook(() => useActiveWorkout(db));
    await waitFor(() => expect(outro.result.current).toMatchObject({ forgotten: true }));
  });

  it('ao desmontar para de ouvir o banco', async () => {
    const { result, unmount } = await renderHook(() => useActiveWorkout(db));
    await act(async () => {});
    await unmount();
    await startWorkout(db, { routineId: rotina, now: T0 });
    await act(async () => {});
    expect(result.current).toBeNull();
  });
});

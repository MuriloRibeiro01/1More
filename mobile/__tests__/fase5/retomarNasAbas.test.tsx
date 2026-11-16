import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { discardWorkout, startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Fase 5 — faixa "Retomar" em qualquer aba, acima da TabBar (RN-02/RN-04).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

let db: Database;
let rotina: string;
const montar = () =>
  renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );
const faixa = () => screen.queryByRole('button', { name: /Treino em andamento · Retomar|Esqueceu de finalizar\?/ });

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const [ex] = await listCatalog(db);
  rotina = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [{ exerciseId: ex.id, sets: 1, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }],
  });
});

describe('faixa Retomar nas abas', () => {
  it('sem treino ativo não há faixa em nenhuma aba', async () => {
    await montar();
    await screen.findAllByRole('tab');
    expect(faixa()).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Perfil' }));
    expect(faixa()).toBeNull();
  });

  it('com treino ativo (inclusive após reabrir o app) aparece em Treinar e continua ao trocar de aba', async () => {
    await startWorkout(db, { routineId: rotina, now: Date.now() });
    await montar();
    expect(await screen.findByRole('button', { name: 'Treino em andamento · Retomar' })).toBeOnTheScreen();
    for (const aba of ['Histórico', 'Progresso', 'Perfil']) {
      await fireEvent.press(screen.getByRole('tab', { name: aba }));
      expect(faixa()).toBeOnTheScreen();
    }
  });

  it('parado há mais de 4 h vira "Esqueceu de finalizar?" (RN-04)', async () => {
    await startWorkout(db, { routineId: rotina, now: Date.now() - 5 * 3_600_000 });
    await montar();
    expect(await screen.findByRole('button', { name: 'Esqueceu de finalizar?' })).toBeOnTheScreen();
  });

  it('some sozinha quando o treino é descartado', async () => {
    const id = await startWorkout(db, { routineId: rotina, now: Date.now() });
    await montar();
    await screen.findByRole('button', { name: 'Treino em andamento · Retomar' });
    await act(async () => discardWorkout(db, id));
    expect(await screen.findAllByRole('tab')).toHaveLength(4);
    expect(faixa()).toBeNull();
  });

  it('tocar abre o treino ativo, tela de fluxo sem abas', async () => {
    await startWorkout(db, { routineId: rotina, now: Date.now() });
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Treino em andamento · Retomar' }));
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});

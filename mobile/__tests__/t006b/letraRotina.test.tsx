import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006b, item 1 (C34): o editor mostra a letra da rotina (A, B, C…) na margem, a mesma da lista de rotinas.
// Contrato: elemento com accessibilityLabel "Letra da rotina X" (e texto X) na margem da linha do nome, em rotina existente
// e em rotina nova (a próxima letra livre, pela mesma regra da lista: posição entre as rotinas ativas).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

let db: Database;

const montar = () =>
  renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );

async function criarRotinas(n: number) {
  const [ex] = await listCatalog(db);
  const exercicio = { exerciseId: ex.id, sets: 1, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 };
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(await saveRoutine(db, { name: `Rotina ${'ABCDE'[i]} do teste`, exercises: [exercicio] }));
  return ids;
}
async function abrirEditorDe(nome: RegExp) {
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar rotinas' }));
  await fireEvent.press(await screen.findByRole('button', { name: nome }));
  await screen.findByLabelText('Nome da rotina');
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
});

describe('letra da rotina no editor (C34)', () => {
  it.each([
    ['A', /Rotina A do teste/],
    ['B', /Rotina B do teste/],
    ['C', /Rotina C do teste/],
  ])('a rotina que na lista é %s mostra "Letra da rotina %s" na margem do editor', async (letra, nome) => {
    await criarRotinas(3);
    await montar();
    await abrirEditorDe(nome);
    expect(screen.getByLabelText(`Letra da rotina ${letra}`)).toBeOnTheScreen();
    for (const outra of ['A', 'B', 'C'].filter((l) => l !== letra)) {
      expect(screen.queryByLabelText(`Letra da rotina ${outra}`)).toBeNull();
    }
  });

  it('rotina nova mostra a próxima letra (com 3 rotinas, "D"; sem nenhuma, "A")', async () => {
    await criarRotinas(3);
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    await screen.findByLabelText('Nome da rotina');
    expect(screen.getByLabelText('Letra da rotina D')).toBeOnTheScreen();
  });

  it('sem rotinas, a nova é "A"', async () => {
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    await screen.findByLabelText('Nome da rotina');
    expect(screen.getByLabelText('Letra da rotina A')).toBeOnTheScreen();
  });

  it('a letra é a mesma que a lista mostra na margem da linha da rotina', async () => {
    await criarRotinas(2);
    await montar();
    const linha = await screen.findByRole('button', { name: /Rotina B do teste/ });
    expect(linha).toBeOnTheScreen();
    expect(screen.getAllByText('B').length).toBeGreaterThan(0); // margem da lista
    await abrirEditorDe(/Rotina B do teste/);
    expect(screen.getByLabelText('Letra da rotina B')).toHaveTextContent('B');
  });
});

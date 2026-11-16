import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '../src/i18n';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { seedCatalog } from '../src/routines/repository';
import { criarBancoDeTeste } from '../test-utils/db';
import { renderComTema } from '../test-utils/render';

// Fase 3: pilha acima das abas. Abas só nas 4 telas principais; telas de fluxo (edição, catálogo) sem abas.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

// O jest-expo roda como iOS, onde o BackHandler não faz nada: este falso imita o Android.
type Listener = () => boolean | null | undefined;
const listeners: Listener[] = [];
jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  __esModule: true,
  default: {
    exitApp: jest.fn(),
    addEventListener: (_evento: string, fn: Listener) => {
      listeners.push(fn);
      return { remove: () => listeners.splice(listeners.indexOf(fn) >>> 0, 1) };
    },
  },
}));
const voltarDoAndroid = () => [...listeners].reverse().some((fn) => fn());

let db: Database;
const montar = () =>
  renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );
const abas = () => screen.queryAllByRole('tab');

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  listeners.length = 0;
  db = criarBancoDeTeste();
  await seedCatalog(db);
});

describe('pilha sobre as abas', () => {
  it('na raiz mostra as 4 abas, com Treinar ativa', async () => {
    await montar();
    expect(await screen.findByRole('tab', { name: 'Treinar' })).toBeSelected();
    expect(abas()).toHaveLength(4);
  });

  it('editar rotina é tela de fluxo: abre sem abas e com barra de topo', async () => {
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    expect(await screen.findByLabelText('Nome da rotina')).toBeOnTheScreen();
    expect(abas()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeOnTheScreen();
  });

  it('fechar sem mudanças volta para Treinar com as abas', async () => {
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));
    expect(await screen.findByRole('tab', { name: 'Treinar' })).toBeSelected();
    expect(abas()).toHaveLength(4);
  });

  it('voltar do Android no editor sem mudanças volta para Treinar; com mudanças pede descarte', async () => {
    await montar();
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    await screen.findByLabelText('Nome da rotina');
    await act(async () => {
      expect(voltarDoAndroid()).toBe(true);
    });
    expect(await screen.findByRole('tab', { name: 'Treinar' })).toBeOnTheScreen();

    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    await fireEvent.changeText(await screen.findByLabelText('Nome da rotina'), 'Rascunho');
    await act(async () => {
      expect(voltarDoAndroid()).toBe(true);
    });
    expect(await screen.findByRole('button', { name: 'Descartar' })).toBeOnTheScreen();
    expect(abas()).toHaveLength(0);
  });

  it('trocar de aba continua funcionando e a ordem das abas não muda (RNF-08)', async () => {
    await montar();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Progresso' }));
    expect(await screen.findByRole('tab', { name: 'Progresso' })).toBeSelected();
    expect(abas().map((t) => t.props.accessibilityLabel)).toEqual(['Treinar', 'Histórico', 'Progresso', 'Perfil']);
  });
});

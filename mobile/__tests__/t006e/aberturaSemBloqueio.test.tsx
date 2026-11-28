import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../../src/App';
import { purgeExpiredTombstones } from '../../src/db/purge';
import { seedCatalog } from '../../src/routines/repository';

// T-006e, bloqueante B1 (decisão do Atlas): o expurgo roda DEPOIS da primeira tela, fora do Promise.all da abertura.
// Se o expurgo demorar (ou nunca terminar), o app abre do mesmo jeito.
// T-003: quando houver sync, só expurgar após o servidor confirmar o tombstone (RN-21).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../src/db', () => {
  const { criarBancoDeTeste: criar } = require('../../test-utils/db') as typeof import('../../test-utils/db');
  const { schema } = require('../../src/db/schema') as typeof import('../../src/db/schema');
  const { migrations } = require('../../src/db/migrations') as typeof import('../../src/db/migrations');
  return { database: criar(), schema, migrations };
});
// o expurgo "trava": a promessa nunca resolve
jest.mock('../../src/db/purge', () => ({ purgeExpiredTombstones: jest.fn(() => new Promise(() => {})) }));

describe('abertura do app com expurgo lento', () => {
  beforeEach(() => {
    jest.mocked(purgeExpiredTombstones).mockClear();
  });

  it('a primeira tela (as 4 abas) aparece mesmo com o expurgo pendurado', async () => {
    const { database } = jest.requireMock('../../src/db') as { database: Database };
    await seedCatalog(database);
    await render(<App />);
    expect(await screen.findAllByRole('tab')).toHaveLength(4);
  });

  it('o expurgo é chamado (depois de abrir), com o banco do app', async () => {
    const { database } = jest.requireMock('../../src/db') as { database: Database };
    await render(<App />);
    await screen.findAllByRole('tab');
    await waitFor(() => expect(purgeExpiredTombstones).toHaveBeenCalledWith(database));
  });

  it('o expurgo só começa depois que a primeira tela está pronta (não participa da espera da abertura)', async () => {
    const ordem: string[] = [];
    jest.mocked(purgeExpiredTombstones).mockImplementationOnce((() => {
      ordem.push(screen.queryAllByRole('tab').length > 0 ? 'expurgo-depois-da-tela' : 'expurgo-antes-da-tela');
      return new Promise(() => {});
    }) as never);
    await render(<App />);
    await screen.findAllByRole('tab');
    await waitFor(() => expect(ordem).toHaveLength(1));
    expect(ordem).toEqual(['expurgo-depois-da-tela']);
  });
});

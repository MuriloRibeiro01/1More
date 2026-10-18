import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootTabs } from '../../src/navigation/RootTabs';
import { seedCatalog } from '../../src/routines/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-005 — bloqueantes do review do Sérgio, escritos vermelhos antes da correção (TDD).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

// O jest-expo roda como iOS, onde o BackHandler não faz nada. Este falso imita o Android:
// o último listener registrado é chamado primeiro e quem devolve true consome o evento.
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
function voltarDoAndroid(): boolean {
  for (const fn of [...listeners].reverse()) if (fn()) return true;
  return false;
}

type Coluna = { name: string; type: string; isOptional?: boolean; isIndexed?: boolean };

// Fixture literal da v2 publicada no T-005. Nunca atualize para acompanhar o schema: crie a v3.
const SYNC: Coluna[] = [
  { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
  { name: 'created_at', type: 'number' },
  { name: 'updated_at', type: 'number' },
  { name: 'server_version', type: 'number', isOptional: true },
  { name: 'deleted_at', type: 'number', isOptional: true },
];
const V2: Record<string, Coluna[]> = {
  exercise: [
    { name: 'name', type: 'string' },
    { name: 'tracking_type', type: 'string' },
    { name: 'primary_muscle', type: 'string', isOptional: true },
    { name: 'secondary_muscles', type: 'string' },
    { name: 'equipment_code', type: 'string', isOptional: true },
    ...SYNC,
  ],
  routine: [
    { name: 'name', type: 'string' },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'sort_order', type: 'number' },
    ...SYNC,
  ],
  routine_exercise: [
    { name: 'routine_id', type: 'string', isIndexed: true },
    { name: 'exercise_id', type: 'string', isIndexed: true },
    { name: 'sort_order', type: 'number' },
    { name: 'rest_seconds', type: 'number', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true },
    ...SYNC,
  ],
  routine_set: [
    { name: 'routine_exercise_id', type: 'string', isIndexed: true },
    { name: 'sort_order', type: 'number' },
    { name: 'set_type', type: 'string' },
    { name: 'reps_min', type: 'number', isOptional: true },
    { name: 'reps_max', type: 'number', isOptional: true },
    { name: 'target_weight_kg', type: 'number', isOptional: true },
    ...SYNC,
  ],
};

type Passo = { type: string; schema: { name: string; columnArray: Coluna[] } };
type Migrations = { sortedMigrations: { toVersion: number; steps: Passo[] }[] };
type TabelaSchema = { name: string; columnArray: Coluna[]; columns: Record<string, Coluna> };

/** Colunas do passo v2 como objetos simples (sem flags indefinidas/falsas), por tabela. */
function passoV2(migrations: Migrations): Record<string, Coluna[]> {
  const v2 = migrations.sortedMigrations.find((m) => m.toVersion === 2)!;
  expect(v2.steps.every((s) => s.type === 'create_table')).toBe(true);
  const limpa = (c: Coluna): Coluna => ({
    name: c.name,
    type: c.type,
    ...(c.isOptional ? { isOptional: true } : {}),
    ...(c.isIndexed ? { isIndexed: true } : {}),
  });
  return Object.fromEntries(v2.steps.map((s) => [s.schema.name, s.schema.columnArray.map(limpa)]));
}

describe('migração v2 congelada (review Sérgio, bloqueante 1)', () => {
  it('o passo toVersion 2 cria exatamente as 4 tabelas com as colunas publicadas', () => {
    const { migrations } = jest.requireActual<{ migrations: Migrations }>('../../src/db/migrations');
    expect(passoV2(migrations)).toEqual(V2);
  });

  it('mudar o schema (coluna nova ou coluna alterada) não altera o passo v2', () => {
    jest.isolateModules(() => {
      const schemaMod = jest.requireActual<Record<string, unknown>>('../../src/db/schema');
      const tabelas = Object.values(schemaMod).filter(
        (v): v is TabelaSchema => !!v && typeof v === 'object' && Array.isArray((v as TabelaSchema).columnArray),
      );
      expect(tabelas.map((t) => t.name).sort()).toEqual(Object.keys(V2).sort());
      for (const t of tabelas) {
        // Simula a v3 mexendo no schema: coluna nova e uma coluna existente alterada no lugar.
        const nova = { name: 'coluna_da_v3', type: 'string' };
        t.columnArray.push(nova);
        t.columns.coluna_da_v3 = nova;
        t.columnArray[0].type = 'boolean';
      }
      const { migrations } = jest.requireActual<{ migrations: Migrations }>('../../src/db/migrations');
      expect(passoV2(migrations)).toEqual(V2);
    });
  });
});

describe('voltar do Android só vale com a aba Treinar em foco (review Sérgio, bloqueante 2)', () => {
  let db: Database;

  beforeAll(() => i18n.changeLanguage('pt-BR'));
  beforeEach(async () => {
    listeners.length = 0;
    db = criarBancoDeTeste();
    await seedCatalog(db);
  });

  async function abrirEditorComMudanca() {
    await renderComTema(
      <DatabaseProvider database={db}>
        <NavigationContainer>
          <RootTabs />
        </NavigationContainer>
      </DatabaseProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    await fireEvent.changeText(await screen.findByLabelText('Nome da rotina'), 'Rascunho');
  }

  it('controle: com Treinar em foco, voltar pede confirmação de descarte', async () => {
    await abrirEditorComMudanca();
    await act(async () => {
      expect(voltarDoAndroid()).toBe(true);
    });
    expect(await screen.findByRole('button', { name: 'Descartar' })).toBeOnTheScreen();
  });

  it('em Histórico, voltar não abre o Sheet do editor e o editor continua aberto ao voltar para Treinar', async () => {
    await abrirEditorComMudanca();
    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }));
    expect(await screen.findByRole('header', { name: 'Histórico' })).toBeOnTheScreen();

    await act(async () => {
      voltarDoAndroid();
    });
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();

    // O voltar pode ter levado a navegação de volta para Treinar; se não, vamos até lá.
    if (!screen.getByRole('tab', { name: 'Treinar' }).props.accessibilityState?.selected) {
      await fireEvent.press(screen.getByRole('tab', { name: 'Treinar' }));
    }
    expect((await screen.findByLabelText('Nome da rotina')).props.value).toBe('Rascunho');
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
  });
});

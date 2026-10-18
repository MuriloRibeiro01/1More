import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, screen, within } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootTabs } from '../../src/navigation/RootTabs';
import { listCatalog, listRoutines, loadRoutine, saveRoutine, seedCatalog } from '../../src/routines/repository';
import type { ThemePreference } from '../../src/theme';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-005 — fluxo da planilha pelas telas (contrato em __tests__/t005/CONTRATO.md).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

let db: Database;

function montarApp(preference: ThemePreference = 'light') {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
    </DatabaseProvider>,
    preference,
  );
}

const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });

async function exercicio(i: number) {
  const container = await screen.findByTestId(`exercicio-${i}`);
  const cabecalho = within(container).getAllByRole('button')[0];
  if (cabecalho.props.accessibilityState?.expanded === false) await fireEvent.press(cabecalho);
  return within(await screen.findByTestId(`exercicio-${i}`));
}

async function adicionarExercicios(nomes: string[]) {
  await fireEvent.press(await botao('Adicionar exercício'));
  for (const nome of nomes) await fireEvent.press(await screen.findByRole('checkbox', { name: nome }));
  const rotulo = nomes.length === 1 ? 'Adicionar 1 exercício' : `Adicionar ${nomes.length} exercícios`;
  await fireEvent.press(await botao(rotulo));
}

async function novaRotina(nome: string, exercicios: string[]) {
  await fireEvent.press(await botao('Nova rotina'));
  if (nome) await fireEvent.changeText(await screen.findByLabelText('Nome da rotina'), nome);
  if (exercicios.length) await adicionarExercicios(exercicios);
}

const valor = (el: { props: { accessibilityValue?: { text?: string } } }) => el.props.accessibilityValue?.text;

function texto(no: unknown): string {
  if (typeof no === 'string') return no;
  const n = no as { children?: unknown[] } | null;
  return (n?.children ?? []).map(texto).join(' ');
}
const alertas = () => screen.queryAllByRole('alert').map(texto).join(' | ');

function alvoMinimo(el: { props: { style?: unknown } }) {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minHeight ?? 0, s?.height ?? 0);
}
function conferirAlvos() {
  const pequenos = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('checkbox')]
    .filter((el) => alvoMinimo(el) < 48)
    .map((el) => el.props.accessibilityLabel ?? texto(el));
  expect(pequenos).toEqual([]);
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
});

describe('aba Treinar', () => {
  it('sem rotinas mostra EmptyState e "Nova rotina", sem "Começar"', async () => {
    await montarApp();
    expect(await screen.findByTestId('rotinas-vazio')).toBeOnTheScreen();
    expect(await botao('Nova rotina')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /começar/i })).toBeNull();
  });

  it('lista as rotinas salvas com nome e exercícios', async () => {
    const [primeiro] = await listCatalog(db);
    await saveRoutine(db, {
      name: 'Treino B — Costas',
      exercises: [{ exerciseId: primeiro.id, sets: 3, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }],
    });
    await montarApp();
    expect(await botao(/Treino B — Costas/)).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(primeiro.name))).toBeOnTheScreen();
    expect(screen.queryByTestId('rotinas-vazio')).toBeNull();
  });
});

describe('criar rotina', () => {
  it('busca, adiciona 2 exercícios com padrões 3 séries / 1:30, salva e reabre igual', async () => {
    const montado = await montarApp();
    await fireEvent.press(await botao('Nova rotina'));
    await fireEvent.changeText(await screen.findByLabelText('Nome da rotina'), 'Treino A — Peito');

    await fireEvent.press(await botao('Adicionar exercício'));
    await fireEvent.changeText(await screen.findByLabelText('Buscar exercício'), 'agach');
    expect(await screen.findByRole('checkbox', { name: 'Agachamento livre' })).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Supino reto com barra' })).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Agachamento livre' }));
    expect(screen.getByRole('checkbox', { name: 'Agachamento livre' })).toBeChecked();

    await fireEvent.changeText(screen.getByLabelText('Buscar exercício'), 'supino reto');
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Supino reto com barra' }));
    conferirAlvos();
    await fireEvent.press(await botao('Adicionar 2 exercícios'));

    const ex0 = await exercicio(0);
    expect(valor(ex0.getByRole('adjustable', { name: 'Séries' }))).toBe('3');
    expect(valor(ex0.getByRole('adjustable', { name: 'Descanso' }))).toBe('1:30');
    await fireEvent.press(ex0.getByRole('button', { name: 'Aumentar séries' }));
    await fireEvent.press(ex0.getByRole('button', { name: 'Aumentar descanso' }));
    await fireEvent.changeText(ex0.getByLabelText('Carga alvo (kg)'), '82,5');
    await fireEvent.changeText(ex0.getByLabelText('Repetições mínimas'), '8');
    await fireEvent.changeText(ex0.getByLabelText('Repetições máximas'), '12');
    expect(valor(ex0.getByRole('adjustable', { name: 'Séries' }))).toBe('4');
    expect(valor(ex0.getByRole('adjustable', { name: 'Descanso' }))).toBe('1:45');

    const ex1 = await exercicio(1);
    expect(valor(ex1.getByRole('adjustable', { name: 'Séries' }))).toBe('3');
    expect(valor(ex1.getByRole('adjustable', { name: 'Descanso' }))).toBe('1:30');
    conferirAlvos();

    await fireEvent.press(await botao('Salvar'));
    expect(await botao(/Treino A — Peito/)).toBeOnTheScreen();

    const [salva] = await listRoutines(db);
    expect(salva.exerciseNames).toHaveLength(2);
    const draft = await loadRoutine(db, salva.id);
    expect(draft.exercises[0]).toMatchObject({ sets: 4, weightKg: 82.5, repsMin: 8, repsMax: 12, restSeconds: 105 });
    expect(draft.exercises[1]).toMatchObject({ sets: 3, weightKg: null, restSeconds: 90 });

    // "Fecho e reabro o app": desmonta tudo e monta de novo sobre o mesmo banco.
    await montado.unmount();
    await montarApp();
    await fireEvent.press(await botao(/Treino A — Peito/));
    expect(screen.getByLabelText('Nome da rotina').props.value).toBe('Treino A — Peito');
    const reaberto = await exercicio(0);
    expect(valor(reaberto.getByRole('adjustable', { name: 'Séries' }))).toBe('4');
    expect(valor(reaberto.getByRole('adjustable', { name: 'Descanso' }))).toBe('1:45');
    expect(reaberto.getByLabelText('Carga alvo (kg)').props.value).toBe('82,5');
    expect(reaberto.getByLabelText('Repetições mínimas').props.value).toBe('8');
    expect(reaberto.getByLabelText('Repetições máximas').props.value).toBe('12');
  });

  it('steppers respeitam os limites: séries 1..10, descanso 0:00..10:00', async () => {
    await montarApp();
    await novaRotina('Limites', ['Agachamento livre']);
    const ex0 = await exercicio(0);
    for (let i = 0; i < 5; i++) await fireEvent.press(ex0.getByRole('button', { name: 'Diminuir séries' }));
    expect(valor(ex0.getByRole('adjustable', { name: 'Séries' }))).toBe('1');
    for (let i = 0; i < 12; i++) await fireEvent.press(ex0.getByRole('button', { name: 'Aumentar séries' }));
    expect(valor(ex0.getByRole('adjustable', { name: 'Séries' }))).toBe('10');
    for (let i = 0; i < 8; i++) await fireEvent.press(ex0.getByRole('button', { name: 'Diminuir descanso' }));
    expect(valor(ex0.getByRole('adjustable', { name: 'Descanso' }))).toBe('0:00');
    for (let i = 0; i < 45; i++) await fireEvent.press(ex0.getByRole('button', { name: 'Aumentar descanso' }));
    expect(valor(ex0.getByRole('adjustable', { name: 'Descanso' }))).toBe('10:00');
  });

  it('remover e mover exercício', async () => {
    await montarApp();
    await novaRotina('Ordem', ['Agachamento livre', 'Supino reto com barra', 'Rosca direta']);
    await fireEvent.press((await exercicio(0)).getByRole('button', { name: 'Remover exercício' }));
    await fireEvent.press((await exercicio(1)).getByRole('button', { name: 'Mover para cima' }));
    await fireEvent.press(await botao('Salvar'));
    await botao(/Ordem/);

    const [salva] = await listRoutines(db);
    expect(salva.exerciseNames).toEqual(['Rosca direta', 'Supino reto com barra']);
  });
});

describe('validação na tela', () => {
  it('sem nome e sem exercício não salva e diz os motivos', async () => {
    await montarApp();
    await fireEvent.press(await botao('Nova rotina'));
    await fireEvent.press(await botao('Salvar'));
    expect(alertas()).toMatch(/nome/i);
    expect(alertas()).toMatch(/exercício/i);
    expect(await listRoutines(db)).toEqual([]);
  });

  it('com nome mas sem exercício diz que falta exercício', async () => {
    await montarApp();
    await novaRotina('Só nome', []);
    await fireEvent.press(await botao('Salvar'));
    expect(alertas()).toMatch(/exercício/i);
    expect(alertas()).not.toMatch(/nome/i);
    expect(await listRoutines(db)).toEqual([]);
  });

  it.each(['-5', 'abc'])('carga %p não salva e diz que a carga é inválida', async (carga) => {
    await montarApp();
    await novaRotina('Carga ruim', ['Agachamento livre']);
    await fireEvent.changeText((await exercicio(0)).getByLabelText('Carga alvo (kg)'), carga);
    await fireEvent.press(await botao('Salvar'));
    expect(alertas()).toMatch(/carga/i);
    expect(await listRoutines(db)).toEqual([]);
  });
});

describe('fechar e excluir com Sheet', () => {
  it('fechar sem mudanças volta direto; com mudanças pede confirmação e Descartar não salva', async () => {
    await montarApp();
    await fireEvent.press(await botao('Nova rotina'));
    await fireEvent.press(await botao('Fechar'));
    expect(await screen.findByTestId('rotinas-vazio')).toBeOnTheScreen();

    await novaRotina('Rascunho', ['Agachamento livre']);
    await fireEvent.press(await botao('Fechar'));
    await fireEvent.press(await botao('Descartar'));
    expect(await screen.findByTestId('rotinas-vazio')).toBeOnTheScreen();
    expect(await listRoutines(db)).toEqual([]);
  });

  it('excluir rotina confirma no Sheet, some da lista e fica com deleted_at', async () => {
    const [primeiro] = await listCatalog(db);
    const id = await saveRoutine(db, {
      name: 'Apagar',
      exercises: [{ exerciseId: primeiro.id, sets: 3, weightKg: null, repsMin: null, repsMax: null, restSeconds: 90 }],
    });
    await montarApp();
    await fireEvent.press(await botao(/Apagar/));
    await fireEvent.press(await botao('Excluir rotina'));
    await fireEvent.press(await botao('Excluir'));

    expect(await screen.findByTestId('rotinas-vazio')).toBeOnTheScreen();
    const raw = (await db.get('routine').find(id))._raw as unknown as Record<string, unknown>;
    expect(raw.deleted_at).toEqual(expect.any(Number));
  });
});

describe('offline e tema', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('fluxo completo no tema Noite sem nenhuma chamada de rede (RNF-01)', async () => {
    const fetchSpy = jest.fn(() => Promise.reject(new Error('sem rede')));
    global.fetch = fetchSpy as unknown as typeof fetch;
    // O ambiente do jest não tem XMLHttpRequest: instala um falso que registra qualquer abertura.
    const xhrSpy = jest.fn();
    const xhrOriginal = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = class { open = xhrSpy; send() {} };

    await montarApp('dark');
    await novaRotina('Modo avião', ['Supino reto com barra']);
    await fireEvent.press(await botao('Salvar'));
    expect(await botao(/Modo avião/)).toBeOnTheScreen();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = xhrOriginal;
    expect(await listRoutines(db)).toHaveLength(1);
  });
});

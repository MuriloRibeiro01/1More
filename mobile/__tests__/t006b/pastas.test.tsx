import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { listCatalog, listRoutines, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006b, item 3 (C37, RF-24): pastas de rotinas (ex.: "Divisão ABC"). Criar, renomear, excluir pasta e mover rotina entre pastas;
// excluir pasta NÃO apaga as rotinas (vão para "Sem pasta"). Depende da migração v6 (routine_folder + routine.folder_id).
// Contrato de interface (para o Prisma), na aba Treinar em "Editar rotinas" e no editor:
//  - Treinar (modo editar): botão "Nova pasta" → folha com campo "Nome da pasta" e botão "Criar pasta".
//  - cada pasta vira um cabeçalho (role header) com o nome, e tem o botão "Opções da pasta <nome>" → folha com
//    "Renomear pasta" (campo "Nome da pasta" + "Salvar pasta") e "Excluir pasta" (folha de confirmação com "Excluir").
//  - editor da rotina: botão "Pasta: <nome ou Sem pasta>" → folha com um botão por pasta e "Sem pasta"; a escolha vale ao "Salvar".
//  - nome de pasta vazio ou repetido: nada é gravado e um aviso (role alert) com o motivo aparece.
//  - exclusão lógica (deleted_at); colunas de sync em routine_folder.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const PASTA = 'Divisão ABC';
let db: Database;

const montar = () =>
  renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>,
  );
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const linhas = async (tabela: string) =>
  (await db.get<Model>(tabela).query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);
const alvo = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minHeight ?? 0, s?.height ?? 0);
};

async function criarRotinas() {
  const [ex] = await listCatalog(db);
  const exercicio = { exerciseId: ex.id, sets: 2, weightKg: 40, repsMin: null, repsMax: 10, restSeconds: 90 };
  await saveRoutine(db, { name: 'Treino A — Peito', exercises: [exercicio] });
  await saveRoutine(db, { name: 'Treino B — Costas', exercises: [exercicio] });
}
async function modoEditar() {
  await fireEvent.press(await botao('Editar rotinas'));
}
async function novaPasta(nome = PASTA) {
  await fireEvent.press(await botao('Nova pasta'));
  await fireEvent.changeText(await screen.findByLabelText('Nome da pasta'), nome);
  await fireEvent.press(await botao('Criar pasta'));
}
async function moverRotinaPara(rotina: RegExp, pasta: string) {
  await fireEvent.press(await botao(rotina));
  await screen.findByLabelText('Nome da rotina');
  await fireEvent.press(await botao(/^Pasta:/));
  await fireEvent.press(await botao(pasta));
  await fireEvent.press(await botao('Salvar'));
}
const rotinaPorNome = async (nome: string) => (await linhas('routine')).find((r) => r.name === nome)!;

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  await criarRotinas();
});

describe('criar pasta', () => {
  it('"Nova pasta" grava em routine_folder (nome, sort_order, colunas de sync) e mostra o cabeçalho', async () => {
    await montar();
    await modoEditar();
    await novaPasta();
    expect(await screen.findByRole('header', { name: PASTA })).toBeOnTheScreen();
    const [pasta] = await linhas('routine_folder');
    expect(pasta).toMatchObject({ name: PASTA, user_id: null, server_version: null, deleted_at: null });
    expect(typeof pasta.sort_order).toBe('number');
    expect(typeof pasta.created_at).toBe('number');
    expect(pasta.updated_at).toBe(pasta.created_at);
  });

  it('nome vazio, só espaços ou repetido (sem diferenciar maiúsculas): recusa com aviso e não grava', async () => {
    await montar();
    await modoEditar();
    await novaPasta('   ');
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await linhas('routine_folder')).toEqual([]);
  });

  it('nome repetido é recusado', async () => {
    await montar();
    await modoEditar();
    await novaPasta();
    await novaPasta(PASTA.toUpperCase());
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await linhas('routine_folder')).toHaveLength(1);
  });

  it('os controles de pasta têm alvo ≥ 48 dp', async () => {
    await montar();
    await modoEditar();
    expect(alvo(await botao('Nova pasta'))).toBeGreaterThanOrEqual(48);
    await novaPasta();
    expect(alvo(await botao(`Opções da pasta ${PASTA}`))).toBeGreaterThanOrEqual(48);
  });
});

describe('mover rotina entre pastas', () => {
  it('pelo editor: a rotina ganha folder_id da pasta; as demais continuam sem pasta', async () => {
    await montar();
    await modoEditar();
    await novaPasta();
    await moverRotinaPara(/Treino B — Costas/, PASTA);
    const [pasta] = await linhas('routine_folder');
    expect((await rotinaPorNome('Treino B — Costas')).folder_id).toBe(pasta.id);
    expect((await rotinaPorNome('Treino A — Peito')).folder_id ?? null).toBeNull();
  });

  it('mover para outra pasta e de volta para "Sem pasta"', async () => {
    await montar();
    await modoEditar();
    await novaPasta('Divisão ABC');
    await novaPasta('Divisão PPL');
    await moverRotinaPara(/Treino A — Peito/, 'Divisão ABC');
    await moverRotinaPara(/Treino A — Peito/, 'Divisão PPL');
    const pastas = await linhas('routine_folder');
    const ppl = pastas.find((p) => p.name === 'Divisão PPL')!;
    expect((await rotinaPorNome('Treino A — Peito')).folder_id).toBe(ppl.id);
    await moverRotinaPara(/Treino A — Peito/, 'Sem pasta');
    expect((await rotinaPorNome('Treino A — Peito')).folder_id ?? null).toBeNull();
  });

  it('mover não altera nome, exercícios nem a ordem das rotinas', async () => {
    await montar();
    await modoEditar();
    await novaPasta();
    const antes = await listRoutines(db);
    await moverRotinaPara(/Treino B — Costas/, PASTA);
    expect(await listRoutines(db)).toEqual(antes);
  });
});

describe('renomear e excluir pasta', () => {
  it('renomear mantém a mesma pasta (id) e as rotinas dentro dela', async () => {
    await montar();
    await modoEditar();
    await novaPasta();
    await moverRotinaPara(/Treino B — Costas/, PASTA);
    const [antes] = await linhas('routine_folder');
    await fireEvent.press(await botao(`Opções da pasta ${PASTA}`));
    await fireEvent.press(await botao('Renomear pasta'));
    await fireEvent.changeText(await screen.findByLabelText('Nome da pasta'), 'Divisão ABCD');
    await fireEvent.press(await botao('Salvar pasta'));
    expect(await screen.findByRole('header', { name: 'Divisão ABCD' })).toBeOnTheScreen();
    const [depois] = await linhas('routine_folder');
    expect(depois).toMatchObject({ id: antes.id, name: 'Divisão ABCD' });
    expect((await rotinaPorNome('Treino B — Costas')).folder_id).toBe(antes.id);
  });

  it('excluir a pasta faz tombstone e NÃO apaga as rotinas: elas vão para "Sem pasta" e seguem na lista', async () => {
    await montar();
    await modoEditar();
    await novaPasta();
    await moverRotinaPara(/Treino B — Costas/, PASTA);
    await fireEvent.press(await botao(`Opções da pasta ${PASTA}`));
    await fireEvent.press(await botao('Excluir pasta'));
    await fireEvent.press(await botao('Excluir'));
    expect(screen.queryByRole('header', { name: PASTA })).toBeNull();

    const [pasta] = await linhas('routine_folder');
    expect(pasta.deleted_at).toEqual(expect.any(Number));
    const rotina = await rotinaPorNome('Treino B — Costas');
    expect(rotina.deleted_at).toBeNull();
    expect(rotina.folder_id ?? null).toBeNull();
    expect((await listRoutines(db)).map((r) => r.name)).toEqual(['Treino A — Peito', 'Treino B — Costas']);
    expect((await linhas('routine_exercise')).every((e) => e.deleted_at === null)).toBe(true);
    expect(await screen.findByRole('button', { name: /Treino B — Costas/ })).toBeOnTheScreen();
  });

  it('cancelar a exclusão mantém a pasta', async () => {
    await montar();
    await modoEditar();
    await novaPasta();
    await fireEvent.press(await botao(`Opções da pasta ${PASTA}`));
    await fireEvent.press(await botao('Excluir pasta'));
    await fireEvent.press(await botao('Cancelar'));
    expect((await linhas('routine_folder'))[0].deleted_at).toBeNull();
    expect(screen.getByRole('header', { name: PASTA })).toBeOnTheScreen();
  });
});

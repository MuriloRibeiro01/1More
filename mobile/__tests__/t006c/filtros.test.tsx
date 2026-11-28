import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { ExercisePickerRoute, RootNavigator, type RootStackParamList } from '../../src/navigation/RootNavigator';
import { listCatalog, seedCatalog } from '../../src/routines/repository';
import { startWorkout } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// T-006c, item 1 (C22, RF-11): filtros ESCRITOS por músculo e equipamento no seletor de exercícios
// ("Todos · Peito · Costas…", o sublinhado marca o ativo), combinados com a busca por nome sem acento.
// Contrato de interface (para o Prisma):
//  - linha de músculos: botões "Todos" + um por músculo primário PRESENTE no catálogo, com o nome de `progress.muscles`
//    (Peito, Costas, Quadríceps, Posteriores, Ombros, Bíceps, Tríceps, Panturrilha, Abdômen…); o ativo fica `selected`; "Todos" começa ativo.
//  - linha de equipamentos: botões "Qualquer equipamento" + Barra, Halteres, Polia, Máquina, Peso corporal; mesmo estado `selected`.
//  - os dois filtros e a busca se combinam (E). Os marcados continuam marcados ao trocar de filtro.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const Stack = createNativeStackNavigator<RootStackParamList & { Home: undefined }>();
let db: Database;
let nomes: string[];
let workoutId: string;

function montarPicker() {
  return renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer initialState={{ routes: [{ name: 'Home' }, { name: 'ExercisePicker', params: { workoutId } }] }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={() => <Text>HOME</Text>} />
          <Stack.Screen name="ExercisePicker" component={ExercisePickerRoute as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
}

const filtro = (nome: string) => screen.findByRole('button', { name: nome });
const visiveis = () => screen.queryAllByRole('checkbox').map((c) => String(c.props.accessibilityLabel ?? c.props['aria-label']));
const alvo = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minHeight ?? 0, s?.height ?? 0);
};
const SO_PEITO = ['Supino inclinado com halteres', 'Supino reto com barra'];

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = criarBancoDeTeste();
  await seedCatalog(db);
  nomes = (await listCatalog(db)).map((e) => e.name);
  workoutId = await startWorkout(db, { name: 'Livre', now: Date.now() });
});

describe('filtros por músculo', () => {
  it('mostra "Todos" (ativo) e um filtro por músculo do catálogo; músculo sem exercício não aparece', async () => {
    await montarPicker();
    expect(await filtro('Todos')).toBeSelected();
    for (const m of ['Peito', 'Costas', 'Quadríceps', 'Ombros', 'Bíceps']) {
      expect(screen.getByRole('button', { name: m })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: m })).not.toBeSelected();
    }
    expect(screen.queryByRole('button', { name: 'Glúteos' })).toBeNull();
  });

  it('"Todos" lista o catálogo inteiro', async () => {
    await montarPicker();
    await filtro('Todos');
    expect(visiveis().sort()).toEqual([...nomes].sort());
  });

  it('filtrar por "Peito" mostra só exercícios de peito e marca o filtro', async () => {
    await montarPicker();
    await fireEvent.press(await filtro('Peito'));
    expect(visiveis().sort()).toEqual(SO_PEITO);
    expect(screen.getByRole('button', { name: 'Peito' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Todos' })).not.toBeSelected();
  });

  it('voltar para "Todos" mostra tudo de novo', async () => {
    await montarPicker();
    await fireEvent.press(await filtro('Peito'));
    await fireEvent.press(screen.getByRole('button', { name: 'Todos' }));
    expect(visiveis()).toHaveLength(nomes.length);
  });

  it('a busca "sup" continua achando "Supino" dentro do filtro e some fora dele', async () => {
    await montarPicker();
    await fireEvent.changeText(await screen.findByLabelText('Buscar exercício'), 'sup');
    await fireEvent.press(await filtro('Peito'));
    expect(visiveis().sort()).toEqual(SO_PEITO);
    await fireEvent.press(screen.getByRole('button', { name: 'Costas' }));
    expect(visiveis()).toEqual([]);
    expect(screen.getByText('Nenhum exercício com esse nome.')).toBeOnTheScreen();
  });

  it('a busca continua ignorando acentos com filtro ativo ("triceps" acha "Tríceps na polia")', async () => {
    await montarPicker();
    await fireEvent.press(await filtro('Tríceps'));
    await fireEvent.changeText(screen.getByLabelText('Buscar exercício'), 'triceps');
    expect(visiveis()).toEqual(['Tríceps na polia']);
  });
});

describe('filtros por equipamento', () => {
  it('"Qualquer equipamento" começa ativo; "Halteres" mostra só exercícios com halteres', async () => {
    await montarPicker();
    expect(await filtro('Qualquer equipamento')).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Halteres' }));
    expect(visiveis().sort()).toEqual(['Elevação lateral', 'Supino inclinado com halteres']);
    expect(screen.getByRole('button', { name: 'Halteres' })).toBeSelected();
  });

  it('músculo e equipamento se combinam: Peito + Halteres = só o supino inclinado', async () => {
    await montarPicker();
    await fireEvent.press(await filtro('Peito'));
    await fireEvent.press(screen.getByRole('button', { name: 'Halteres' }));
    expect(visiveis()).toEqual(['Supino inclinado com halteres']);
  });

  it('"Qualquer equipamento" limpa só o equipamento e mantém o músculo', async () => {
    await montarPicker();
    await fireEvent.press(await filtro('Peito'));
    await fireEvent.press(screen.getByRole('button', { name: 'Halteres' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Qualquer equipamento' }));
    expect(visiveis().sort()).toEqual(SO_PEITO);
  });
});

describe('seleção e acessibilidade', () => {
  it('o que foi marcado continua marcado ao trocar de filtro e entra na contagem de "Adicionar N exercícios"', async () => {
    await montarPicker();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Supino reto com barra' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Costas' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Puxada frontal' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Peito' }));
    expect(await screen.findByRole('checkbox', { name: 'Supino reto com barra' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Adicionar 2 exercícios' })).toBeOnTheScreen();
  });

  it('todos os filtros têm alvo de toque ≥ 48 dp', async () => {
    await montarPicker();
    const botoes = ['Todos', 'Peito', 'Costas', 'Qualquer equipamento', 'Halteres'];
    for (const nome of botoes) expect(alvo(await filtro(nome))).toBeGreaterThanOrEqual(48);
  });

  it('a mesma tela, aberta pelo editor de rotina, também tem os filtros', async () => {
    await renderComTema(
      <DatabaseProvider database={db}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </DatabaseProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Nova rotina' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Adicionar exercício' }));
    expect(await filtro('Peito')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Halteres' })).toBeOnTheScreen();
  });
});

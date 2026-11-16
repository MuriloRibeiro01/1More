import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text } from 'react-native';
import type { Database, Model } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer, type RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, screen, within } from '@testing-library/react-native';
import i18n from '../../src/i18n';
import { HistoryScreen } from '../../src/screens/HistoryScreen';
import { listCatalog, saveRoutine, seedCatalog } from '../../src/routines/repository';
import { finishWorkout, loadWorkout, startWorkout, updateSet } from '../../src/workout/repository';
import { criarBancoDeTeste } from '../../test-utils/db';
import { renderComTema } from '../../test-utils/render';

// Fase 7 — aba Histórico (protótipo "HISTORICO.DC.HTML"): lista por semana, mês e treino retroativo.
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

type Params = { History: undefined; WorkoutDetail: { workoutId: string; edit?: boolean; isNew?: boolean } };
const Stack = createNativeStackNavigator<Params>();
const Detalhe = ({ route }: { route: RouteProp<Params, 'WorkoutDetail'> }) => <Text testID="detalhe">{JSON.stringify(route.params)}</Text>;

const min = (n: number) => n * 60_000;
const DIA = 86_400_000;

let db: Database;
let rotinaId: string;

const montar = () =>
  renderComTema(
    <DatabaseProvider database={db}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="WorkoutDetail" component={Detalhe as never} />
        </Stack.Navigator>
      </NavigationContainer>
    </DatabaseProvider>,
  );
const botao = (nome: string | RegExp) => screen.findByRole('button', { name: nome });
const aberto = () => JSON.parse((screen.getByTestId('detalhe').children as string[]).join('')) as Params['WorkoutDetail'];
const alvo = (el: { props: { style?: unknown } }) => {
  const s = StyleSheet.flatten(el.props.style as never) as Record<string, number> | undefined;
  return Math.max(s?.minHeight ?? 0, s?.height ?? 0);
};
const workouts = async () => (await db.get<Model>('workout').query().fetch()).map((m) => m._raw as unknown as Record<string, unknown>);

async function feito(inicio: number, name = 'Treino A') {
  const id = await startWorkout(db, { routineId: rotinaId, name, now: inicio });
  const w = await loadWorkout(db, id);
  await updateSet(db, w.exercises[0].sets[0].id, { weightKg: 60, reps: 10, completed: true }, inicio + min(10));
  await updateSet(db, w.exercises[0].sets[1].id, { weightKg: 62.5, reps: 8, completed: true }, inicio + min(25));
  await finishWorkout(db, id, { pending: 'discard', now: inicio + min(40) });
  return id;
}

beforeAll(() => i18n.changeLanguage('pt-BR'));
beforeEach(async () => {
  db = criarBancoDeTeste();
  await seedCatalog(db);
  const supino = (await listCatalog(db)).find((e) => e.name === 'Supino reto com barra')!.id;
  rotinaId = await saveRoutine(db, {
    name: 'Treino A',
    exercises: [{ exerciseId: supino, sets: 3, weightKg: 60, repsMin: null, repsMax: 10, restSeconds: 90 }],
  });
});

describe('estado vazio e título', () => {
  it('título é header "Histórico"; sem treinos mostra o convite e o atalho de registrar', async () => {
    await montar();
    expect(await screen.findByRole('header', { name: 'Histórico' })).toBeOnTheScreen();
    expect(await screen.findByRole('header', { name: 'Nenhum treino ainda' })).toBeOnTheScreen();
    expect(screen.getByText('Os treinos que você finalizar ficam aqui.')).toBeOnTheScreen();
    expect(await botao('Registrar treino passado')).toBeOnTheScreen();
  });
});

describe('lista por semana', () => {
  it('seções "Esta semana", "Semana passada" e o intervalo; só treinos com série concluída', async () => {
    const agora = Date.now();
    await feito(agora - min(2), 'Hoje A');
    await feito(agora - 7 * DIA, 'Passada B');
    await feito(agora - 21 * DIA, 'Antiga C');
    await montar();
    expect(await screen.findByText('Esta semana')).toBeOnTheScreen();
    expect(screen.getByText('Semana passada')).toBeOnTheScreen();
    expect(screen.getByText(/^\d{1,2}(–\d{1,2} | \S+ – \d{1,2} )\S+$/)).toBeOnTheScreen(); // "9–15 nov" / "26 out – 1 nov"
    expect(screen.getByRole('button', { name: /Hoje A/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Passada B/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Antiga C/ })).toBeOnTheScreen();
  });

  it('linha: data na margem, nome e a lápis duração · séries · volume; rótulo falado completo', async () => {
    const inicio = Date.now() - min(2);
    await feito(inicio);
    await montar();
    const linha = await botao(/Treino A/);
    const dia = new Date(inicio);
    expect(within(linha).getByText(String(dia.getDate()))).toBeOnTheScreen();
    expect(within(linha).getByText('Treino A')).toBeOnTheScreen();
    expect(within(linha).getByText('25 min · 2 séries · 1.100 kg')).toBeOnTheScreen();
    const data = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dia);
    expect(linha.props.accessibilityLabel).toBe(`${data}, Treino A, 25 min`);
    expect(alvo(linha)).toBeGreaterThanOrEqual(48);
  });

  it('treino sem nome aparece como "Treino livre"', async () => {
    await feito(Date.now() - min(2), '');
    await montar();
    expect(await botao(/Treino livre/)).toBeOnTheScreen();
  });

  it('tocar abre o treino passado', async () => {
    const id = await feito(Date.now() - min(2));
    await montar();
    await fireEvent.press(await botao(/Treino A/));
    expect(aberto()).toEqual({ workoutId: id });
  });

  it('treino retroativo ainda vazio e treino ativo não aparecem', async () => {
    await startWorkout(db, { name: 'Ativo', now: Date.now() });
    await montar();
    expect(await screen.findByRole('header', { name: 'Nenhum treino ainda' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Ativo/ })).toBeNull();
  });
});

describe('visão Lista | Mês', () => {
  it('alternância escrita com estado selecionado e alvo ≥ 48dp; Lista é a padrão', async () => {
    await feito(Date.now() - min(2));
    await montar();
    const lista = await botao('Lista');
    const mes = screen.getByRole('button', { name: 'Mês' });
    expect(lista).toBeSelected();
    expect(mes).not.toBeSelected();
    expect(alvo(lista)).toBeGreaterThanOrEqual(48);
    await fireEvent.press(mes);
    expect(screen.getByRole('button', { name: 'Mês' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Lista' })).not.toBeSelected();
  });

  async function abrirMes() {
    await fireEvent.press(await botao('Mês'));
  }
  const tituloMes = (d: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);

  it('mostra o mês atual, o dia treinado marcado e hoje grifado', async () => {
    const inicio = Date.now() - min(2);
    await feito(inicio);
    await montar();
    await abrirMes();
    expect(await screen.findByText(tituloMes(new Date(inicio)))).toBeOnTheScreen();
    const key = new Date(inicio);
    const cel = screen.getByTestId(`mes-dia-${key.getFullYear()}-${String(key.getMonth() + 1).padStart(2, '0')}-${String(key.getDate()).padStart(2, '0')}`);
    expect(cel.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('mes-treinado')).toBeOnTheScreen();
    expect(screen.getByTestId('mes-hoje', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('tocar o dia treinado abre o treino; dia sem treino não faz nada', async () => {
    const id = await feito(Date.now() - min(2));
    await montar();
    await abrirMes();
    await fireEvent.press(await screen.findByRole('button', { name: /Treino A/ }));
    expect(aberto()).toEqual({ workoutId: id });
  });

  it('dia sem treino não é tocável', async () => {
    await feito(Date.now() - min(2));
    await montar();
    await abrirMes();
    await screen.findByTestId('mes-treinado');
    const hoje = new Date();
    const outro = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() === 1 ? 2 : 1);
    const key = `${outro.getFullYear()}-${String(outro.getMonth() + 1).padStart(2, '0')}-${String(outro.getDate()).padStart(2, '0')}`;
    await fireEvent.press(screen.getByTestId(`mes-dia-${key}`));
    expect(screen.queryByTestId('detalhe')).toBeNull();
  });

  it('dois treinos no mesmo dia: o toque abre o mais recente e o rótulo lista os dois', async () => {
    const agora = Date.now();
    await feito(agora - min(30), 'Manhã');
    const recente = await feito(agora - min(2), 'Noite');
    await montar();
    await abrirMes();
    const cel = await screen.findByRole('button', { name: /Manhã.*Noite|Noite.*Manhã/ });
    await fireEvent.press(cel);
    expect(aberto()).toEqual({ workoutId: recente });
  });

  it('setas navegam entre meses (mês anterior sem treino; próximo volta)', async () => {
    const inicio = Date.now() - min(2);
    await feito(inicio);
    await montar();
    await abrirMes();
    await screen.findByTestId('mes-treinado');
    const hoje = new Date(inicio);
    const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const anteriorBtn = screen.getByRole('button', { name: 'Mês anterior' });
    expect(alvo(anteriorBtn)).toBeGreaterThanOrEqual(48);
    await fireEvent.press(anteriorBtn);
    expect(await screen.findByText(tituloMes(anterior))).toBeOnTheScreen();
    expect(screen.queryByTestId('mes-treinado')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(await screen.findByText(tituloMes(hoje))).toBeOnTheScreen();
    expect(screen.getByTestId('mes-treinado')).toBeOnTheScreen();
  });
});

describe('registrar treino passado (RN-07)', () => {
  const diaDe = (offset: number, h: number, m = 0) => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, h, m).getTime();
  };

  it('abre a Sheet com ontem às 18:00; Continuar cria o treino finalizado e abre em modo edição', async () => {
    await montar();
    await fireEvent.press(await botao('Registrar treino passado'));
    expect(await screen.findByRole('adjustable', { name: 'Hora' })).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Hora' }).props.accessibilityValue).toMatchObject({ text: '18' });
    expect(screen.getByRole('adjustable', { name: 'Minuto' }).props.accessibilityValue).toMatchObject({ text: '00' });
    await fireEvent.press(await botao('Continuar'));
    const params = aberto();
    expect(params).toMatchObject({ edit: true, isNew: true });
    const [criado] = (await workouts()).filter((w) => w.id === params.workoutId);
    expect(criado).toMatchObject({ status: 'finished', started_at: diaDe(-1, 18) });
  });

  it('ajusta dia, hora e minuto (passo 5)', async () => {
    await montar();
    await fireEvent.press(await botao('Registrar treino passado'));
    await fireEvent.press(await botao('Diminuir dia'));
    await fireEvent.press(await botao('Diminuir hora'));
    await fireEvent.press(await botao('Aumentar minuto'));
    await fireEvent.press(await botao('Continuar'));
    const [criado] = (await workouts()).filter((w) => w.id === aberto().workoutId);
    expect(criado.started_at).toBe(diaDe(-2, 17, 5));
  });

  it('data no futuro: aviso em alerta e Continuar desabilitado', async () => {
    await montar();
    await fireEvent.press(await botao('Registrar treino passado'));
    await fireEvent.press(await botao('Aumentar dia')); // hoje
    for (let i = 0; i < 5; i++) await fireEvent.press(await botao('Aumentar hora')); // 23h
    for (let i = 0; i < 11; i++) await fireEvent.press(await botao('Aumentar minuto')); // 23:55
    expect(await screen.findByText('Essa data ainda não chegou.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(await workouts()).toHaveLength(0);
  });

  it('sobreposição com outro treino só avisa: Continuar segue habilitado', async () => {
    await feito(diaDe(-1, 17, 50)); // termina 18:15
    await montar();
    await fireEvent.press(await botao('Registrar treino passado'));
    expect(await screen.findByText('Esse horário se sobrepõe a outro treino. Você pode continuar mesmo assim.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(aberto()).toMatchObject({ edit: true, isNew: true });
  });

  it('Cancelar fecha a Sheet sem criar nada', async () => {
    await montar();
    await fireEvent.press(await botao('Registrar treino passado'));
    await fireEvent.press(await botao('Cancelar'));
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
    expect(await workouts()).toHaveLength(0);
  });

  it('também fica disponível na lista com treinos', async () => {
    await feito(Date.now() - min(2));
    await montar();
    expect(await botao('Registrar treino passado')).toBeOnTheScreen();
  });
});

describe('offline (RNF-01)', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  it('lista, mês e registrar não fazem chamada de rede', async () => {
    const spy = jest.fn(() => Promise.reject(new Error('sem rede')));
    global.fetch = spy as unknown as typeof fetch;
    await feito(Date.now() - min(2));
    await montar();
    await fireEvent.press(await botao('Mês'));
    await fireEvent.press(await botao('Lista'));
    await fireEvent.press(await botao('Registrar treino passado'));
    await fireEvent.press(await botao('Continuar'));
    expect(spy).not.toHaveBeenCalled();
  });
});

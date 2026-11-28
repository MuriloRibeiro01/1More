import * as Notifications from 'expo-notifications';
import i18n from '../i18n/instance';

// C18: notificação LOCAL do fim do descanso (nada sai do aparelho, RNF-01).
// Condições do Leônidas: nunca pedir token de push; texto genérico (sem exercício, carga nem nome do treino);
// POST_NOTIFICATIONS pedida em tempo de execução UMA vez por treino aberto; negada ou módulo falhando NUNCA bloqueia
// o treino (o timer na tela é a fonte de verdade). Sem alarme exato: no Doze o aviso pode atrasar.

export interface RestNotifier {
  /** Agenda o aviso para `endAt` (ms). Nunca lança; sem permissão ou com falha, simplesmente não avisa. */
  schedule: (endAt: number) => void;
  /** Cancela a notificação pendente, se houver. Nunca lança. */
  cancel: () => Promise<void>;
}

/** Uma instância por tela de treino: guarda a notificação pendente e se a permissão já foi pedida. */
export function createRestNotifier(): RestNotifier {
  /** id da notificação agendada (ainda pode estar sendo agendada: guarda a promessa). */
  let pending: Promise<string | null> | null = null;
  let asked = false;

  async function ensurePermission(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;
    if (current.status !== 'undetermined' || asked) return false;
    asked = true;
    const result = await Notifications.requestPermissionsAsync();
    return result.granted || result.status === 'granted';
  }

  return {
    schedule(endAt) {
      if (endAt <= Date.now()) return;
      pending = (async () => {
        try {
          if (!(await ensurePermission())) return null;
          return await Notifications.scheduleNotificationAsync({
            content: { title: i18n.t('workout.restDone') },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endAt) },
          });
        } catch (error) {
          console.warn('[descanso] não foi possível agendar a notificação', error);
          return null;
        }
      })();
    },
    async cancel() {
      const previous = pending;
      pending = null;
      if (!previous) return;
      try {
        const id = await previous;
        if (id) await Notifications.cancelScheduledNotificationAsync(id);
      } catch (error) {
        console.warn('[descanso] não foi possível cancelar a notificação', error);
      }
    },
  };
}

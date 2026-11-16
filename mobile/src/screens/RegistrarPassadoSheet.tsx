import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Button, Sheet, Stepper } from '../components';
import i18n from '../i18n/instance';
import { RetroactiveError, createRetroactiveWorkout, hasOverlap } from '../workout/repository';
import { validateRetroactive } from '../workout/rules';
import { space, text, useTheme } from '../theme';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (workoutId: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Sheet "Registrar treino passado": dia, hora e minuto por steppers (sem seletor nativo). Padrão: ontem 18:00. */
export function RegistrarPassadoSheet({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} title={t('history.retro.title')} onClose={onClose}>
      {/* O formulário só existe com a Sheet aberta: cada abertura recomeça em "ontem 18:00" e com "hoje" atual. */}
      {open ? <Form onClose={onClose} onCreated={onCreated} /> : null}
    </Sheet>
  );
}

function Form({ onClose, onCreated }: Omit<Props, 'open'>) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();
  const [now] = useState(() => Date.now());
  const [offset, setOffset] = useState(-1); // dias a partir de hoje (0 = hoje)
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);
  const [overlap, setOverlap] = useState(false);
  const [lateFuture, setLateFuture] = useState(false);
  const [failed, setFailed] = useState(false);

  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, hour, minute).getTime();
  const future = lateFuture || validateRetroactive(start, now) === 'future';

  // RN-07: sobreposição é só aviso. Estimativa de 1 h, já que o treino ainda não tem séries.
  useEffect(() => {
    let alive = true;
    hasOverlap(db, start, start + 60 * 60_000)
      .then((o) => alive && setOverlap(o))
      .catch((error) => console.error('[historico] falha ao checar sobreposição', error));
    return () => {
      alive = false;
    };
  }, [db, start]);

  const loc = i18n.resolvedLanguage ?? i18n.language;
  const formatDay = (value: number) =>
    value === 0
      ? t('history.retro.today')
      : new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short' }).format(
          new Date(today.getFullYear(), today.getMonth(), today.getDate() + value),
        );

  const create = async () => {
    setFailed(false);
    try {
      onCreated(await createRetroactiveWorkout(db, { startedAt: start }));
    } catch (error) {
      if (error instanceof RetroactiveError) setLateFuture(true);
      else {
        console.error('[historico] falha ao criar o treino', error);
        setFailed(true);
      }
    }
  };

  return (
    <>
      <View style={styles.steppers}>
        <Stepper label={t('history.retro.day')} value={offset} min={-365} max={0} format={formatDay} onChange={(v) => { setOffset(v); setLateFuture(false); }} />
        <Stepper label={t('history.retro.hour')} value={hour} min={0} max={23} format={pad} onChange={(v) => { setHour(v); setLateFuture(false); }} />
        <Stepper label={t('history.retro.minute')} value={minute} step={5} min={0} max={55} format={pad} onChange={(v) => { setMinute(v); setLateFuture(false); }} />
      </View>
      {future ? (
        <Text accessibilityRole="alert" style={[styles.warning, { color: c.hugger }]}>
          {t('history.retro.future')}
        </Text>
      ) : overlap ? (
        <Text accessibilityRole="alert" style={[styles.warning, { color: c.ink }]}>
          {t('history.retro.overlap')}
        </Text>
      ) : null}
      {failed ? (
        <Text accessibilityRole="alert" style={[styles.warning, { color: c.ink }]}>
          {t('history.retro.failed')}
        </Text>
      ) : null}
      <Button variant="primary" block disabled={future} onPress={create}>
        {t('history.retro.continue')}
      </Button>
      <Button block onPress={onClose}>
        {t('history.retro.cancel')}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s5 },
  warning: { ...text.body },
});

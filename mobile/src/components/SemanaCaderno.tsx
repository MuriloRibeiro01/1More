import { StyleSheet, Text, View } from 'react-native';
import { border, radius, size, space, text, useTheme } from '../theme';
import i18n from '../i18n/instance';
import { localDayKey, startOfWeek } from '../workout/week';

export interface SemanaCadernoProps {
  now: Date;
  /** Início (UTC) e fuso dos treinos finalizados da semana. */
  workouts: { startedAt: number; tzOffsetMin: number }[];
}

/** Semana do caderno: segunda a domingo, dias treinados marcados à caneta, hoje grifado em laranja. */
export function SemanaCaderno({ now, workouts }: SemanaCadernoProps) {
  const { colors: c } = useTheme();
  const loc = i18n.resolvedLanguage ?? i18n.language;
  const start = startOfWeek(now);
  const todayKey = localDayKey(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()), 0);
  const trainedKeys = new Set(workouts.map((w) => localDayKey(w.startedAt, w.tzOffsetMin)));
  const today = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }).format(0, 'day');

  return (
    <View style={styles.root}>
      {Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const key = localDayKey(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()), 0);
        const trained = trainedKeys.has(key);
        const isToday = key === todayKey;
        const name = new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(day);
        return (
          <View
            key={key}
            testID={`dia-${i}`}
            accessible
            accessibilityLabel={isToday ? `${name}, ${today}` : name}
            accessibilityState={{ selected: trained }}
            style={styles.day}
          >
            {/* Treinado: caixa de tinta de 2px (a "volta à caneta" do protótipo, dentro do raio máx. do DS). */}
            <View
              testID={trained ? 'dia-treinado' : undefined}
              style={[styles.letterBox, trained && { borderColor: c.ink }]}
            >
              <Text testID="dia-letra" style={[styles.letter, { color: c.ink }]}>
                {new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(day).toUpperCase()}
              </Text>
            </View>
            <View
              testID={isToday ? 'dia-hoje' : undefined}
              importantForAccessibility="no-hide-descendants"
              style={[styles.underline, isToday && { backgroundColor: c.hugger }]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.s3 },
  day: { alignItems: 'center', gap: space.s1, minWidth: size.sizeIconSm * 2 },
  letterBox: {
    width: size.sizeIcon + space.s2,
    height: size.sizeIcon + space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.borderPen,
    borderColor: 'transparent',
    borderRadius: radius.radius1,
  },
  letter: { ...text.numMd },
  underline: { alignSelf: 'stretch', height: 3 },
});

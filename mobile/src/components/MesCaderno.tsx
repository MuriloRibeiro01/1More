import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { border, radius, size, space, text, useTheme } from '../theme';
import i18n from '../i18n/instance';
import { localDayKey } from '../workout/week';
import { IconButton } from './IconButton';

export interface MesCadernoProps {
  year: number;
  /** 0–11. */
  month: number;
  /** 'AAAA-MM-DD' → treinos do dia, o mais novo primeiro. */
  byDay: ReadonlyMap<string, readonly { id: string; name: string }[]>;
  today: Date;
  onSelect: (workoutId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

const keyOf = (d: Date) => localDayKey(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()), 0);

/** Mês do caderno: segunda a domingo, dias treinados marcados à caneta (caixa de 2px, como a SemanaCaderno), hoje grifado. */
export function MesCaderno({ year, month, byDay, today, onSelect, onPrev, onNext }: MesCadernoProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const loc = i18n.resolvedLanguage ?? i18n.language;
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // segunda = 0
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const todayKey = keyOf(today);
  const long = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View>
      <View style={styles.nav}>
        <IconButton icon="chevron-left" label={t('history.prevMonth')} onPress={onPrev} />
        <Text style={[styles.title, { color: c.ink }]}>{new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(first)}</Text>
        <IconButton icon="chevron-right" label={t('history.nextMonth')} onPress={onNext} />
      </View>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={[styles.weekday, { color: c.inkMuted }]}>
            {new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)).toUpperCase()}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.row}>
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (day === null) return <View key={i} style={styles.cell} />;
            const date = new Date(year, month, day);
            const key = keyOf(date);
            const workouts = byDay.get(key);
            const isToday = key === todayKey;
            const body = (
              <>
                <View testID={workouts ? 'mes-treinado' : undefined} style={[styles.box, workouts && { borderColor: c.ink }]}>
                  <Text style={[styles.day, { color: c.ink }]}>{day}</Text>
                </View>
                <View
                  testID={isToday ? 'mes-hoje' : undefined}
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.underline, isToday && { backgroundColor: c.hugger }]}
                />
              </>
            );
            const label = [long.format(date), ...(workouts?.map((w) => w.name) ?? [])].join(', ');
            // Só o dia treinado é tocável; abre o treino mais recente do dia.
            return workouts ? (
              <Pressable
                key={i}
                testID={`mes-dia-${key}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: true }}
                onPress={() => onSelect(workouts[0].id)}
                android_ripple={{ color: c.paperSunk }}
                style={styles.cell}
              >
                {body}
              </Pressable>
            ) : (
              <View key={i} testID={`mes-dia-${key}`} accessible accessibilityLabel={label} accessibilityState={{ selected: false }} style={styles.cell}>
                {body}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...text.bodyStrong },
  row: { flexDirection: 'row' },
  weekday: { ...text.label, flex: 1, textAlign: 'center', paddingVertical: space.s1 },
  cell: { flex: 1, minHeight: size.sizeTouch, alignItems: 'center', justifyContent: 'center', gap: space.s1 },
  box: {
    width: size.sizeIcon + space.s2,
    height: size.sizeIcon + space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.borderPen,
    borderColor: 'transparent',
    borderRadius: radius.radius1,
  },
  day: { ...text.numSm },
  underline: { alignSelf: 'stretch', height: 3, marginHorizontal: space.s2 },
});

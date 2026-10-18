import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { border, radius, size as sizes, space, text, useTheme } from '../theme';
import { Button } from './Button';

export interface RoutineCardProps {
  /** Letra da divisão (A/B/C), na margem. */
  letter?: string;
  name: string;
  exercises?: string[];
  /** "Último: 10 out · há 4 dias". */
  lastDone?: string;
  onStart?: () => void;
  onOpen?: () => void;
}

/** Ficha de rotina: tocar abre a edição; "Começar" só aparece quando há onStart. */
export function RoutineCard({ letter, name, exercises = [], lastDone, onStart, onOpen }: RoutineCardProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const list = exercises.join(' · ');

  return (
    <View>
      <View style={[styles.card, { backgroundColor: c.paperRaised, borderColor: c.line }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[name, list].filter(Boolean).join('. ')}
          accessibilityHint={t('routines.openHint')}
          onPress={onOpen}
          android_ripple={{ color: c.paperSunk }}
          style={({ pressed }) => [styles.open, pressed && { backgroundColor: c.paperSunk }]}
        >
          {letter ? (
            <View style={[styles.margin, { borderRightColor: c.marginLine }]}>
              <Text style={[styles.letter, { color: c.ink }]}>{letter}</Text>
            </View>
          ) : null}
          <View style={styles.body}>
            <Text style={[styles.name, { color: c.ink }]}>{name}</Text>
            {list ? <Text style={[styles.exercises, { color: c.inkMuted }]}>{list}</Text> : null}
            {lastDone ? <Text style={[styles.lastDone, { color: c.inkMuted }]}>{lastDone}</Text> : null}
          </View>
        </Pressable>
        {onStart ? (
          <View style={styles.footer}>
            <Button variant="primary" icon="play" onPress={onStart}>
              {t('routines.start')}
            </Button>
          </View>
        ) : null}
      </View>
      {/* Borda de folha empilhada (shadow-sheet): sem desfoque. */}
      <View style={[styles.sheetEdge, { backgroundColor: c.paperSunk }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: border.borderHair, borderRadius: radius.radius1 },
  open: { flexDirection: 'row', minHeight: sizes.sizeRow },
  margin: {
    width: sizes.sizeMargin,
    alignItems: 'center',
    paddingTop: space.s3,
    borderRightWidth: border.borderPen,
  },
  letter: { ...text.titleMd },
  body: { flex: 1, padding: space.s4, gap: space.s1 },
  name: { ...text.titleMd },
  exercises: { ...text.body },
  lastDone: { ...text.numSm },
  footer: { paddingHorizontal: space.s4, paddingBottom: space.s4 },
  sheetEdge: { height: border.borderPen, marginHorizontal: border.borderPen },
});

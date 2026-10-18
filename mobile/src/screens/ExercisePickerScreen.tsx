import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusedBackHandler } from '../navigation/useFocusedBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Icon, IconButton, TextField, TopBar } from '../components';
import { searchExercises } from '../routines/rules';
import type { CatalogExercise } from '../routines/types';
import { border, radius, size as sizes, space, text, useTheme } from '../theme';

interface ExercisePickerScreenProps {
  catalog: readonly CatalogExercise[];
  onCancel: () => void;
  /** Ids na ordem em que foram marcados. */
  onConfirm: (ids: string[]) => void;
}

/** Catálogo embarcado com busca sem acento e seleção múltipla (funciona offline). */
export function ExercisePickerScreen({ catalog, onCancel, onConfirm }: ExercisePickerScreenProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const results = useMemo(() => searchExercises(catalog, query), [catalog, query]);

  useFocusedBackHandler(onCancel);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.paper }]}>
      <TopBar title={t('picker.title')} compact left={<IconButton icon="chevron-left" label={t('picker.back')} onPress={onCancel} />} />
      <View style={styles.search}>
        <TextField label={t('picker.search')} value={query} onChange={setQuery} />
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {results.length === 0 ? <Text style={[styles.empty, { color: c.inkMuted }]}>{t('picker.noResults')}</Text> : null}
        {results.map((ex) => {
          const checked = selected.includes(ex.id);
          return (
            <Pressable
              key={ex.id}
              accessibilityRole="checkbox"
              accessibilityLabel={ex.name}
              accessibilityState={{ checked }}
              onPress={() => toggle(ex.id)}
              android_ripple={{ color: c.paperSunk }}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: c.rule, backgroundColor: pressed ? c.paperSunk : checked ? c.doneWash : 'transparent' },
              ]}
            >
              <View
                style={[
                  styles.box,
                  { borderColor: checked ? c.grabber : c.lineStrong, backgroundColor: checked ? c.grabber : 'transparent' },
                ]}
              >
                {checked ? <Icon name="check" size={sizes.sizeIconSm} color={c.onGrabber} /> : null}
              </View>
              <Text style={[styles.name, { color: c.ink }]}>{ex.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: c.paperRaised, borderTopColor: c.line }]}>
        <Button variant="primary" block icon="plus" disabled={selected.length === 0} onPress={() => onConfirm(selected)}>
          {selected.length === 0 ? t('picker.selectSome') : t('picker.add', { count: selected.length })}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { paddingHorizontal: space.s4, paddingTop: space.s4 },
  list: { paddingHorizontal: space.s4, paddingVertical: space.s4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: sizes.sizeRow,
    borderBottomWidth: border.borderHair,
  },
  box: {
    width: sizes.sizeIcon,
    height: sizes.sizeIcon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.borderPen,
    borderRadius: radius.radius1,
  },
  name: { ...text.body, flex: 1 },
  empty: { ...text.body, paddingVertical: space.s5 },
  footer: { padding: space.s4, borderTopWidth: border.borderHair },
});

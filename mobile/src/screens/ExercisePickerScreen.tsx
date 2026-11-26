import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusedBackHandler } from '../navigation/useFocusedBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Caixinha, Folha, IconButton, Linha, TextField, TopBar } from '../components';
import { searchExercises } from '../routines/rules';
import type { CatalogExercise } from '../routines/types';
import { border, size, space, text, useTheme } from '../theme';

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
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar title={t('picker.title')} compact left={<IconButton icon="chevron-left" label={t('picker.back')} onPress={onCancel} />} />
        <View style={styles.search}>
          <TextField label={t('picker.search')} value={query} onChange={setQuery} />
        </View>
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {results.length === 0 ? <Text style={[styles.empty, { color: c.inkMuted }]}>{t('picker.noResults')}</Text> : null}
          {results.map((ex) => {
            const checked = selected.includes(ex.id);
            return (
              // Lista de verificação: a caixinha na margem é o controle acessível; a linha inteira também alterna ao toque.
              <Linha
                key={ex.id}
                accessible={false}
                destaque={checked}
                onPress={() => toggle(ex.id)}
                margem={<Caixinha checked={checked} label={ex.name} onChange={() => toggle(ex.id)} />}
              >
                <Text style={[styles.name, { color: c.ink }]}>{ex.name}</Text>
              </Linha>
            );
          })}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: c.rule }]}>
          <Button variant="primary" block icon="plus" disabled={selected.length === 0} onPress={() => onConfirm(selected)}>
            {selected.length === 0 ? t('picker.selectSome') : t('picker.add', { count: selected.length })}
          </Button>
        </View>
      </Folha>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4, paddingTop: space.s4 },
  list: { paddingTop: space.s4 },
  name: { ...text.body },
  empty: { ...text.body, paddingVertical: space.s5, paddingLeft: size.sizeMargin + space.s3 },
  footer: { padding: space.s4, borderTopWidth: border.borderHair },
});

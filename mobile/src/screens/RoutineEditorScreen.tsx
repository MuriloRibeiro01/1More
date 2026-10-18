import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusedBackHandler } from '../navigation/useFocusedBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Button, Icon, IconButton, NumberField, Sheet, Stepper, TextField, TopBar } from '../components';
import { formatWeight } from '../i18n';
import i18n from '../i18n/instance';
import { deleteRoutine, listCatalog, loadRoutine, RoutineValidationError, saveRoutine } from '../routines/repository';
import {
  DEFAULT_REST_S,
  DEFAULT_SETS,
  formatRest,
  MAX_NAME,
  MAX_REST_S,
  MAX_SETS,
  MIN_SETS,
  parseKg,
  parseReps,
  REST_STEP_S,
  validateRoutine,
} from '../routines/rules';
import type { CatalogExercise, ExerciseDraft, RoutineDraft, RoutineError } from '../routines/types';
import { border, size as sizes, space, text, useTheme } from '../theme';
import { ExercisePickerScreen } from './ExercisePickerScreen';

/** Exercício em edição: carga e reps ficam como texto até salvar (o que a pessoa digitou). */
interface Item {
  key: string;
  exerciseId: string;
  name: string;
  sets: number;
  restSeconds: number;
  weight: string;
  repsMin: string;
  repsMax: string;
  expanded: boolean;
}

interface Form {
  name: string;
  items: Item[];
}

let keySeq = 0;
const newKey = () => `item-${keySeq++}`;

/** Carga para o campo, no idioma ativo e sem separador de milhar (o parse não aceita "1.000"). */
function kgToText(kg: number | null): string {
  if (kg === null) return '';
  return new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2, useGrouping: false }).format(kg);
}

const snapshot = (form: Form) =>
  JSON.stringify([form.name, form.items.map(({ key: _k, expanded: _e, name: _n, ...rest }) => rest)]);

/** Converte o formulário em rascunho; textos inválidos viram erro (e o campo vai como null). */
function toDraft(form: Form, id?: string): { draft: RoutineDraft; parseErrors: RoutineError[] } {
  const parseErrors = new Set<RoutineError>();
  const exercises: ExerciseDraft[] = form.items.map((it) => {
    const weight = parseKg(it.weight);
    if (!weight.ok) parseErrors.add('invalid_weight');
    const repsMin = parseReps(it.repsMin);
    const repsMax = parseReps(it.repsMax);
    if (repsMin === undefined || repsMax === undefined) parseErrors.add('invalid_reps');
    return {
      exerciseId: it.exerciseId,
      sets: it.sets,
      weightKg: weight.ok ? weight.value : null,
      repsMin: repsMin ?? null,
      repsMax: repsMax ?? null,
      restSeconds: it.restSeconds,
    };
  });
  return { draft: { id, name: form.name, exercises }, parseErrors: [...parseErrors] };
}

interface RoutineEditorScreenProps {
  /** Ausente = rotina nova. */
  routineId?: string;
  onDone: () => void;
}

export function RoutineEditorScreen({ routineId, onDone }: RoutineEditorScreenProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const db = useDatabase();

  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [form, setForm] = useState<Form | null>(routineId ? null : { name: '', items: [] });
  const [initial, setInitial] = useState(() => snapshot({ name: '', items: [] }));
  const [errors, setErrors] = useState<RoutineError[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<'discard' | 'delete' | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await listCatalog(db);
      if (!alive) return;
      setCatalog(list);
      if (!routineId) return;
      const draft = await loadRoutine(db, routineId);
      const names = new Map(list.map((e) => [e.id, e.name]));
      const loaded: Form = {
        name: draft.name,
        items: draft.exercises.map((ex) => ({
          key: newKey(),
          exerciseId: ex.exerciseId,
          name: names.get(ex.exerciseId) ?? '',
          sets: ex.sets,
          restSeconds: ex.restSeconds,
          weight: kgToText(ex.weightKg),
          repsMin: ex.repsMin === null ? '' : String(ex.repsMin),
          repsMax: ex.repsMax === null ? '' : String(ex.repsMax),
          expanded: false,
        })),
      };
      if (!alive) return;
      setInitial(snapshot(loaded));
      setForm(loaded);
    })().catch((error) => console.error('[rotinas] falha ao abrir a rotina', error));
    return () => {
      alive = false;
    };
  }, [db, routineId]);

  const dirty = form !== null && snapshot(form) !== initial;

  const close = useCallback(() => {
    if (dirty) setSheet('discard');
    else onDone();
  }, [dirty, onDone]);

  // Com o seletor aberto, quem trata o voltar é ele.
  useFocusedBackHandler(close, !picking);

  const updateItem = (index: number, patch: Partial<Item>) =>
    setForm((f) => f && { ...f, items: f.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });

  const moveItem = (index: number, delta: number) =>
    setForm((f) => {
      if (!f) return f;
      const items = [...f.items];
      const target = index + delta;
      if (target < 0 || target >= items.length) return f;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...f, items };
    });

  const removeItem = (index: number) => setForm((f) => f && { ...f, items: f.items.filter((_, i) => i !== index) });

  const addExercises = (ids: string[]) => {
    const names = new Map(catalog.map((e) => [e.id, e.name]));
    setForm(
      (f) =>
        f && {
          ...f,
          items: [
            ...f.items,
            ...ids.map((id) => ({
              key: newKey(),
              exerciseId: id,
              name: names.get(id) ?? '',
              sets: DEFAULT_SETS,
              restSeconds: DEFAULT_REST_S,
              weight: '',
              repsMin: '',
              repsMax: '',
              expanded: true,
            })),
          ],
        },
    );
    setPicking(false);
  };

  const save = async () => {
    if (!form || saving) return;
    const { draft, parseErrors } = toDraft(form, routineId);
    const all = [...new Set([...validateRoutine(draft), ...parseErrors])];
    setErrors(all);
    setSaveFailed(false);
    if (all.length) return;
    setSaving(true);
    try {
      await saveRoutine(db, draft);
      onDone();
    } catch (error) {
      if (error instanceof RoutineValidationError) setErrors(error.errors);
      else {
        console.error('[rotinas] falha ao salvar', error);
        setSaveFailed(true);
      }
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!routineId) return;
    setSheet(null);
    try {
      await deleteRoutine(db, routineId);
      onDone();
    } catch (error) {
      console.error('[rotinas] falha ao excluir', error);
      setSaveFailed(true);
    }
  };

  if (picking) {
    return <ExercisePickerScreen catalog={catalog} onCancel={() => setPicking(false)} onConfirm={addExercises} />;
  }

  const title = form?.name.trim() || t(routineId ? 'routines.editRoutine' : 'routines.newRoutine');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.paper }]}>
      <TopBar title={title} compact left={<IconButton icon="close" label={t('routines.close')} onPress={close} />} />
      {form ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField
            label={t('routines.name')}
            value={form.name}
            onChange={(name) => setForm((f) => f && { ...f, name })}
            placeholder={t('routines.namePlaceholder')}
            hint={t('routines.nameHint')}
            maxLength={MAX_NAME}
          />

          <Text style={[styles.section, { color: c.inkMuted }]}>{t('routines.exercises')}</Text>
          {form.items.map((item, index) => (
            <ExerciseEditor
              key={item.key}
              index={index}
              item={item}
              isFirst={index === 0}
              isLast={index === form.items.length - 1}
              onChange={(patch) => updateItem(index, patch)}
              onMove={(delta) => moveItem(index, delta)}
              onRemove={() => removeItem(index)}
            />
          ))}
          <Button variant="secondary" icon="plus" block onPress={() => setPicking(true)}>
            {t('routines.addExercise')}
          </Button>

          {errors.length || saveFailed ? (
            <View style={styles.errors}>
              {errors.map((e) => (
                <ErrorLine key={e} message={t(`routines.errors.${e}`)} />
              ))}
              {saveFailed ? <ErrorLine message={t('routines.saveFailed')} /> : null}
            </View>
          ) : null}

          <Button variant="primary" size="lg" icon="check" block disabled={saving} onPress={save}>
            {t('routines.save')}
          </Button>
          {routineId ? (
            <Button variant="danger" icon="trash" block onPress={() => setSheet('delete')}>
              {t('routines.deleteRoutine')}
            </Button>
          ) : null}
        </ScrollView>
      ) : null}

      <Sheet open={sheet === 'discard'} title={t('routines.discardTitle')} onClose={() => setSheet(null)}>
        <Button block onPress={() => setSheet(null)}>
          {t('routines.keepEditing')}
        </Button>
        <Button variant="danger" block onPress={onDone}>
          {t('routines.discard')}
        </Button>
      </Sheet>
      <Sheet open={sheet === 'delete'} title={t('routines.deleteTitle')} onClose={() => setSheet(null)}>
        <Button block onPress={() => setSheet(null)}>
          {t('routines.cancel')}
        </Button>
        <Button variant="danger" block onPress={remove}>
          {t('routines.delete')}
        </Button>
      </Sheet>
    </SafeAreaView>
  );
}

function ErrorLine({ message }: { message: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.errorLine}>
      <Icon name="alert" size={sizes.sizeIconSm} color={c.ink} />
      <Text accessibilityRole="alert" style={[styles.errorText, { color: c.ink }]}>
        {message}
      </Text>
    </View>
  );
}

interface ExerciseEditorProps {
  index: number;
  item: Item;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<Item>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

/** Bloco do exercício: cabeçalho (número na margem + nome) abre/fecha o editor das séries. */
function ExerciseEditor({ index, item, isFirst, isLast, onChange, onMove, onRemove }: ExerciseEditorProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();

  const weight = parseKg(item.weight);
  const summary = [
    t('routines.setsCount', { count: item.sets }),
    item.repsMin || item.repsMax ? t('routines.reps', { min: item.repsMin || '?', max: item.repsMax || '?' }) : null,
    weight.ok && weight.value !== null ? formatWeight(weight.value) : null,
    formatRest(item.restSeconds),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View testID={`exercicio-${index}`} style={[styles.block, { backgroundColor: c.paperRaised, borderColor: c.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityHint={summary}
        accessibilityState={{ expanded: item.expanded }}
        onPress={() => onChange({ expanded: !item.expanded })}
        android_ripple={{ color: c.paperSunk }}
        style={({ pressed }) => [styles.header, pressed && { backgroundColor: c.paperSunk }]}
      >
        <View style={[styles.margin, { borderRightColor: c.marginLine }]}>
          <Text style={[styles.number, { color: c.ink }]}>{index + 1}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.exerciseName, { color: c.ink }]}>{item.name}</Text>
          <Text style={[styles.summary, { color: c.inkMuted }]}>{summary}</Text>
        </View>
        <Icon name={item.expanded ? 'chevron-down' : 'chevron-right'} color={c.inkMuted} />
      </Pressable>

      {item.expanded ? (
        <View style={styles.body}>
          <View style={styles.steppers}>
            <Stepper
              label={t('routines.sets')}
              value={item.sets}
              min={MIN_SETS}
              max={MAX_SETS}
              onChange={(sets) => onChange({ sets })}
            />
            <Stepper
              label={t('routines.rest')}
              value={item.restSeconds}
              step={REST_STEP_S}
              min={0}
              max={MAX_REST_S}
              format={formatRest}
              onChange={(restSeconds) => onChange({ restSeconds })}
            />
          </View>
          <NumberField label={t('routines.weight')} value={item.weight} unit="kg" onChange={(w) => onChange({ weight: w })} />
          <View style={styles.reps}>
            <NumberField
              style={styles.flex}
              label={t('routines.repsMin')}
              decimal={false}
              value={item.repsMin}
              onChange={(v) => onChange({ repsMin: v })}
            />
            <NumberField
              style={styles.flex}
              label={t('routines.repsMax')}
              decimal={false}
              value={item.repsMax}
              onChange={(v) => onChange({ repsMax: v })}
            />
          </View>
          <View style={styles.actions}>
            <Button variant="ghost" icon="arrow-up" accessibilityLabel={t('routines.moveUp')} disabled={isFirst} onPress={() => onMove(-1)}>
              {t('routines.upShort')}
            </Button>
            <Button variant="ghost" icon="chevron-down" accessibilityLabel={t('routines.moveDown')} disabled={isLast} onPress={() => onMove(1)}>
              {t('routines.downShort')}
            </Button>
            <Button variant="ghost" icon="trash" accessibilityLabel={t('routines.remove')} onPress={onRemove}>
              {t('routines.removeShort')}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.s4, paddingTop: space.s5, paddingBottom: space.s8, gap: space.s5 },
  section: { ...text.label },
  block: { borderWidth: border.borderHair },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.sizeRow, paddingRight: space.s3, gap: space.s2 },
  margin: {
    width: sizes.sizeMargin,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: border.borderPen,
  },
  number: { ...text.numMd },
  headerText: { flex: 1, paddingVertical: space.s2, paddingLeft: space.s2 },
  exerciseName: { ...text.titleMd },
  summary: { ...text.numSm },
  body: { padding: space.s4, gap: space.s4 },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s5 },
  reps: { flexDirection: 'row', gap: space.s4 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  errors: { gap: space.s2 },
  errorLine: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  errorText: { ...text.body, flex: 1 },
});

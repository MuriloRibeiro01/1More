import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusedBackHandler } from '../navigation/useFocusedBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Caixinha, FaixaFiltros, Folha, IconButton, Linha, LinkCaneta, Sheet, TextField, TopBar } from '../components';
import { CustomExerciseValidationError, type CustomExerciseValues, type TrackingType } from '../routines/customExercise';
import { searchExercises } from '../routines/rules';
import type { CatalogExercise } from '../routines/types';
import { border, size, space, text, useTheme } from '../theme';
import { EQUIPMENT_KEYS, ExerciseFormView, MUSCLE_KEYS } from './ExerciseFormView';

interface ExercisePickerScreenProps {
  catalog: readonly CatalogExercise[];
  onCancel: () => void;
  /** Ids na ordem em que foram marcados. */
  onConfirm: (ids: string[]) => void;
  /** Seleção única (trocar exercício): tocar numa linha escolhe e confirma, sem botão de adicionar. */
  single?: boolean;
  title?: string;
  /** Exercício próprio (RF-12): sem esta prop o seletor não oferece criar/editar/arquivar. Lança CustomExerciseValidationError. */
  onSaveCustom?: (values: CustomExerciseValues, id?: string) => Promise<void>;
  onArchiveCustom?: (id: string) => Promise<void>;
  /** Falha ao gravar a escolha (adicionar ou trocar): aviso visível, sem sair da tela. */
  error?: string | null;
}

type Sheets = null | { optionsId: string } | { archiveId: string };

/** Catálogo embarcado com filtros, busca sem acento e seleção múltipla (funciona offline). */
export function ExercisePickerScreen({
  catalog,
  onCancel,
  onConfirm,
  single = false,
  title,
  onSaveCustom,
  onArchiveCustom,
  error,
}: ExercisePickerScreenProps) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string>('all');
  const [equipment, setEquipment] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState<null | { id?: string; initial?: CustomExerciseValues }>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheets>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  useFocusedBackHandler(onCancel);

  const muscleOptions = useMemo(() => {
    const present = new Set(catalog.map((e) => e.primaryMuscle).filter(Boolean));
    return [
      { id: 'all', label: t('picker.allMuscles') },
      ...MUSCLE_KEYS.filter((k) => present.has(k)).map((k) => ({ id: k as string, label: t(`progress.muscles.${k}`) })),
    ];
  }, [catalog, t]);
  const equipmentOptions = useMemo(
    () => [
      { id: 'all', label: t('picker.anyEquipment') },
      ...EQUIPMENT_KEYS.map((k) => ({ id: k as string, label: t(`picker.equipment.${k}`) })),
    ],
    [t],
  );
  const results = useMemo(
    () =>
      searchExercises(catalog, query).filter(
        (e) => (muscle === 'all' || e.primaryMuscle === muscle) && (equipment === 'all' || e.equipmentCode === equipment),
      ),
    [catalog, query, muscle, equipment],
  );

  const toggle = (id: string) =>
    single ? onConfirm([id]) : setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async (values: CustomExerciseValues) => {
    if (!onSaveCustom) return;
    try {
      await onSaveCustom(values, form?.id);
      setFormError(null);
      setForm(null);
    } catch (error) {
      if (error instanceof CustomExerciseValidationError) {
        setFormError(
          t(error.reason === 'duplicate' ? 'picker.form.duplicate' : error.reason === 'too_long' ? 'picker.form.tooLong' : 'picker.form.empty'),
        );
      } else {
        console.error('[exercício] falha ao salvar o exercício próprio', error);
        setFormError(t('picker.form.failed'));
      }
    }
  };

  const optionsTarget = sheet && 'optionsId' in sheet ? catalog.find((e) => e.id === sheet.optionsId) : undefined;
  const archiveTarget = sheet && 'archiveId' in sheet ? catalog.find((e) => e.id === sheet.archiveId) : undefined;

  if (form) {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.paper }]}>
        <Folha>
          <ExerciseFormView
            initial={form.initial}
            error={formError}
            onSave={(v) => void save(v)}
            onCancel={() => {
              setFormError(null);
              setForm(null);
            }}
          />
        </Folha>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.paper }]}>
      <Folha>
        <TopBar title={title ?? t('picker.title')} compact left={<IconButton icon="chevron-left" label={t('picker.back')} onPress={onCancel} />} />
        <View style={styles.search}>
          <TextField label={t('picker.search')} value={query} onChange={setQuery} />
        </View>
        {error ?? archiveError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: c.ink }]}>
            {error ?? archiveError}
          </Text>
        ) : null}
        <FaixaFiltros label={t('picker.muscleFilter')} options={muscleOptions} value={muscle} onChange={setMuscle} />
        <FaixaFiltros label={t('picker.equipmentFilter')} options={equipmentOptions} value={equipment} onChange={setEquipment} />
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
                <View style={styles.rowContent}>
                  <Text style={[styles.name, { color: c.ink }]}>{ex.name}</Text>
                  {ex.isCustom && onSaveCustom ? (
                    <IconButton icon="more" label={t('picker.optionsOf', { name: ex.name })} onPress={() => setSheet({ optionsId: ex.id })} />
                  ) : null}
                </View>
              </Linha>
            );
          })}
          {onSaveCustom ? (
            <View style={styles.create}>
              <LinkCaneta
                onPress={() => {
                  setFormError(null);
                  setForm({});
                }}
              >
                {t('picker.createCustom')}
              </LinkCaneta>
            </View>
          ) : null}
        </ScrollView>
        {single ? null : (
          <View style={[styles.footer, { borderTopColor: c.rule }]}>
            <Button variant="primary" block icon="plus" disabled={selected.length === 0} onPress={() => onConfirm(selected)}>
              {selected.length === 0 ? t('picker.selectSome') : t('picker.add', { count: selected.length })}
            </Button>
          </View>
        )}
      </Folha>

      <Sheet open={!!optionsTarget} title={optionsTarget?.name} onClose={() => setSheet(null)}>
        <Button
          block
          onPress={() => {
            if (!optionsTarget) return;
            setFormError(null);
            setForm({
              id: optionsTarget.id,
              initial: {
                name: optionsTarget.name,
                primaryMuscle: optionsTarget.primaryMuscle ?? null,
                equipmentCode: optionsTarget.equipmentCode ?? null,
                trackingType: (optionsTarget.trackingType as TrackingType | undefined) ?? 'weight_reps',
              },
            });
            setSheet(null);
          }}
        >
          {t('picker.editCustom')}
        </Button>
        <Button variant="danger" block onPress={() => optionsTarget && setSheet({ archiveId: optionsTarget.id })}>
          {t('picker.archiveCustom')}
        </Button>
      </Sheet>
      <Sheet open={!!archiveTarget} title={t('picker.archiveTitle')} onClose={() => setSheet(null)}>
        <Text style={[styles.hint, { color: c.inkMuted }]}>{t('picker.archiveHint')}</Text>
        <Button
          variant="danger"
          block
          onPress={() => {
            const id = archiveTarget?.id;
            setSheet(null);
            if (id && onArchiveCustom) {
              setArchiveError(null);
              onArchiveCustom(id).catch((failure) => {
                console.error('[exercício] falha ao arquivar', failure);
                setArchiveError(t('picker.archiveFailed'));
              });
            }
          }}
        >
          {t('picker.archive')}
        </Button>
        <Button block onPress={() => setSheet(null)}>
          {t('picker.cancel')}
        </Button>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4, paddingTop: space.s4 },
  list: { paddingTop: space.s2 },
  name: { ...text.body, flex: 1 },
  rowContent: { flexDirection: 'row', alignItems: 'center' },
  empty: { ...text.body, paddingVertical: space.s5, paddingLeft: size.sizeMargin + space.s3 },
  create: { paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4, paddingTop: space.s4 },
  hint: { ...text.body },
  error: { ...text.body, paddingTop: space.s3, paddingLeft: size.sizeMargin + space.s3, paddingRight: space.s4 },
  footer: { padding: space.s4, borderTopWidth: border.borderHair },
});

import { useAppTheme, useThemeStyles } from '../../../ui/AppTheme';
import type { AppTheme } from '../../../ui/AppTheme';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { RADIUS, SPACE, SIZE, PressableScale } from '../../../ui';
import {
  EXPORT_COUNCILS, ITR_YEARS_EXPECTED, financialYears, parseYears,
} from './companyOptions';
import {
  NicCategory, ProductCategory, MAX_PRODUCT_CATEGORIES, loadNicCategories, searchNicCategories,
  isKnownDescription, sameCategory,
} from './nicCodes';

/**
 * The company form's building blocks. Module-level components only — a
 * component declared inside another remounts its inputs on every keystroke.
 * No native <Modal> anywhere (CLAUDE.md Rule 2): every picker opens inline.
 */

/* ------------------------------------------------------------------ images */

export type PickedImage = { uri: string; type: string; name: string } | null;

/** The image picker, guarded per Rule 2.4. `maxBytes` mirrors the website's caps. */
export const pickImage = (maxBytes: number, label: string, onPicked: (img: PickedImage) => void) => {
  try {
    if (typeof launchImageLibrary !== 'function') {
      Alert.alert('Unavailable', 'The photo picker is not available on this device.');
      return;
    }
    launchImageLibrary(
      { mediaType: 'photo', maxWidth: 1600, maxHeight: 1600, quality: 0.8, selectionLimit: 1 },
      (res) => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Error', res?.errorMessage || 'Could not open that photo.');
          return;
        }
        const asset = (res?.assets || [])[0];
        if (!asset?.uri) {
          Alert.alert('Error', 'That image could not be read. Please pick another.');
          return;
        }
        if (asset?.type && !String(asset.type).startsWith('image/')) {
          Alert.alert('Not an image', 'Please choose an image file.');
          return;
        }
        if (Number(asset?.fileSize || 0) > maxBytes) {
          Alert.alert('Image too large', `Please choose a ${label} smaller than ${Math.round(maxBytes / (1024 * 1024))} MB.`);
          return;
        }
        onPicked({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `${label.replace(/\s+/g, '-')}-${Date.now()}.jpg`,
        });
      },
    );
  } catch (err) {
    console.warn('Native module call safely caught:', err);
    Alert.alert('Error', 'Could not open the photo picker.');
  }
};

/* ------------------------------------------------------------------ labels */

export function Label({ text, required, hint }: { text: string; required?: boolean; hint?: string }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={s.labelWrap}>
      <Text style={s.label} maxFontSizeMultiplier={1.3}>{text}{required ? <Text style={{ color: PALETTE.dangerText }}> *</Text> : null}</Text>
      {hint ? <Text style={s.hint} maxFontSizeMultiplier={1.3}>{hint}</Text> : null}
    </View>
  );
}

export function SubHeading({ title, hint }: { title: string; hint?: string }) {
  const s = useThemeStyles(makeStyles);
  return (
    <View style={s.sub}>
      <View style={s.subRow}>
        <View style={s.subBar} />
        <Text style={s.subTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{title}</Text>
      </View>
      {hint ? <Text style={s.hint} maxFontSizeMultiplier={1.3}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ choices */

/** One selectable pill — brand gradient when on, soft fill when off. */
function Pill({ label, on, onPress, role, icon, style }: {
  label: string; on: boolean; onPress: () => void; role: 'radio' | 'checkbox'; icon?: string; style?: any;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const inner = (
    <>
      {on ? <Icon name="check" size={15} color={PALETTE.white} /> : icon ? <Icon name={icon} size={16} color={PALETTE.textMuted} /> : null}
      <Text style={[s.chipText, on && s.chipTextOn]} maxFontSizeMultiplier={1.3}>{label}</Text>
    </>
  );
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.95}
      style={style}
      accessibilityRole={role}
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      {on ? (
        <LinearGradient colors={PILL_ON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.chip, s.chipOn]}>{inner}</LinearGradient>
      ) : (
        <View style={s.chip}>{inner}</View>
      )}
    </PressableScale>
  );
}

const PILL_ON = ['#4C1D95', '#7C3AED'];

/** Pick one (radio). Tapping the selected chip clears it unless `required`. */
export function ChipChoice({ options, value, onChange, required, error }: {
  options: readonly string[]; value: string; onChange: (v: string) => void; required?: boolean; error?: string;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={{ marginBottom: SPACE.lg }}>
      <View style={s.chips} accessibilityRole="radiogroup">
        {(options || []).map((o) => {
          const on = o === value;
          return <Pill key={o} label={o} on={on} role="radio" onPress={() => onChange(on && !required ? '' : o)} />;
        })}
      </View>
      {error ? (
        <View style={s.errRow}>
          <Icon name="error-outline" size={14} color={PALETTE.red} />
          <Text style={s.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Pick many (checkbox semantics). */
export function ChipMulti({ options, values, onToggle }: {
  options: readonly string[]; values: string[]; onToggle: (v: string) => void;
}) {
  const s = useThemeStyles(makeStyles);
  const set = new Set(values || []);
  return (
    <View style={[s.chips, { marginBottom: SPACE.lg }]}>
      {(options || []).map((o) => <Pill key={o} label={o} on={set.has(o)} role="checkbox" onPress={() => onToggle(o)} />)}
    </View>
  );
}

/** Yes / No, and neither is allowed — nothing here is required. */
export function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.yesNo, { marginBottom: SPACE.lg }]} accessibilityRole="radiogroup">
      {(['yes', 'no'] as const).map((v) => {
        const on = value === v;
        const label = v === 'yes' ? 'Yes' : 'No';
        const inner = (
          <>
            <Icon name={v === 'yes' ? 'check-circle-outline' : 'highlight-off'} size={18} color={on ? PALETTE.white : PALETTE.textMuted} />
            <Text style={[s.chipText, on && s.chipTextOn]} maxFontSizeMultiplier={1.3}>{label}</Text>
          </>
        );
        return (
          <PressableScale
            key={v}
            onPress={() => onChange(on ? '' : v)}
            style={{ flex: 1 }}
            scaleTo={0.96}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label}
          >
            {on ? (
              <LinearGradient colors={PILL_ON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.yesNoBtn, s.yesNoOn]}>{inner}</LinearGradient>
            ) : (
              <View style={s.yesNoBtn}>{inner}</View>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** One body a company may be registered with. `lockedNote` present = cannot untick. */
export function CheckTile({ label, description, checked, onPress, lockedNote }: {
  label: string; description?: string; checked: boolean; onPress: () => void; lockedNote?: string;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <PressableScale
      onPress={lockedNote ? undefined : onPress}
      disabled={!!lockedNote}
      scaleTo={0.98}
      contentStyle={[s.tile, checked && s.tileOn]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!lockedNote }}
      accessibilityLabel={label}
    >
      {checked ? (
        <LinearGradient colors={PILL_ON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tick}>
          <Icon name="check" size={16} color={PALETTE.white} />
        </LinearGradient>
      ) : (
        <View style={[s.tick, s.tickOff]} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.tileTitle} maxFontSizeMultiplier={1.3}>{label}</Text>
        {description ? <Text style={s.tileSub} maxFontSizeMultiplier={1.3}>{description}</Text> : null}
        {lockedNote ? (
          <View style={s.lock}>
            <Icon name="lock-outline" size={13} color={PALETTE.violetDark} />
            <Text style={s.lockText}>{lockedNote}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ ITR years */

/** The website's FinancialYearsInput: tick three financial years, told what is missing. */
export function YearsPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const options = useMemo(() => financialYears(), []);
  const chosen = useMemo(() => parseYears(value), [value]);
  const carried = chosen.filter((y) => !options.includes(y));
  const short = chosen.length < ITR_YEARS_EXPECTED;

  const toggle = (year: string) => {
    const next = chosen.includes(year) ? chosen.filter((y) => y !== year) : [...chosen, year].sort().reverse();
    onChange(next.join(', '));
  };

  const left = ITR_YEARS_EXPECTED - chosen.length;
  return (
    <View style={{ marginBottom: SPACE.md }}>
      <View style={s.chips}>
        {[...options, ...carried].map((y) => (
          <Pill key={y} label={y} on={chosen.includes(y)} role="checkbox" onPress={() => toggle(y)} />
        ))}
      </View>
      <View style={[s.status, { backgroundColor: short ? PALETTE.amberSoft : PALETTE.greenSoft }]}>
        <Icon name={short ? 'error-outline' : 'check-circle-outline'} size={16} color={short ? PALETTE.amberDark : PALETTE.greenDark} />
        <Text style={[s.statusText, { color: short ? PALETTE.amberDark : PALETTE.greenDark }]}>
          {chosen.length === 0
            ? `Pick ${ITR_YEARS_EXPECTED} financial years.`
            : short
              ? `${chosen.length} of ${ITR_YEARS_EXPECTED} picked — ${left} more ${left === 1 ? 'year' : 'years'} to pick.`
              : `${chosen.length} ${chosen.length === 1 ? 'year' : 'years'} picked.`}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ NIC categories */

/**
 * The website's ProductCategoryInput: search NIC by words or code, pick up to
 * ten, or add a category NIC does not list (stored with an empty code).
 */
export function CategoryPicker({ value, onChange }: { value: ProductCategory[]; onChange: (next: ProductCategory[]) => void }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const [query, setQuery] = useState('');
  const [catalogue, setCatalogue] = useState<NicCategory[] | null>(null);
  const list = value || [];
  const full = list.length >= MAX_PRODUCT_CATEGORIES;
  const trimmed = query.trim();

  const ensureCatalogue = () => {
    if (!catalogue) setCatalogue(loadNicCategories());
  };

  const { results, total } = useMemo(
    () => (catalogue && trimmed ? searchNicCategories(catalogue, trimmed, 20) : { results: [] as NicCategory[], total: 0 }),
    [catalogue, trimmed],
  );
  const known = useMemo(() => (catalogue && trimmed ? isKnownDescription(catalogue, trimmed) : true), [catalogue, trimmed]);

  const add = (c: ProductCategory) => {
    if (full) return;
    if (list.some((x) => sameCategory(x, c))) return;
    onChange([...list, c]);
    setQuery('');
  };
  const remove = (index: number) => onChange(list.filter((_, i) => i !== index));

  return (
    <View style={{ marginBottom: SPACE.md }}>
      {list.length > 0 ? (
        <View style={{ gap: SPACE.sm, marginBottom: SPACE.md }}>
          {list.map((c, i) => (
            <View key={`${c?.code || 'x'}-${c?.description || ''}-${i}`} style={s.catRow}>
              <View style={s.catIcon}><Icon name={c?.industryType === 'Manufacturing' ? 'precision-manufacturing' : 'category'} size={18} color={PALETTE.violet} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.catTitle} numberOfLines={2}>{c?.description || ''}</Text>
                <Text style={s.catMeta} maxFontSizeMultiplier={1.3}>{c?.code ? `NIC ${c.code}${c?.industryType ? ` · ${c.industryType}` : ''}` : 'Your own category'}</Text>
              </View>
              <TouchableOpacity onPress={() => remove(i)} style={s.removeBtn} accessibilityRole="button" accessibilityLabel={`Remove ${c?.description || 'category'}`}>
                <Icon name="close" size={20} color={PALETTE.textFaint} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {full ? (
        <Text style={s.hint}>That is the most a company can list ({MAX_PRODUCT_CATEGORIES}). Remove one to add another.</Text>
      ) : (
        <View style={s.search}>
          <Icon name="search" size={19} color={PALETTE.textFaint} />
          <TextInput
            value={query}
            onChangeText={(t) => { ensureCatalogue(); setQuery(t); }}
            onFocus={ensureCatalogue}
            placeholder="Search a product, service or NIC code"
            placeholderTextColor={PALETTE.textFaint}
            style={s.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="cancel" size={18} color={PALETTE.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {!full && trimmed ? (
        <View style={s.results}>
          {results.map((row) => {
            const taken = list.some((x) => sameCategory(x, row));
            return (
              <TouchableOpacity
                key={row.code}
                disabled={taken}
                onPress={() => add({ code: row.code, description: row.description, industryType: row.industryType })}
                style={[s.result, taken && s.resultTaken]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ disabled: taken, selected: taken }}
                accessibilityLabel={`${row.description}, NIC ${row.code}${taken ? ', added' : ''}`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.resultTitle}>{row.description}</Text>
                  <View style={s.resultMetaRow}>
                    <Text style={s.resultCode} maxFontSizeMultiplier={1.3}>{`NIC ${row.code}`}</Text>
                    <Text style={s.resultMeta} maxFontSizeMultiplier={1.3}>{row.level}</Text>
                    <View style={[s.typePill, row.industryType === 'Manufacturing' ? s.typeM : s.typeS]}>
                      <Text style={[s.typePillText, { color: row.industryType === 'Manufacturing' ? PALETTE.amberDark : PALETTE.violetDark }]} maxFontSizeMultiplier={1.3}>{row.industryType}</Text>
                    </View>
                  </View>
                </View>
                <View style={[s.resultAction, taken && { backgroundColor: PALETTE.card }]}>
                  <Icon name={taken ? 'check' : 'add'} size={18} color={taken ? PALETTE.green : PALETTE.violet} />
                </View>
              </TouchableOpacity>
            );
          })}
          {total > results.length ? <Text style={s.more}>{`Showing ${results.length} of ${total} — keep typing to narrow it down`}</Text> : null}
          {results.length === 0 ? <Text style={s.more}>No NIC category matches “{trimmed}”.</Text> : null}
          {!known ? (
            <TouchableOpacity onPress={() => add({ code: '', description: trimmed, industryType: '' })} style={[s.result, s.custom]} activeOpacity={0.7}>
              <Icon name="add-circle-outline" size={20} color={PALETTE.violet} />
              <Text style={[s.resultTitle, { flex: 1, color: PALETTE.violetDark }]}>{`Add “${trimmed}” as your own category`}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ export councils */

/** The website's ExportCouncilInput: searchable DGFT list, still accepts a body it lacks. */
export function CouncilPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const [query, setQuery] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  const matches = useMemo(
    () => (needle ? EXPORT_COUNCILS.filter((c) => c.name.toLowerCase().includes(needle)) : EXPORT_COUNCILS),
    [needle],
  );
  const exact = EXPORT_COUNCILS.some((c) => c.name.toLowerCase() === needle);
  const showList = browsing || !!trimmed;

  const choose = (name: string) => {
    onChange(name);
    setQuery('');
    setBrowsing(false);
  };

  return (
    <View style={{ marginBottom: SPACE.md }}>
      {value ? (
        <View style={s.catRow}>
          <View style={s.catIcon}><Icon name="public" size={18} color={PALETTE.violet} /></View>
          <Text style={[s.catTitle, { flex: 1 }]}>{value}</Text>
          <TouchableOpacity onPress={() => onChange('')} style={s.removeBtn} accessibilityRole="button" accessibilityLabel="Clear export council">
            <Icon name="close" size={20} color={PALETTE.textFaint} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[s.search, value ? { marginTop: SPACE.sm } : null]}>
        <Icon name="search" size={19} color={PALETTE.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={value ? 'Search to change it' : 'Search — EEPC, APEDA, Spices Board'}
          placeholderTextColor={PALETTE.textFaint}
          style={s.searchInput}
        />
        <TouchableOpacity onPress={() => setBrowsing((b) => !b)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Browse all councils">
          <Icon name={showList ? 'expand-less' : 'expand-more'} size={22} color={PALETTE.textFaint} />
        </TouchableOpacity>
      </View>

      {showList ? (
        <View style={s.results}>
          {matches.map((c) => (
            <TouchableOpacity key={c.name} onPress={() => choose(c.name)} style={[s.result, c.name === value && s.resultTaken]} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: c.name === value }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.resultTitle}>{c.name}</Text>
                <Text style={s.resultMeta}>{c.group}</Text>
              </View>
              {c.name === value ? <Icon name="check" size={20} color={PALETTE.green} /> : null}
            </TouchableOpacity>
          ))}
          {trimmed && !exact ? (
            <TouchableOpacity onPress={() => choose(trimmed)} style={[s.result, s.custom]} activeOpacity={0.7}>
              <Icon name="add-circle-outline" size={20} color={PALETTE.violet} />
              <Text style={[s.resultTitle, { flex: 1, color: PALETTE.violetDark }]}>{`Use “${trimmed}”`}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  // Same metrics as PremiumLabel so free-standing labels line up with PremiumInput ones.
  labelWrap: { marginBottom: SPACE.sm, marginLeft: 2 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft },
  hint: { ...TYPE.small, marginTop: SPACE.xxs },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm, marginLeft: 2 },
  error: { ...TYPE.caption, flex: 1, color: PALETTE.redDark },
  sub: { marginTop: SPACE.xs, marginBottom: SPACE.md, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  subBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: PALETTE.violet },
  subTitle: { ...TYPE.subheading },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: 14, minHeight: 40,
    borderRadius: 999, backgroundColor: PALETTE.fieldBg, borderWidth: 1, borderColor: PALETTE.violetBorder, maxWidth: '100%',
  },
  chipOn: { borderColor: 'transparent' },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft, flexShrink: 1 },
  chipTextOn: { color: PALETTE.white, fontWeight: '700' },

  yesNo: { flexDirection: 'row', gap: SPACE.md },
  yesNoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs + 2, minHeight: 50,
    borderRadius: 14, borderWidth: 1.5, borderColor: PALETTE.violetBorder, backgroundColor: PALETTE.fieldBg,
  },
  yesNoOn: { borderColor: 'transparent' },

  tile: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, padding: SPACE.md, minHeight: SIZE.row,
    borderRadius: 16, borderWidth: 1.5, borderColor: PALETTE.violetBorder, backgroundColor: PALETTE.card, marginBottom: SPACE.sm,
  },
  tileOn: { borderColor: PALETTE.violet, backgroundColor: PALETTE.violetTint },
  tick: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tickOff: { borderWidth: 1.5, borderColor: PALETTE.borderStrong, backgroundColor: PALETTE.card },
  tileTitle: { ...TYPE.bodyStrong },
  tileSub: { ...TYPE.small, marginTop: SPACE.xxs },
  lock: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs + 2, alignSelf: 'flex-start', paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.xs, backgroundColor: PALETTE.violetSoft },
  lockText: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: PALETTE.violetDark, flexShrink: 1 },

  status: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: 12 },
  statusText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingLeft: SPACE.md, paddingVertical: SPACE.xs, minHeight: SIZE.row, borderRadius: 16, backgroundColor: PALETTE.violetTint, borderWidth: 1, borderColor: PALETTE.violetBorder },
  catIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: PALETTE.card, alignItems: 'center', justifyContent: 'center' },
  catTitle: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18 },
  catMeta: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xxs, fontVariant: ['tabular-nums'] },
  removeBtn: { width: SIZE.touch, height: SIZE.touch, alignItems: 'center', justifyContent: 'center' },

  // Matches PremiumInput: 52 tall, soft fill, 14 radius.
  search: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: PALETTE.fieldBg, paddingHorizontal: 14 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, color: PALETTE.text, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
  results: {
    marginTop: SPACE.sm, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border, overflow: 'hidden', backgroundColor: PALETTE.card,
  },
  result: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, minHeight: SIZE.row, borderBottomWidth: 1, borderBottomColor: PALETTE.divider, backgroundColor: PALETTE.card },
  resultTaken: { backgroundColor: PALETTE.greenSoft },
  resultTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: PALETTE.text },
  resultMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xs },
  resultCode: { ...TYPE.caption, fontWeight: '700', color: PALETTE.textSoft, fontVariant: ['tabular-nums'] },
  resultMeta: { ...TYPE.caption },
  resultAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: PALETTE.violetSoft, alignItems: 'center', justifyContent: 'center' },
  custom: { backgroundColor: PALETTE.violetSoft },
  more: { ...TYPE.caption, padding: SPACE.md, backgroundColor: PALETTE.fieldBg },
  typePill: { paddingHorizontal: SPACE.xs + 2, paddingVertical: SPACE.xxs, borderRadius: RADIUS.xs },
  typeM: { backgroundColor: PALETTE.amberSoft },
  typeS: { backgroundColor: PALETTE.violetSoft },
  typePillText: { fontSize: 10, lineHeight: 13, fontWeight: '700' },
});

import { useLegacyAppearance } from '../../../../ui/legacyAppearance';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, RADIUS, SPACE, SIZE, TYPE, BRAND } from '../../../../ui';

const FAINT = PALETTE.textFaint;

/**
 * A region name field: a full dropdown, free text, and a "+" to add what is
 * missing.
 *
 * Three ways to fill it, in the order a Super Admin reaches for them:
 *
 *   1. **Open the list** (chevron) and pick. The list is the complete set for
 *      this scope — every state in India, every district in the chosen state,
 *      every block in the chosen district — never a truncated sample. A count
 *      sits in each heading so it is obvious nothing has been held back.
 *   2. **Type to narrow.** The same list filters as you type.
 *   3. **Type something that is not there and press "+".** The reference data
 *      does not know every block in the country; this is the escape hatch. The
 *      name joins the dropdown immediately, so a second admin for that same new
 *      region is picked from the list rather than retyped — which is the point,
 *      since the geofence matches an admin's region against an application's
 *      with an anchored regex, and "Ariyalur" and "ariyalur " would be two
 *      regions splitting one queue.
 *
 * Three groups are offered, and the distinction matters:
 *   - **Added now** — typed on this form and not yet saved.
 *   - **Already in use** — a region that already has an admin. Picking one
 *     joins it, and the new admin shares that queue.
 *   - **All <regions>** — the canonical India reference, nobody staffs it yet.
 *     Picking one creates the region on save.
 *
 * Not a native `<Modal>`: this renders inside a bottom-tab screen, where a
 * transparent modal in a nested navigator throws BadTokenException on Android
 * 14+ and kills the process. The panel is an inline card, and its scroll view
 * carries `nestedScrollEnabled` so it still scrolls inside the form's own
 * scroll view on Android.
 */

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Regions that already have an admin. Selecting one joins it. */
  inUse?: string[];
  /** Reference names with no admin yet. Selecting one creates the region. */
  suggested?: string[];
  /** Names added on this form with "+", not yet saved anywhere. */
  extra?: string[];
  /** Called when "+" is pressed with a name that is in none of the lists. */
  onAdd?: (name: string) => void;
  /** Called when an added-but-unsaved name is removed from the list again. */
  onRemove?: (name: string) => void;
  /** Describes where the reference list came from, e.g. "in Tamil Nadu". */
  scopeLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}

/**
 * A ceiling on rows rendered per group, not on rows offered.
 *
 * Real scopes sit far below it — 36 states, at most ~75 districts in a state,
 * ~30 blocks in a district — so in practice every option is on screen. It
 * exists only so a pathological list cannot stall the UI thread, and when it
 * does bite the footer says exactly how many are hidden rather than quietly
 * cutting the list short.
 */
const MAX_RENDER = 150;

const clean = (value?: string | null) => String(value || '').trim();

/**
 * How far wrong a typed name may be and still be offered — the website's
 * `editBudget`: proportional to length, capped at three.
 */
const editBudget = (needle: string) => Math.min(3, Math.max(1, Math.floor((needle || '').length / 4)));

/**
 * Levenshtein distance, abandoned as soon as it cannot come in under `budget`
 * (website RegionInput `editDistance`). Returns `budget + 1` for "too far".
 */
const editDistance = (a: string, b: string, budget: number): number => {
  const x = a || '';
  const y = b || '';
  if (Math.abs(x.length - y.length) > budget) return budget + 1;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const row = new Array<number>(y.length + 1);
    row[0] = i;
    let best = row[0];
    for (let j = 1; j <= y.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
      if (row[j] < best) best = row[j];
    }
    if (best > budget) return budget + 1;
    prev = row;
  }
  return prev[y.length];
};

/** Below this length most short names are within tolerance of each other. */
const NEAR_MIN_LENGTH = 3;

const eq = (a?: string | null, b?: string | null) =>
  clean(a).toLowerCase() === clean(b).toLowerCase();

/** Case-insensitive de-duplication that keeps the first spelling seen. */
const unique = (names: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  (names || []).forEach(name => {
    const value = clean(name);
    if (!value) return;
    const k = value.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(value);
  });
  return out;
};

const RegionInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  inUse = [],
  suggested = [],
  extra = [],
  onAdd,
  onRemove,
  scopeLabel = '',
  placeholder = 'Type a name',
  disabled = false,
  hint = '',
}) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [open, setOpen] = useState(false);

  // A disabled field (no parent region chosen yet) must not keep a panel open
  // from before — the list under it belongs to a scope that no longer applies.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const typed = clean(value);
  const needle = typed.toLowerCase();

  const addedList = useMemo(() => unique(extra), [extra]);
  const usedList = useMemo(() => unique(inUse), [inUse]);

  // A reference name that is already staffed, or was just added, belongs to that
  // group only — otherwise the same name appears twice with contradictory
  // meanings ("joins it" and "creates it").
  const referenceList = useMemo(
    () => unique(suggested).filter(
      name => !usedList.some(used => eq(used, name)) && !addedList.some(add => eq(add, name)),
    ),
    [suggested, usedList, addedList],
  );

  /**
   * Substring first, and a near-miss pass behind it — ONLY when the substring
   * pass found nothing (CLAUDE.md §4b), so "karanataka" offers Karnataka
   * instead of offering to create a 37th state. `near` marks the result as
   * approximate so the panel can say so rather than present a guess as a match.
   */
  const narrow = (list: string[]): { names: string[]; near: boolean } => {
    const source = list || [];
    if (!needle) return { names: source, near: false };
    const exact = source.filter(name => (name || '').toLowerCase().includes(needle));
    if (exact.length || typed.length < NEAR_MIN_LENGTH) return { names: exact, near: false };
    const budget = editBudget(needle);
    const near = source
      .map(name => ({ name, distance: editDistance(needle, (name || '').toLowerCase(), budget) }))
      .filter(row => row.distance <= budget)
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
      .map(row => row.name);
    return { names: near, near: near.length > 0 };
  };

  const addedResult = useMemo(() => narrow(addedList), [addedList, needle]);
  const usedResult = useMemo(() => narrow(usedList), [usedList, needle]);
  const referenceResult = useMemo(() => narrow(referenceList), [referenceList, needle]);
  const addedMatches = addedResult.names;
  const usedMatches = usedResult.names;
  const referenceMatches = referenceResult.names;

  /** Every group that found anything found it only approximately. */
  const approximate = [addedResult, usedResult, referenceResult].some(r => r.near)
    && [addedResult, usedResult, referenceResult].every(r => r.near || r.names.length === 0);

  const totalMatches = addedMatches.length + usedMatches.length + referenceMatches.length;

  /** True when the typed name is nowhere in the dropdown, so "+" can add it. */
  const canAdd = useMemo(() => {
    if (!typed) return false;
    return ![...addedList, ...usedList, ...referenceList].some(name => eq(name, typed));
  }, [typed, addedList, usedList, referenceList]);

  /** True when no admin covers this name yet — i.e. saving opens the region. */
  const isNew = useMemo(
    () => !!typed && !usedList.some(used => eq(used, typed)),
    [usedList, typed],
  );

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const add = () => {
    if (!canAdd) return;
    if (typeof onAdd === 'function') onAdd(typed);
    onChange(typed);
    setOpen(true);
  };

  const remove = (name: string) => {
    if (typeof onRemove === 'function') onRemove(name);
  };

  /**
   * `removable` is true for the "Added now" group only.
   *
   * Those names exist nowhere but this form, so removing one is a plain undo of
   * the "+" that put it there. The other two groups are not the list's to
   * delete: a staffed region is deleted by deleting the admins who hold it —
   * which is what the Delete button on an admin row does, with a preview of the
   * applications it would escalate — and a reference name is shared by every
   * Super Admin, not this one's to remove.
   */
  const renderGroup = (
    heading: string,
    names: string[],
    icon: string,
    color: string,
    removable = false,
  ) => {
    if ((names || []).length === 0) return null;
    const shown = names.slice(0, MAX_RENDER);
    const hidden = names.length - shown.length;
    return (
      <View key={heading}>
        <Text style={styles.groupHeading}>{`${heading} · ${names.length}`}</Text>
        {shown.map(name => {
          const selected = eq(name, typed);
          return (
            <TouchableOpacity
              key={`${heading}:${name}`}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => pick(name)}
              activeOpacity={0.7}
            >
              <Icon name={icon} size={16} color={color} />
              <Text style={styles.optionText} numberOfLines={1}>{name}</Text>
              {selected ? <Icon name="done" size={16} color={PALETTE.successText} /> : null}
              {removable ? (
                <TouchableOpacity
                  onPress={() => remove(name)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={`Remove ${name} from the ${label.toLowerCase()} list`}
                >
                  <Icon name="close" size={16} color={PALETTE.danger} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        })}
        {hidden > 0 ? (
          <Text style={styles.moreNote}>
            {`${hidden} more — keep typing to narrow the list.`}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW REGION</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.field, open && !disabled && styles.fieldOpen, disabled && styles.inputDisabled, isNew && styles.inputNew]}>
        <Icon name={label.toLowerCase() === 'state' ? 'public' : label.toLowerCase() === 'district' ? 'map' : 'place'} size={SIZE.icon} color={open && !disabled ? PALETTE.indigo : PALETTE.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={next => {
            onChange(next);
            if (!disabled) setOpen(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={FAINT}
          editable={!disabled}
          autoCapitalize="words"
          autoCorrect={false}
          onFocus={() => { if (!disabled) setOpen(true); }}
        />
        </View>

        {canAdd && !disabled ? (
          <TouchableOpacity
            style={[styles.iconButton, styles.addButton]}
            onPress={add}
            activeOpacity={0.75}
            accessibilityLabel={`Add ${typed} to the ${label.toLowerCase()} list`}
          >
            <Icon name="add" size={22} color={PALETTE.white} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.iconButton, disabled && styles.inputDisabled]}
          onPress={() => { if (!disabled) setOpen(prev => !prev); }}
          activeOpacity={0.75}
          accessibilityLabel={
            open ? `Hide the ${label.toLowerCase()} list` : `Show the ${label.toLowerCase()} list`
          }
        >
          <Icon name={open ? 'expand-less' : 'expand-more'} size={22} color={FAINT} />
        </TouchableOpacity>
      </View>

      {canAdd && !disabled ? (
        <Text style={styles.newHint}>
          {approximate
            ? `“${typed}” is not in the list — check the closest names below before pressing +.`
            : `“${typed}” is not in the list — press + to add it${scopeLabel ? ` ${scopeLabel}` : ''}.`}
        </Text>
      ) : isNew ? (
        <Text style={styles.newHint}>
          No admin covers “{typed}” yet — saving creates it and opens it for applicants.
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      {open && !disabled ? (
        <View style={styles.panel}>
          {totalMatches === 0 ? (
            <Text style={styles.emptyNote}>
              {typed
                ? 'Nothing matches. Press + to add it.'
                : 'No options loaded yet for this scope — type a name and press + to add one.'}
            </Text>
          ) : (
            <ScrollView
              style={styles.panelScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {approximate ? (
                <Text style={styles.nearNote}>
                  {`Nothing matches “${typed}” exactly. Closest names below — pick one, or press + to open “${typed}” as a new region.`}
                </Text>
              ) : null}
              {renderGroup('Added now', addedMatches, 'fiber-new', PALETTE.warningText, true)}
              {renderGroup('Already in use', usedMatches, 'check-circle', PALETTE.successText)}
              {renderGroup(
                `All ${label.toLowerCase()}s${scopeLabel ? ` ${scopeLabel}` : ''}`,
                referenceMatches,
                'add-circle-outline',
                FAINT,
              )}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACE.lg },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft, marginBottom: SPACE.sm, marginLeft: 2 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  field: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm + 2, minHeight: 52,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: BRAND.inputFillAdmin, paddingHorizontal: SPACE.md + 2,
  },
  fieldOpen: { borderColor: PALETTE.indigo, backgroundColor: PALETTE.white },
  input: { flex: 1, minWidth: 0, fontSize: 15, color: PALETTE.text, paddingVertical: 10 },
  inputDisabled: { opacity: 0.55 },
  inputNew: { borderColor: PALETTE.warning, backgroundColor: PALETTE.card },

  iconButton: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
  },
  addButton: { backgroundColor: PALETTE.warningText, borderColor: PALETTE.warningText },

  newBadge: {
    paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, borderRadius: RADIUS.pill,
    backgroundColor: PALETTE.warningSoft, marginBottom: 6,
  },
  newBadgeText: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: PALETTE.warningText, letterSpacing: 0.4 },

  hint: { ...TYPE.caption, marginTop: 6, marginLeft: 2 },
  newHint: { ...TYPE.caption, color: PALETTE.warningText, marginTop: 6, marginLeft: 2 },

  panel: {
    marginTop: SPACE.sm,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 14,
    overflow: 'hidden',
    paddingVertical: SPACE.xs,
    shadowColor: BRAND.indigoDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  panelScroll: { maxHeight: 264 },
  groupHeading: {
    ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, color: PALETTE.textFaint,
    paddingHorizontal: 14, paddingTop: SPACE.sm, paddingBottom: SPACE.xs,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: SIZE.touch,
    paddingHorizontal: 14, paddingVertical: SPACE.sm,
  },
  optionSelected: { backgroundColor: PALETTE.indigoSoft },
  optionText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, color: PALETTE.text },
  moreNote: {
    ...TYPE.caption, fontSize: 11, color: PALETTE.textFaint,
    paddingHorizontal: 14, paddingVertical: SPACE.sm, fontStyle: 'italic',
  },
  nearNote: {
    ...TYPE.caption, lineHeight: 17, color: PALETTE.warningText, backgroundColor: PALETTE.warningSoft,
    paddingHorizontal: 14, paddingVertical: SPACE.md - 2,
  },
  emptyNote: {
    ...TYPE.caption, lineHeight: 17, color: PALETTE.textMuted,
    paddingHorizontal: 14, paddingVertical: SPACE.md,
  },
});

export default RegionInput;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;

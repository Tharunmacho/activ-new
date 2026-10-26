import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleButton, ConsoleNote, ConsoleSearch,
  ConsoleSkeleton, ConsoleState, ConsoleSectionTitle, GlassIconButton, PremiumInput,
} from '../../../ui';
import {
  listEventCategories, addEventCategory, renameEventCategory, deleteEventCategory, moveEventCategory, addStandardEventCategories,
  EventCategory, EventCategoryList, CategoryMode, errorText,
} from '../../../services/superApi';
import { ChipRow, MiniAction, confirm } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — Event categories (website /super-admin/events/categories)
 * ============================================================================
 *
 * The list an event is filed under, and the filter chips above the public
 * events page — the same rows. GET/POST /events/categories, PUT/DELETE
 * /events/categories/:id, POST …/:id/move { direction }, POST …/standard.
 *
 * As on the website: four figures (listed, events filed, not listed, standard
 * missing of 13), a For filter with counts, a search, a row per category with
 * its kind of event, event count and order, and — for a label events carry
 * with no chip — "Add to list". Renaming re-files every event carrying the old
 * name, and the notice says how many moved (`moved` from the server).
 * Editing happens in an inline card (no modal).
 */

const MODE_META: Record<CategoryMode, { pick: string; short: string; noun: string }> = {
  both: { pick: 'For both kinds of event', short: 'Both', noun: 'both kinds of' },
  offline: { pick: 'In-person events only', short: 'In person', noun: 'in-person' },
  online: { pick: 'Online events only', short: 'Online', noun: 'online' },
};
const MODE_ORDER: CategoryMode[] = ['both', 'offline', 'online'];
const MODES = MODE_ORDER.map((m) => ({ value: m, label: MODE_META[m].pick }));

/** Listed categories in their chip order first; unlisted labels after. */
const compare = (a: EventCategory, b: EventCategory) => {
  if (!!a?.managed !== !!b?.managed) return a?.managed ? -1 : 1;
  return Number(a?.order || 0) - Number(b?.order || 0);
};

function CategoryCard({ c, index, first, last, busy, editing, onEdit, onUp, onDown, onDelete, onList, children }: {
  c: EventCategory; index: number; first: boolean; last: boolean; busy: boolean; editing: boolean;
  onEdit: () => void; onUp: () => void; onDown: () => void; onDelete: () => void; onList: () => void; children?: React.ReactNode;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const count = Number(c?.eventCount || 0);
  return (
    <ConsoleCard style={s.card}>
      <View style={s.row}>
        <Text style={s.sno}>{index + 1}</Text>
        <View style={s.icon}><Icon name="sell" size={20} color={PALETTE.indigo} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={2}>{c?.label}</Text>
          <Text style={s.sub}>
            {c?.managed ? `For: ${MODE_META[(c?.mode as CategoryMode) || 'both']?.short || 'Both'}` : 'For: —'}
            {' · '}{count ? `${count} event${count === 1 ? '' : 's'}` : 'no events'}
          </Text>
        </View>
        {!c?.managed ? <ConsoleChip label="Not listed" kind="warning" /> : null}
      </View>
      {c?.managed ? (
        <View style={s.actions}>
          <TouchableOpacity onPress={onUp} disabled={first || busy} style={[s.arrow, (first || busy) && { opacity: 0.3 }]} accessibilityLabel="Move up"><Icon name="arrow-upward" size={18} color={PALETTE.textSoft} /></TouchableOpacity>
          <TouchableOpacity onPress={onDown} disabled={last || busy} style={[s.arrow, (last || busy) && { opacity: 0.3 }]} accessibilityLabel="Move down"><Icon name="arrow-downward" size={18} color={PALETTE.textSoft} /></TouchableOpacity>
          <View style={s.flex} />
          <MiniAction icon={editing ? 'close' : 'edit'} label={editing ? 'Close' : 'Edit'} onPress={onEdit} disabled={busy} />
          <MiniAction icon="delete-outline" label="Remove" color={PALETTE.red} onPress={onDelete} disabled={busy} />
        </View>
      ) : (
        <View style={s.actions}>
          <Text style={[s.sub, s.flexFlush]}>Events carry this label but no chip offers it on the public events page.</Text>
          <MiniAction icon="add" label="Add to list" onPress={onList} disabled={busy} />
        </View>
      )}
      {editing ? children : null}
    </ConsoleCard>
  );
}

const SuperEventCategoriesScreen: React.FC = () => {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const navigation = useNavigation<any>();
  const [data, setData] = useState<EventCategoryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [writeError, setWriteError] = useState('');
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<CategoryMode>('both');
  const [busy, setBusy] = useState('');
  const [editId, setEditId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editMode, setEditMode] = useState<CategoryMode>('both');
  const [modeFilter, setModeFilter] = useState<'all' | CategoryMode>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try { setData(await listEventCategories()); } catch (err) { setError(errorText(err, 'The categories could not be loaded')); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // The success line clears itself, as on the website.
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const run = async (key: string, fn: () => Promise<EventCategoryList>, message?: (d: EventCategoryList) => string) => {
    setBusy(key);
    setWriteError('');
    try {
      const next = await fn();
      setData(next);
      if (message) setNotice(message(next));
      return true;
    } catch (err) {
      setWriteError(errorText(err, 'That change could not be saved'));
      return false;
    } finally { setBusy(''); }
  };

  const submitNew = async () => {
    const l = (label || '').trim();
    if (!l) return;
    const m = mode;
    const ok = await run('new', () => addEventCategory(l, m), () => `“${l}” added${m === 'both' ? '' : ` for ${MODE_META[m].noun} events`}`);
    if (ok) { setLabel(''); setMode('both'); setAdding(false); }
  };
  const startEdit = (c: EventCategory) => {
    if (editId === c.id) { setEditId(''); return; }
    setEditId(c.id); setEditLabel(c.label || ''); setEditMode((c.mode as CategoryMode) || 'both');
  };
  /** Name and kind are two writes on the website (a rename, a `mode` select); one card here. */
  const saveEdit = async (c: EventCategory) => {
    const l = (editLabel || '').trim();
    if (!l) return;
    const renamed = l !== c.label;
    const modeChanged = editMode !== c.mode;
    if (!renamed && !modeChanged) { setEditId(''); return; }
    const ok = await run(c.id, () => renameEventCategory(c.id, l, modeChanged ? editMode : undefined), (d) => {
      const parts: string[] = [];
      if (renamed) {
        const moved = Number(d?.moved || 0);
        parts.push(moved ? `Renamed to “${l}”, and moved ${moved} event${moved === 1 ? '' : 's'} onto it` : `Renamed to “${l}”`);
      }
      if (modeChanged) parts.push(`${renamed ? 'it' : `“${l}”`} is now for ${MODE_META[editMode].noun} events`);
      return parts.join('; ');
    });
    if (ok) setEditId('');
  };
  const remove = async (c: EventCategory) => {
    const n = Number(c?.eventCount || 0);
    const warning = n
      ? `\n\n${n} event${n === 1 ? ' is' : 's are'} filed under it. They keep the label and will show here as “not listed”, but the public events page will no longer offer it as a filter.`
      : '';
    if (!(await confirm('Remove category?', `Remove “${c.label}” from the category list?${warning}`, 'Remove', true))) return;
    await run(c.id, () => deleteEventCategory(c.id), () => `“${c.label}” removed`);
  };
  const addToList = (c: EventCategory) => run(c.label, () => addEventCategory(c.label), () => `“${c.label}” added to the list`);

  const cats: EventCategory[] = useMemo(() => [...(Array.isArray(data?.categories) ? data?.categories || [] : [])].sort(compare), [data]);
  const managed = useMemo(() => cats.filter((c) => c?.managed), [cats]);
  const missing: string[] = Array.isArray(data?.missingStandard) ? data?.missingStandard || [] : [];

  const stats = useMemo(() => ({
    listed: managed.length,
    unlisted: cats.length - managed.length,
    used: cats.filter((c) => Number(c?.eventCount || 0) > 0).length,
    events: cats.reduce((sum, c) => sum + Number(c?.eventCount || 0), 0),
  }), [cats, managed]);

  const visible = useMemo(() => {
    const needle = (query || '').trim().toLowerCase();
    return cats
      .filter((c) => modeFilter === 'all' || (c?.managed && c?.mode === modeFilter))
      .filter((c) => !needle || String(c?.label || '').toLowerCase().includes(needle));
  }, [cats, modeFilter, query]);

  const countFor = (m: 'all' | CategoryMode) => (m === 'all' ? cats.length : cats.filter((c) => c?.managed && c?.mode === m).length);

  return (
    <ConsoleScroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PALETTE.indigo} />}>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · events"
        title="Event categories"
        subtitle="The event form's list and the public filter chips"
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />}
        right={<GlassIconButton icon={adding ? 'close' : 'add'} accessibilityLabel={adding ? 'Close' : 'Add category'}
          onPress={() => { setAdding((v) => !v); setEditId(''); }} />}
      />

      {loading && !data ? <ConsoleSkeleton variant="tiles" style={s.tilesSkeleton} /> : (
        <ConsoleGrid overlap>
          <ConsoleStatTile label="Categories" hint="on the public filter bar" value={stats.listed} icon="sell" accent="indigo" />
          <ConsoleStatTile label="Events filed" hint={`${stats.used} categor${stats.used === 1 ? 'y' : 'ies'} in use`} value={stats.events} icon="event" accent="sky" delay={60} />
          <ConsoleStatTile label="Not listed" hint="labels events carry, with no chip" value={stats.unlisted} icon="warning-amber"
            accent={stats.unlisted ? 'amber' : 'slate'} delay={120} />
          <ConsoleStatTile label="Standard missing" hint="of the association's 13" value={missing.length} icon="auto-awesome" accent="green" delay={180} />
        </ConsoleGrid>
      )}

      {writeError ? <ConsoleNote kind="red" icon="error-outline" text={writeError} style={s.note} /> : null}
      {notice ? <ConsoleNote kind="green" icon="check-circle-outline" text={notice} style={s.note} /> : null}

      {adding ? (
        <ConsoleCard style={s.addCard}>
          <Text style={s.title}>Add a category</Text>
          <Text style={[s.sub, s.flush, s.gapBottom]}>It appears in the event form straight away, and as a filter chip on the public events page.</Text>
          <PremiumInput tone="admin" value={label} onChangeText={setLabel} placeholder="Medical, Awareness, Coffee Meet…" icon="add" returnKeyType="done" onSubmitEditing={submitNew} autoFocus />
          <View style={s.bleed}><ChipRow<CategoryMode> options={MODES} value={mode} onChange={setMode} /></View>
          <ConsoleButton label="Add" icon="check" onPress={submitNew} loading={busy === 'new'} disabled={!(label || '').trim()} style={s.gapTop} />
        </ConsoleCard>
      ) : null}

      {missing.length ? (
        <ConsoleCard style={s.addCard} accent={PALETTE.amber}>
          <Text style={[s.title, s.amberTitle]}>{missing.length} of the standard categories are not listed</Text>
          <Text style={[s.sub, s.flush]}>{missing.join(' · ')}. Adding them changes nothing that is already here — it only fills the gaps.</Text>
          <ConsoleButton kind="soft" icon="add" label="Add the missing ones" loading={busy === 'standard'} disabled={!!busy && busy !== 'standard'}
            onPress={() => run('standard', addStandardEventCategories, (d) => `${(Array.isArray(d?.added) ? d.added : []).length} categories added`)}
            style={s.gapTop} />
        </ConsoleCard>
      ) : null}

      <ConsoleSectionTitle title="Categories" subtitle="In the order the public filter chips show them" icon="sell" style={s.section} />
      <View>
        <ChipRow<'all' | CategoryMode> value={modeFilter} onChange={setModeFilter}
          options={(['all', ...MODE_ORDER] as ('all' | CategoryMode)[]).map((m) => ({ value: m, label: `${m === 'all' ? 'All' : MODE_META[m].short} · ${countFor(m)}` }))} />
      </View>
      <ConsoleSearch placeholder="Search a category" value={query} onChangeText={setQuery} style={s.search} />

      <View>
        {loading && !data ? <ConsoleSkeleton rows={3} /> : error && !data ? (
          <ConsoleState kind="error" title="Could not load the categories" message={error} action="Try again" onAction={() => load()} />
        ) : cats.length === 0 ? (
          <ConsoleState title="No categories yet" message="Add one above, or take the association's standard list." />
        ) : visible.length === 0 ? (
          <ConsoleState title="Nothing matches" message="No category answers the filter and search above." />
        ) : visible.map((c, i) => {
          const idx = managed.findIndex((m) => m.id === c.id);
          return (
            <CategoryCard key={c.id || `unlisted:${c.label}`} c={c} index={i} first={idx <= 0} last={idx < 0 || idx === managed.length - 1}
              busy={!!busy} editing={editId === c.id && !!c.id}
              onEdit={() => startEdit(c)} onUp={() => run(c.id, () => moveEventCategory(c.id, 'up'))} onDown={() => run(c.id, () => moveEventCategory(c.id, 'down'))}
              onDelete={() => remove(c)} onList={() => addToList(c)}>
              <View style={s.edit}>
                <PremiumInput tone="admin" label="Name" value={editLabel} onChangeText={setEditLabel} />
                <Text style={s.fieldLabel}>Which kind of event it is for</Text>
                <View style={s.bleed}><ChipRow<CategoryMode> options={MODES} value={editMode} onChange={setEditMode} /></View>
                <ConsoleButton label="Save" icon="check" onPress={() => saveEdit(c)} loading={busy === c.id} style={s.gapTop} />
              </View>
            </CategoryCard>
          );
        })}
      </View>

      <ConsoleNote
        style={s.note}
        icon="info-outline"
        text="Renaming is not cosmetic. A category is stored on an event as its name, so renaming one here also re-files every event carrying the old name — the screen says how many moved. Removing one leaves those events alone; they keep the label and reappear as “not listed”, and the public events page stops offering it as a filter."
      />
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  tilesSkeleton: { marginTop: -30 },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  addCard: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  bleed: { marginHorizontal: -SPACE.lg },
  gapTop: { marginTop: SPACE.md },
  gapBottom: { marginBottom: SPACE.md },
  title: { ...TYPE.subheading, fontWeight: '800', marginBottom: SPACE.sm },
  amberTitle: { color: PALETTE.amberDark, marginBottom: 4 },
  flush: { marginTop: 0 },
  flexFlush: { flex: 1, minWidth: 0, marginTop: 0 },
  section: { marginTop: SPACE.xl },
  search: { marginTop: SPACE.md, marginBottom: SPACE.sm },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  sno: { width: 20, fontSize: 13, fontWeight: '800', color: PALETTE.textFaint, textAlign: 'center' },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: PALETTE.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  name: { ...TYPE.subheading, fontWeight: '800' },
  sub: { ...TYPE.caption, marginTop: 2, lineHeight: 17 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: SPACE.md },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: PALETTE.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  edit: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: PALETTE.textSoft },
});

export default SuperEventCategoriesScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;

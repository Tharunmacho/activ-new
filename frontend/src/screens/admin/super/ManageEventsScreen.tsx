import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { resolveMediaUrl } from '../../../config/api.config';
import {
  PALETTE, SPACE, TYPE, BRAND,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs, ConsoleSearch,
  ConsoleSkeleton, ConsoleState, ConsoleNote, ConsoleButton, ConsolePill, GlassIconButton, EventCalendar3D, CONSOLE_LIST,
  PressableScale, FitImage } from '../../../ui';
import { listCmsEventsForEditor, deleteCmsEvent, errorText, type CmsEventRow } from '../../../services/superApi';
import { useSuperAdminBack } from './useSuperAdminBack';
import { ChipRow, confirm } from './superKit';
import { hasBeenHeld, isOnPublicSite, listWhen } from './events/eventKit';
import { MenuButton } from '../shared/TierMenu';

/**
 * ============================================================================
 * SUPER ADMIN → EVENTS — the "Events" bottom tab (website /super-admin/events,
 * EventsManager with channel "members")
 * ============================================================================
 *
 *   GET    /cms/events       every event, drafts / members-only / targeted
 *   DELETE /cms/events/:id
 *   create / edit           → SuperEventEditor (its own stack screen, as the
 *                             website opens the form as its own screen)
 *
 * The list mirrors the website's: Upcoming / Past tabs with counts, a filter by
 * audience built from the targets actually in use, a search over everything a
 * person might recognise an event by, and on every row the facts the status
 * column cannot carry — members-only, on the onboarding site or members only,
 * registration open or not, and who it reaches. A blank title reads “Untitled
 * event”; an undated event reads “Date to be confirmed”, never a dash.
 *
 * The website files Categories, Bookings and Attendance under Events, so this
 * tab carries the shortcuts to them (SuperEventCategories, SuperBookings,
 * SuperEventAttendance). A tab: no native Modal here (Rule 2).
 */

type When = 'upcoming' | 'past';

function EventCard({ e, onEdit, onDelete, onQr }: { e: CmsEventRow; onEdit: () => void; onDelete: () => void; onQr: () => void }) {
  const banner = resolveMediaUrl(e?.media?.url || e?.imageUrl || '');
  const published = e?.status === 'published';
  const onPublic = isOnPublicSite(e);
  const where = e?.mode === 'online'
    ? `Online${e?.onlinePlatform ? ` · ${e.onlinePlatform}` : ''}`
    : (e?.venue || e?.location || '');
  const title = String(e?.title || '').trim();
  return (
    <ConsoleCard style={s.card} padded={false} onPress={onEdit} accent={published ? undefined : PALETTE.amber}
      accessibilityLabel={`Edit ${title || 'Untitled event'}`}>
      {banner ? (
        <FitImage uri={banner} style={s.banner} fit={e?.media?.fit === 'cover' ? 'cover' : 'contain'} />
      ) : (
        <View style={[s.banner, s.bannerEmpty]}><Icon name="event" size={30} color="#A5B4FC" /></View>
      )}
      <View style={s.statusFloat}>
        <ConsoleChip label={published ? 'Published' : 'Draft'} kind={published ? 'approved' : 'pending'} />
      </View>
      <View style={s.body}>
        {title
          ? <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{title}</Text>
          : <Text style={[s.title, s.untitled]} maxFontSizeMultiplier={1.3}>Untitled event</Text>}

        <View style={s.badges}>
          {e?.audience === 'paid' ? <ConsoleChip icon="lock" label="Members" kind="info" /> : null}
          {onPublic
            ? <ConsoleChip icon="language" label="Onboarding" kind="approved" />
            : <ConsoleChip icon="lock-outline" label="Members only" kind="neutral" />}
          {e?.registrationEnabled
            ? <ConsoleChip icon="how-to-reg" label="Registration open" kind="approved" />
            : <ConsoleChip icon="block" label="No registration" kind="warning" />}
          {e?.category ? <ConsoleChip icon="sell" label={String(e.category)} kind="info" /> : null}
        </View>

        <View style={s.meta}>
          <Icon name="schedule" size={15} color={PALETTE.textMuted} />
          <Text style={[s.metaText, !e?.startAt && s.italic]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {e?.startAt ? (listWhen(e.startAt) || 'Date to be confirmed') : 'Date to be confirmed'}
          </Text>
        </View>
        <View style={s.meta}>
          <Icon name={e?.mode === 'online' ? 'videocam' : 'place'} size={15} color={PALETTE.textMuted} />
          <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{where || 'Venue to be confirmed'}</Text>
        </View>
        <View style={[s.reach, e?.targetLabel ? s.reachOn : null]}>
          <Icon name={e?.targetLabel ? 'my-location' : 'public'} size={14} color={e?.targetLabel ? PALETTE.indigoDark : PALETTE.textMuted} />
          <Text style={[s.reachText, e?.targetLabel ? { color: PALETTE.indigoDark } : null]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {e?.targetLabel ? `${e.targetLabel} only` : 'Everyone'}
          </Text>
        </View>

        <View style={s.actions}>
          <ConsolePill icon="edit" label="Edit" onPress={onEdit} />
          <ConsolePill icon="qr-code-2" label="QR" onPress={onQr} color={PALETTE.textSoft} />
          <View style={s.flex} />
          <TouchableOpacity onPress={onDelete} style={s.delete} accessibilityRole="button" accessibilityLabel={`Delete ${title || 'this event'}`} hitSlop={6}>
            <Icon name="delete-outline" size={20} color={PALETTE.red} />
          </TouchableOpacity>
        </View>
      </View>
    </ConsoleCard>
  );
}

/** A shortcut tile under the header — Bookings, Categories, Attendance. */
function Shortcut({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={s.shortcutCell} contentStyle={s.shortcut} accessibilityRole="button" accessibilityLabel={`${label}, ${hint}`}>
      <View style={s.shortcutIcon}><Icon name={icon} size={20} color={PALETTE.indigo} /></View>
      <Text style={s.shortcutLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
      <Text style={s.shortcutHint} numberOfLines={2} maxFontSizeMultiplier={1.2}>{hint}</Text>
    </PressableScale>
  );
}

const ManageEventsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [events, setEvents] = useState<CmsEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [when, setWhen] = useState<When>('upcoming');
  const [target, setTarget] = useState('all');
  const [query, setQuery] = useState('');

  useSuperAdminBack(); // hardware back returns to the Hub

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'load') setLoading(true);
    setError('');
    try {
      const list = await listCmsEventsForEditor();
      setEvents(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(errorText(err, 'Could not load events'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch on every return from the editor, without blanking the list.
  const loadedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    load(loadedOnce.current ? 'quiet' : 'load');
    loadedOnce.current = true;
  }, [load]));

  const all = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const targetOf = (e: CmsEventRow) => e?.targetLabel || 'Everyone';
  const targetOptions = useMemo(() => Array.from(new Set(all.map(targetOf)))
    .sort((a, b) => (a === 'Everyone' ? -1 : b === 'Everyone' ? 1 : a.localeCompare(b))), [all]);
  const upcomingCount = useMemo(() => all.filter((e) => !hasBeenHeld(e)).length, [all]);
  const pastCount = all.length - upcomingCount;
  const publishedCount = useMemo(() => all.filter((e) => e?.status === 'published').length, [all]);
  const publicCount = useMemo(() => all.filter((e) => isOnPublicSite(e)).length, [all]);

  const visible = useMemo(() => {
    const needle = (query || '').trim().toLowerCase();
    return all
      .filter((e) => target === 'all' || targetOf(e) === target)
      .filter((e) => (when === 'past' ? hasBeenHeld(e) : !hasBeenHeld(e)))
      .filter((e) => !needle || [e?.title, e?.venue, e?.category, e?.state, e?.district, e?.block, e?.description, e?.targetLabel]
        .filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [all, target, when, query]);

  const openNew = useCallback(() => navigation.navigate('SuperEventEditor', {}), [navigation]);
  const openEdit = useCallback((e: CmsEventRow) => navigation.navigate('SuperEventEditor', { event: e }), [navigation]);

  const remove = useCallback(async (e: CmsEventRow) => {
    const ok = await confirm('Delete event', `Delete “${e?.title || 'Untitled event'}”? This removes it from public view. Bookings, payments and attendance remain available in Event Bookings.`, 'Delete', true);
    if (!ok) return;
    try {
      await deleteCmsEvent(String(e?.id || ''));
      setEvents((prev) => (prev || []).filter((x) => x?.id !== e?.id));
      load('quiet');
    } catch (err) {
      Alert.alert('Could not delete the event', errorText(err));
    }
  }, [load]);

  const renderItem = useCallback(({ item }: { item: CmsEventRow }) => (
    <EventCard e={item} onEdit={() => openEdit(item)} onDelete={() => remove(item)}
      onQr={() => navigation.navigate('SuperEventQr', { event: item, justCreated: false })} />
  ), [openEdit, remove, navigation]);

  const header = (
    <>
      <ConsoleHeader
        eyebrow="Super Admin · events"
        title="Events"
        subtitle="Aim an event at a state, district or block and every member there sees it — paid or unpaid."
        left={<MenuButton />}
        right={<GlassIconButton icon="add" accessibilityLabel="Add event" onPress={openNew} />}
        art={<EventCalendar3D size={104} />}
        badges={[{ icon: 'event-available', label: `${publishedCount} published` }, { icon: 'event', label: `${all.length} in all` }]}
      />
      <ConsoleGrid overlap>
        <ConsoleStatTile label="Upcoming" value={loading ? '…' : upcomingCount} icon="upcoming" accent="indigo" hint="still to be held"
          onPress={() => setWhen('upcoming')} selected={when === 'upcoming'} />
        <ConsoleStatTile label="On onboarding" value={loading ? '…' : publicCount} icon="language" accent="green" hint="the public can read these" delay={60} />
      </ConsoleGrid>

      <View style={s.shortcuts}>
        <Shortcut icon="payments" label="Bookings" hint="Revenue & seats" onPress={() => navigation.navigate('SuperBookings')} />
        <Shortcut icon="sell" label="Categories" hint="Programme types" onPress={() => navigation.navigate('SuperEventCategories')} />
        <Shortcut icon="how-to-reg" label="Attendance" hint="Who came" onPress={() => navigation.navigate('SuperEventAttendance')} />
      </View>

      <ConsoleButton icon="add" label="New event" onPress={openNew} style={s.newBtn} />

      <ConsoleNote style={s.note} icon="language"
        text="Every event also goes on the onboarding site and into the CMS, unless you untick that on the form." />

      <ConsoleSearch value={query} onChangeText={setQuery} placeholder="Title, venue, category or region" style={s.search} />
      <ConsoleTabs<When>
        value={when}
        onChange={setWhen}
        options={[{ value: 'upcoming', label: 'Upcoming', count: upcomingCount }, { value: 'past', label: 'Past', count: pastCount }]}
        style={s.tabs}
      />
      {targetOptions.length > 1 ? (
        <ChipRow<string> value={target} onChange={setTarget}
          options={[{ value: 'all', label: 'Every audience' }, ...targetOptions.map((t) => ({ value: t, label: t === 'Everyone' ? 'Everyone (no target)' : t }))]} />
      ) : null}
      {when === 'upcoming' && pastCount > 0 && !loading ? (
        <ConsoleNote style={s.note} kind="slate" icon="history"
          text={`${upcomingCount} ${upcomingCount === 1 ? 'is' : 'are'} still to come. The other ${pastCount} ${pastCount === 1 ? 'has' : 'have'} already been held.`}
          action="Show them" onAction={() => setWhen('past')} />
      ) : null}
      {all.length > 0 && visible.length !== all.length ? (
        <Text style={s.count} maxFontSizeMultiplier={1.3}>Showing {visible.length} of {all.length}</Text>
      ) : null}
      {error ? (
        <ConsoleState kind="error" title="Could not load events" message={error} action="Try again" onAction={() => load('load')} />
      ) : null}
      {loading && !error ? <ConsoleSkeleton rows={3} style={s.skeleton} /> : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || (error && !all.length) ? [] : visible}
        keyExtractor={(item, index) => String(item?.id || index)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? (all.length === 0
          ? <ConsoleState title="No events yet" message="Aim your first event at a region, or at everyone." action="Add event" onAction={openNew} />
          : <ConsoleState title="Nothing matches" message="No event answers all of the filters above. Clear one of them." />) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </ConsoleFrame>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  italic: { fontStyle: 'italic' },
  skeleton: { marginTop: SPACE.sm },
  shortcuts: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.lg, marginTop: SPACE.xs },
  shortcutCell: { flex: 1, minWidth: 0 },
  shortcut: {
    flex: 1, backgroundColor: PALETTE.card, borderRadius: 18, padding: SPACE.md, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3,
  },
  shortcutIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.indigoSoft, marginBottom: SPACE.sm },
  shortcutLabel: { ...TYPE.subheading, fontWeight: '800', fontSize: 14 },
  shortcutHint: { ...TYPE.caption, fontSize: 11, marginTop: 2 },
  newBtn: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  search: { marginTop: SPACE.md },
  tabs: { marginTop: SPACE.sm },
  count: { ...TYPE.caption, fontWeight: '700', paddingHorizontal: SPACE.lg, marginTop: SPACE.sm },
  card: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  banner: { width: '100%', aspectRatio: 16 / 9, backgroundColor: PALETTE.field, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  bannerEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.indigoSoft, aspectRatio: 3.2 },
  statusFloat: { position: 'absolute', top: SPACE.md, right: SPACE.md },
  body: { padding: SPACE.lg },
  title: { ...TYPE.heading, fontSize: 17, lineHeight: 23 },
  untitled: { fontStyle: 'italic', fontWeight: '600', color: PALETTE.textFaint },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.sm, marginBottom: SPACE.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0, fontSize: 13, color: PALETTE.textSoft },
  reach: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: PALETTE.field, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  reachOn: { backgroundColor: PALETTE.indigoSoft },
  reachText: { fontSize: 12, fontWeight: '700', color: PALETTE.textMuted, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  delete: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.redSoft },
});

export default ManageEventsScreen;

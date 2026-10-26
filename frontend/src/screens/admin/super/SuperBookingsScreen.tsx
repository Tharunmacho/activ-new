import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, AppState, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, money, shortDate, GradientButton,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs,
  ConsoleSkeleton, ConsoleState, ConsoleNote, ConsoleButton, CoverageRing, GlassIconButton, CONSOLE_LIST,
} from '../../../ui';
import { listBookingOverview, exportFilteredBookings, deleteArchivedEventHistory, errorText, type BookingHistoryCategory } from '../../../services/superApi';
import { saveSpreadsheetReport } from '../../../services/reportExport';
import type { BookingFiltersValue } from '../../../services/bookingFilters';
import BookingFilters from './BookingFilters';
import { ToggleRow, confirm } from './superKit';
import { BookingPeoplePane } from './SuperBookingPeopleScreen';

/**
 * ============================================================================
 * SUPER ADMIN — Booking Details (website /super-admin/bookings, BookingEvents)
 * ============================================================================
 *
 * GET /events/bookings/overview[?includeDrafts=1] — every event and how full
 * it is, in one request. The seat figures are the SERVER's (live bookings plus
 * members' own registrations — both fill the same room); nothing is summed
 * here.
 *
 *   Events tab  one card per event: price and member price, total / booked /
 *               remaining seats (remaining is null — "—" — on an uncapped
 *               event, never 0), waiting list, collected and unpaid, and the
 *               Draft / Bookings off / category chips. Searchable by name,
 *               venue or category. Tap for the event's bookings.
 *   People tab  everyone who has booked (BookingPeoplePane).
 *
 * Money is Super Admin only — the server's BOOKING_VIEWERS; the events admin
 * never reaches this screen.
 */

type Tab = 'events' | 'people';

const fullness = (e: any) => (Number(e?.totalSeats || 0) > 0 ? Math.min(1, Number(e?.bookedSeats || 0) / Number(e?.totalSeats || 1)) : null);

function Figure({ label, value, color, children }: { label: string; value: string; color?: string; children?: React.ReactNode }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  return (
    <View style={s.figure}>
      <Text style={[s.figValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{value}</Text>
      <Text style={s.figLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
      {children}
    </View>
  );
}

function EventCard({ e, index, onOpen }: { e: any; index: number; onOpen: () => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const total = Number(e?.totalSeats || 0);
  const booked = Number(e?.bookedSeats || 0);
  const remaining = e?.remainingSeats === null || e?.remainingSeats === undefined ? null : Number(e.remainingSeats);
  const share = fullness(e);
  const ringAccent = share === null ? 'green' : share >= 1 ? 'red' : share >= 0.8 ? 'amber' : 'green';
  const price = Number(e?.price || 0);
  const title = e?.title || 'Untitled event';
  return (
    <ConsoleCard
      style={s.card}
      onPress={onOpen}
      accent={e?.status !== 'published' ? PALETTE.textFaint : undefined}
      accessibilityLabel={`Booking details for ${title}`}
    >
      <View style={s.row}>
        <View style={s.flexText}>
          <View style={s.chips}>
            <ConsoleChip label={`#${index + 1}`} kind="neutral" dot={false} />
            {e?.category ? <ConsoleChip label={String(e.category)} kind="info" dot={false} /> : null}
            {e?.historyCategory === 'deleted' ? <ConsoleChip label="Old event · bookings retained" kind="neutral" />
              : e?.historyCategory === 'past' ? <ConsoleChip label="Completed" kind="neutral" />
              : e?.status !== 'published' ? <ConsoleChip label="Draft" kind="neutral" /> : null}
            {!e?.registrationEnabled ? <ConsoleChip label="Bookings off" kind="warning" icon="block" /> : null}
          </View>
          <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{title}</Text>
          <View style={s.meta}>
            <Icon name="event" size={15} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{shortDate(e?.startAt) || 'Date to be confirmed'}</Text>
          </View>
          {e?.venue ? (
            <View style={s.meta}>
              <Icon name="place" size={15} color={PALETTE.textMuted} />
              <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{e.venue}</Text>
            </View>
          ) : null}
          <View style={s.meta}>
            <Icon name="sell" size={15} color={PALETTE.textMuted} />
            <Text style={[s.metaText, s.price]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {e?.bookingHistoryOnly ? 'Booking history' : price > 0 ? money(price) : 'Free'}{e?.hasMemberRate ? `  ·  Members ${money(Number(e?.memberPrice || 0))}` : ''}
            </Text>
          </View>
        </View>
        {share !== null ? (
          <CoverageRing progress={share} accent={ringAccent as any} center={`${Math.round(share * 100)}%`} caption="full" />
        ) : null}
      </View>

      <View style={s.figures}>
        <Figure label="Total seats" value={total > 0 ? String(total) : e?.bookingHistoryOnly ? '—' : 'Unlimited'} color={total > 0 ? PALETTE.text : PALETTE.textFaint} />
        <Figure label="Booked" value={String(booked)} color={PALETTE.greenDark} />
        <Figure label="Remaining" value={remaining === null ? '—' : String(remaining)} color={remaining === null ? PALETTE.textFaint : remaining === 0 ? PALETTE.redDark : PALETTE.indigo}>
          {Number(e?.waitlistedSeats || 0) > 0 ? <Text style={s.waiting} maxFontSizeMultiplier={1.2}>+{Number(e?.waitlistedSeats || 0)} waiting</Text> : null}
        </Figure>
      </View>

      <View style={s.moneyRow}>
        <Text style={s.stat} maxFontSizeMultiplier={1.3}><Text style={s.statStrong}>{Number(e?.bookings || 0)}</Text> booking{Number(e?.bookings || 0) === 1 ? '' : 's'}</Text>
        <Text style={s.stat} maxFontSizeMultiplier={1.3}>Collected <Text style={[s.statStrong, { color: PALETTE.greenDark }]}>{money(Number(e?.collected || 0))}</Text></Text>
        {Number(e?.pendingAmount || 0) > 0 ? <Text style={[s.stat, s.unpaid]} maxFontSizeMultiplier={1.3}>{money(Number(e?.pendingAmount || 0))} unpaid</Text> : null}
      </View>
      <View style={s.more}>
        <Text style={s.moreText} maxFontSizeMultiplier={1.2}>Booking Details</Text>
        <Icon name="chevron-right" size={18} color={PALETTE.indigo} />
      </View>
    </ConsoleCard>
  );
}

const SuperBookingsScreen: React.FC = () => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('events');
  const [history, setHistory] = useState<BookingHistoryCategory>('current');
  const [filters, setFilters] = useState<BookingFiltersValue>({});
  const criteria = useMemo(() => ({ ...filters, history }), [filters, history]);
  const [exporting, setExporting] = useState(false);
  const [drafts, setDrafts] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [peopleKey, setPeopleKey] = useState(0);
  const [deletingEvent, setDeletingEvent] = useState('');
  const deleteInFlight = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'load') setLoading(true);
    setError('');
    try {
      const d = await listBookingOverview(drafts, criteria);
      if (mine === seq.current) setData(d || {});
    } catch (err) {
      if (mine === seq.current) setError(errorText(err, 'The events could not be loaded'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [drafts, criteria]);
  const removeArchivedHistory = async (event: any) => {
    if (!event?.id || event.historyCategory !== 'deleted' || deleteInFlight.current) return;
    deleteInFlight.current = true;
    try {
      if (!(await confirm('Delete old event history permanently?', `${event.title || 'Untitled event'}\n${shortDate(event.startAt) || ''}\n\nThis removes this old event and all its bookings, booking contacts, attendance and payment records from the database and reports. Member accounts stay. This cannot be undone and does not refund payments. Download an Excel copy first if needed.`, 'Delete permanently', true))) return;
      setDeletingEvent(event.id);
      await deleteArchivedEventHistory(event.id);
      ++seq.current;
      setData((current: any) => current ? { ...current, events: (current.events || []).filter((row: any) => row.id !== event.id) } : current);
      setPeopleKey(key => key + 1);
      await load('quiet');
      Alert.alert('History deleted', 'The old event and its booking history were permanently removed.');
    } catch (err) { Alert.alert('Could not delete old event history', errorText(err)); }
    finally { deleteInFlight.current = false; setDeletingEvent(''); }
  };
  // Quiet refetch on return from an event (a payment or a cancellation moves these figures).
  const loadedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    load(loadedOnce.current ? 'quiet' : 'load'); loadedOnce.current = true;
    const refresh = () => { if (AppState.currentState === 'active') load('quiet'); };
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') load('quiet'); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [load]));

  // Merged over the zeros, as the website does, so a response without `totals` leaves the tiles at 0.
  const t = { events: 0, seats: 0, capacity: 0, bookings: 0, collected: 0, pending: 0,
    ...(data?.historyTotals?.[history] || {}) };
  const events: any[] = useMemo(() => (Array.isArray(data?.events) ? data.events : []), [data]);
  const visible = useMemo(() => {
    return events.filter(e => e.historyCategory === history);
  }, [events, history]);

  const refreshAll = () => { if (tab === 'people') setPeopleKey((k) => k + 1); else load('refresh'); };

  const openEvent = useCallback((item: any) => navigation.navigate('SuperEventBookings', {
    eventId: String(item?.id || ''), title: item?.title || 'Untitled event', capacity: Number(item?.totalSeats || 0),
    filters: criteria,
  }), [navigation, criteria]);
  const exportRows = async () => {
    setExporting(true); setError('');
    try { await saveSpreadsheetReport(await exportFilteredBookings(criteria)); }
    catch (err) { setError(errorText(err, 'The report could not be saved')); }
    finally { setExporting(false); }
  };

  const top = (
    <>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · bookings & revenue"
        title="Booking Details"
        subtitle="Every event, how full it is, and what has been taken"
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
        right={<GlassIconButton icon="refresh" accessibilityLabel="Refresh" onPress={refreshAll} />}
      />
      {loading && !data ? <ConsoleSkeleton variant="tiles" style={s.overlap} /> : (
        <ConsoleGrid overlap>
          <ConsoleStatTile label="Seats booked" value={Number(t.seats || 0)} icon="groups" accent="indigo"
            hint={Number(t.capacity) > 0 ? `of ${t.capacity} across ${t.events} events` : `across ${t.events} events`} />
          <ConsoleStatTile label="Bookings" value={Number(t.bookings || 0)} icon="confirmation-number" accent="sky" hint="one booking may hold several seats" delay={60} />
          <ConsoleStatTile label="Collected" value={money(Number(t.collected || 0))} icon="payments" accent="green" hint="money actually received" delay={120} />
          <ConsoleStatTile label="Awaiting payment" value={money(Number(t.pending || 0))} icon="schedule" accent="amber" hint="held, not taken" delay={180} />
        </ConsoleGrid>
      )}
      <ConsoleTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[{ value: 'events', label: 'Events' }, { value: 'people', label: 'People' }]}
        style={s.tabs}
      />
      <ConsoleTabs<BookingHistoryCategory> value={history} onChange={setHistory} style={s.tabs}
        options={(['current', 'past', 'deleted'] as const).map(value => ({ value,
          label: `${value === 'current' ? 'Current' : value === 'past' ? 'Past' : 'Old'} (${data?.historyTotals?.[value]?.events || 0})` }))} />
      <ConsoleNote style={s.note} text="Completed events move to Past. Removed events move to Old, where you can export their bookings or permanently delete unnecessary history." />
      <BookingFilters value={filters} options={data?.filterOptions} onChange={setFilters} />
      <View style={s.export}><GradientButton label={exporting ? 'Preparing report…' : 'Download filtered Excel'} icon="download" onPress={exportRows} disabled={exporting || loading} /></View>
      {!!error && tab === 'people' && <ConsoleNote kind="red" text={error} style={s.note} />}
    </>
  );

  if (tab === 'people') {
    return (
      <ConsoleFrame>
        <BookingPeoplePane key={JSON.stringify(criteria)} header={top} refreshKey={peopleKey} filters={criteria} />
      </ConsoleFrame>
    );
  }

  const header = (
    <>
      {top}
      <ConsoleNote style={s.note} text="Event totals include all bookings for matching events. People and Excel use the selected registration filters." />
      <ConsoleCard style={s.toggleCard} padded={false}>
        <View style={s.togglePad}>
          <ToggleRow label="Include empty drafts" hint="Past and old events with booking history are always included." value={drafts} onChange={setDrafts} last />
        </View>
      </ConsoleCard>
      {error && data ? <ConsoleNote kind="red" icon="error-outline" text={error} style={s.note} action="Try again" onAction={() => load('load')} /> : null}
      {error && !data ? <ConsoleState kind="error" title="Could not load the events" message={error} action="Try again" onAction={() => load('load')} /> : null}
      {loading && !data && !error ? <ConsoleSkeleton rows={3} /> : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading && !data ? [] : error && !data ? [] : visible}
        keyExtractor={(e, i) => String(e?.id || i)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={loading || (error && !data) ? null
          : <ConsoleState title={`No ${history} events match`} message="Clear the filters or choose another history group." />}
        ListFooterComponent={events.length && !loading ? (
          <ConsoleNote
            style={s.note}
            text="Booked counts seats on live bookings taken through the public Book Now page together with members' own registrations — both fill the same room. A checkout somebody abandoned holds its seats for thirty minutes and then releases them, so this figure can go down as well as up. Open an event for the names, the payments and the door list."
          />
        ) : null}
        renderItem={({ item, index }) => <View><EventCard e={item} index={index} onOpen={() => openEvent(item)} />{item.historyCategory === 'deleted' ? <View style={s.card}><ConsoleButton kind="danger" icon="delete-outline" label="Delete old history permanently" disabled={!!deletingEvent} loading={deletingEvent === item.id} onPress={() => void removeArchivedHistory(item)} /></View> : null}</View>}
      />
    </ConsoleFrame>
  );
};

const s = StyleSheet.create({
  export: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  overlap: { marginTop: -30 },
  tabs: { marginTop: SPACE.md, marginBottom: SPACE.md },
  toggleCard: { marginHorizontal: SPACE.lg, marginTop: SPACE.md, marginBottom: SPACE.md },
  togglePad: { paddingHorizontal: SPACE.lg },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginBottom: SPACE.xs },
  title: { ...TYPE.heading, fontSize: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  price: { color: PALETTE.text, fontWeight: '800' },
  figures: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  figure: { flex: 1, minWidth: 0, backgroundColor: PALETTE.canvasAdmin, borderRadius: 14, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.xs, alignItems: 'center' },
  figValue: { fontSize: 18, fontWeight: '800', color: PALETTE.text },
  figLabel: { fontSize: 11, fontWeight: '700', color: PALETTE.textMuted, marginTop: 2 },
  waiting: { fontSize: 10, fontWeight: '800', color: PALETTE.amberDark, marginTop: 2 },
  moneyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.md },
  stat: { fontSize: 12, color: PALETTE.textMuted, fontWeight: '600' },
  statStrong: { color: PALETTE.text, fontWeight: '800' },
  unpaid: { color: PALETTE.amberDark, fontWeight: '800' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: SPACE.sm },
  moreText: { fontSize: 12, fontWeight: '800', color: PALETTE.indigo },
});

export default SuperBookingsScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;

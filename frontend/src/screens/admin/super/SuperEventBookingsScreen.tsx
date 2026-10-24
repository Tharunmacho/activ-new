import { saveSpreadsheetReport } from '../../../services/reportExport';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, money, shortDate,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs, ConsoleSearch,
  ConsoleSkeleton, ConsoleState, ConsoleNote, GlassIconButton, CONSOLE_LIST, type ConsoleChipKind,
} from '../../../ui';
import {
  listEventBookings, listEventAttendees, exportBookingsCsv, listEventsForPicker, errorText,
} from '../../../services/superApi';
import { ChipRow, MiniAction, callNumber } from './superKit';
import { DeliveryChips, useDeliverySummaries, useDelayedNonce } from './delivery/deliveryKit';

/**
 * ============================================================================
 * SUPER ADMIN — Event Bookings (website /super-admin/bookings/:eventId)
 * ============================================================================
 *
 *   Event picker  GET /events?limit=200 — switch event without going back,
 *                 labelled "title — date — price" as the website's select.
 *   Bookings      GET /events/:id/bookings?page&limit=10&search&paymentStatus
 *                 — server-side search and the All / Paid / Unpaid filter,
 *                 paged ten at a time exactly as the website asks; the running
 *                 number continues across pages. The summary tiles are the
 *                 WHOLE event's (the server computes them over every booking).
 *                 "View Booking Details" opens SuperBookingDetail (confirm a
 *                 payment with its mode, or cancel with a reason).
 *   Messages      GET /notifications/delivery-summary?bookingRefs=… — the
 *                 latest email and WhatsApp state of every booking on the page
 *                 in ONE request (the website's Messages column); tap for the
 *                 booking's messages (SuperBookingMessages). A failure only
 *                 blanks the chips.
 *   Who is coming GET /events/:id/attendees — one row per PERSON, for the door:
 *                 booked-by, own-or-booker contact, Guest/Member, payment and
 *                 member rate, Confirmed or Waiting list; counts in the footer.
 *   Attendance    the read-only door list (EventAttendance, readOnly).
 *   Excel report  GET /events/:id/bookings/export — the website's CSV, handed
 *                 to the phone's Files picker to save as a spreadsheet file.
 */

type Tab = 'bookings' | 'attendees';
type PayFilter = '' | 'paid' | 'pending';
const LIMIT = 10;

const payChip = (status: string, unpaidWord = 'Pending'): { label: string; kind: ConsoleChipKind } => (status === 'paid'
  ? { label: 'Paid', kind: 'approved' }
  : status === 'not_required' ? { label: 'Free', kind: 'info' }
    : status === 'failed' ? { label: 'Failed', kind: 'rejected' }
      : status === 'pending' || !status ? { label: unpaidWord, kind: 'pending' }
        : { label: status, kind: 'neutral' });

const modeLabel = (mode: string) => (mode === 'bank_transfer' ? 'Bank' : mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '');

function BookingCard({ b, n, onOpen, delivery, deliveryLoading, onMessages }: {
  b: any; n: number; onOpen: () => void; delivery: any; deliveryLoading: boolean; onMessages: () => void;
}) {
  const cancelled = String(b?.status || '') === 'cancelled';
  const pay = payChip(String(b?.payment?.status || ''));
  const mode = modeLabel(String(b?.payment?.mode || ''));
  const name = b?.bookedBy?.name || b?.bookingRef || 'Booking';
  return (
    <ConsoleCard
      style={[s.card, cancelled && s.dim]}
      accent={cancelled ? PALETTE.red : pay.kind === 'pending' ? PALETTE.amber : undefined}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Booking details for ${name}`}>
        <View style={s.row}>
          <Text style={s.sno} maxFontSizeMultiplier={1.2}>{n}</Text>
          <View style={s.flexText}>
            <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>{b?.bookedBy?.name || '—'}</Text>
            <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{b?.bookedBy?.email || '—'}</Text>
            <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{b?.bookedBy?.phone || '—'}</Text>
          </View>
          <View style={s.alignEnd}>
            <Text style={s.amount} maxFontSizeMultiplier={1.2}>{Number(b?.totalAmount || 0) > 0 ? money(Number(b?.totalAmount || 0)) : 'Free'}</Text>
            {b?.memberRateApplied ? (
              <Text style={s.rate} maxFontSizeMultiplier={1.2}>Member rate{Number(b?.memberSaving || 0) > 0 ? ` · saved ${money(Number(b?.memberSaving || 0))}` : ''}</Text>
            ) : null}
          </View>
        </View>
        <View style={s.chips}>
          {cancelled ? <ConsoleChip label="Cancelled" kind="rejected" /> : null}
          <ConsoleChip label={pay.label} kind={pay.kind} />
          {mode ? <ConsoleChip label={mode} kind="info" dot={false} /> : null}
          <ConsoleChip label={`${Number(b?.noOfPersons || 0)}`} kind="dark" icon="groups" />
          {b?.bookingRef ? <Text style={s.mono} numberOfLines={1} maxFontSizeMultiplier={1.2}>{b.bookingRef}</Text> : null}
        </View>
      </TouchableOpacity>
      {b?.bookingRef ? (
        <View style={s.messages}>
          <DeliveryChips summary={delivery} loading={deliveryLoading} onOpen={onMessages} />
        </View>
      ) : null}
      <View style={s.actions}>
        {b?.bookedBy?.phone ? <MiniAction icon="call" label="Call" onPress={() => callNumber(b?.bookedBy?.phone)} /> : null}
        <View style={s.flex} />
        <MiniAction icon="visibility" label="View Booking Details" onPress={onOpen} />
      </View>
    </ConsoleCard>
  );
}

function AttendeeRow({ a, n }: { a: any; n: number }) {
  const status = String(a?.paymentStatus || 'pending');
  const pay = payChip(status, 'Unpaid');
  const waitlist = String(a?.status || '') === 'waitlist';
  return (
    <ConsoleCard style={s.card} accent={waitlist ? PALETTE.amber : undefined}>
      <View style={s.row}>
        <Text style={s.sno} maxFontSizeMultiplier={1.2}>{n}</Text>
        <View style={s.flexText}>
          <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>{a?.name || '—'}</Text>
          {a?.bookedByName && a?.bookedByName !== a?.name ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>booked by {a.bookedByName}</Text> : null}
          {a?.email || a?.bookedByEmail
            ? <Text style={[s.sub, !a?.email && s.faint]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{a?.email || a?.bookedByEmail}</Text> : null}
          {a?.phone || a?.bookedByPhone
            ? <Text style={[s.sub, !a?.phone && s.faint]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{a?.phone || a?.bookedByPhone}</Text> : null}
          <Text style={s.mono} numberOfLines={1} maxFontSizeMultiplier={1.2}>{a?.bookingRef || ''}</Text>
          <View style={s.chips}>
            <ConsoleChip label={a?.isGuest ? 'Guest' : 'Member'} kind={a?.isGuest ? 'neutral' : 'info'} />
            <ConsoleChip label={pay.label} kind={pay.kind} />
            {a?.isMemberRate ? <ConsoleChip label="Member rate" kind="approved" dot={false} /> : null}
            {waitlist ? <ConsoleChip label="Waiting list" kind="warning" /> : <ConsoleChip label="Confirmed" kind="approved" icon="check" />}
          </View>
        </View>
      </View>
    </ConsoleCard>
  );
}

const SuperEventBookingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const eventId: string = String(route?.params?.eventId || '');
  const filters = useMemo(() => route?.params?.filters || {}, [route?.params?.filters]);
  const [tab, setTab] = useState<Tab>('bookings');

  // ---- the event picker
  const [events, setEvents] = useState<{ id: string; title: string; startAt: string | null; registrationFee: number; capacity: number; bookingHistoryOnly?: boolean; archivedAt?: string | null }[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    listEventsForPicker()
      .then((rows) => { if (alive) setEvents(Array.isArray(rows) ? rows : []); })
      .catch(() => null)
      .finally(() => { if (alive) setEventsLoading(false); });
    return () => { alive = false; };
  }, []);
  const selected = useMemo(() => (events || []).find((e) => e?.id === eventId) || null, [events, eventId]);
  const title: string = selected?.title || route?.params?.title || 'Event bookings';
  const capacity = selected ? Number(selected?.capacity || 0) : Number(route?.params?.capacity || 0);

  // ---- bookings (server-side search, filter and paging)
  const [search, setSearch] = useState(filters.search || '');
  const [debounced, setDebounced] = useState(filters.search || '');
  useEffect(() => { const t = setTimeout(() => setDebounced((search || '').trim()), 400); return () => clearTimeout(t); }, [search]);
  const [paymentStatus, setPaymentStatus] = useState<PayFilter>(filters.paymentStatus || '');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [eventId, debounced, paymentStatus]);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    if (!eventId) { setLoading(false); return; }
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'load') setLoading(true);
    setError('');
    try {
      const d = await listEventBookings(eventId, { ...filters, page, limit: LIMIT, search: debounced, paymentStatus });
      if (mine === seq.current) setData(d || {});
    } catch (err) {
      if (mine === seq.current) setError(errorText(err, 'The bookings could not be loaded'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [eventId, page, debounced, paymentStatus, filters]);

  // ---- who is coming (loaded when its tab is open)
  const [attendees, setAttendees] = useState<any[] | null>(null);
  const [seatsBooked, setSeatsBooked] = useState(0);
  const [attLoading, setAttLoading] = useState(false);
  const [attQuery, setAttQuery] = useState('');
  const loadAttendees = useCallback(async () => {
    if (!eventId) return;
    setAttLoading(true);
    try {
      const res = await listEventAttendees(eventId);
      setAttendees(Array.isArray(res?.attendees) ? res.attendees : []);
      setSeatsBooked(Number(res?.seatsBooked || 0));
    } catch (err) { setError(errorText(err, 'The attendee list could not be loaded')); setAttendees((a) => a || []); } finally { setAttLoading(false); }
  }, [eventId]);

  // ---- the Messages chips: one request per page
  const rows: any[] = useMemo(() => (Array.isArray(data?.bookings) ? data.bookings : []), [data]);
  const { nonce, bump, bumpSoon } = useDelayedNonce();
  const { map: delivery, loading: deliveryLoading } = useDeliverySummaries(rows.map((b) => String(b?.bookingRef || '')), nonce);

  // Every return from a booking's detail screen refreshes both views quietly,
  // and looks at the messages again once the background send has had a moment.
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    load(first.current ? 'load' : 'quiet');
    if (tab === 'attendees') loadAttendees();
    first.current = false;
  }, [load, loadAttendees, tab]));
  // Only a real return to this screen (not a filter change) re-asks for the messages.
  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) { bump(); bumpSoon(); }
    focusedOnce.current = true;
  }, [bump, bumpSoon]));

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    if (exporting || !eventId) return;
    setExporting(true);
    try {
      await saveSpreadsheetReport(await exportBookingsCsv(eventId, title || 'event', { ...filters, search: debounced, paymentStatus }));
    } catch (err) {
      Alert.alert('The report could not be downloaded', errorText(err));
    } finally { setExporting(false); }
  };

  const openAttendance = () => {
    if (!eventId) return;
    navigation.navigate('EventAttendance', { eventId, eventTitle: title, readOnly: true });
  };

  const pickEvent = (e: { id: string; title: string; capacity: number }) => {
    setPickerOpen(false);
    setAttendees(null);
    navigation.setParams({ eventId: e?.id, title: e?.title, capacity: e?.capacity });
  };

  const summary = data?.summary || {};
  const pg = data?.pagination || {};
  const pages = Math.max(1, Number(pg?.pages || 1));
  const total = Number(pg?.total || 0);
  const pageNo = Number(pg?.page || page);
  const limit = Number(pg?.limit || LIMIT);
  const showingLine = total ? `Showing ${(pageNo - 1) * limit + 1} to ${Math.min(pageNo * limit, total)} of ${total} entries` : 'No entries';

  const attRows = useMemo(() => {
    const needle = (attQuery || '').trim().toLowerCase();
    const list = Array.isArray(attendees) ? attendees : [];
    if (!needle) return list;
    return list.filter((a) => [a?.name, a?.email, a?.phone, a?.bookingRef, a?.bookedByName, a?.bookedByEmail, a?.bookedByPhone]
      .some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [attendees, attQuery]);
  const confirmed = (attendees || []).filter((r) => r?.status !== 'waitlist').length;
  const waiting = (attendees || []).length - confirmed;

  const openBooking = (b: any) => navigation.navigate('SuperBookingDetail', {
    eventId, booking: b, event: { title, capacity, startAt: selected?.startAt || null },
  });
  const openMessages = (b: any) => navigation.navigate('SuperBookingMessages', {
    bookingRef: String(b?.bookingRef || ''), title: b?.eventTitle || title,
  });

  const back = <GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />;
  const headerRight = (
    <View style={s.headRight}>
      {!selected?.bookingHistoryOnly && <GlassIconButton icon="how-to-reg" accessibilityLabel="Attendance" onPress={openAttendance} />}
      <GlassIconButton icon={exporting ? 'hourglass-empty' : 'file-download'} accessibilityLabel="Excel report" onPress={exportCsv} />
    </View>
  );

  const eventLine = (e: { startAt: string | null; registrationFee: number; bookingHistoryOnly?: boolean; archivedAt?: string | null; historyCategory?: string } | null) =>
    e ? [e.startAt ? shortDate(e.startAt) : '', e.historyCategory === 'deleted' ? 'Old event · bookings retained' : e.historyCategory === 'past' ? 'Past event' : 'Current event',
      e.bookingHistoryOnly ? '' : Number(e.registrationFee || 0) > 0 ? money(Number(e.registrationFee || 0)) : 'Free'].filter(Boolean).join(' — ') : '';

  const header = (
    <>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · event bookings"
        title={title}
        subtitle="Seats booked through Book Now, and what has been paid"
        left={back}
        right={headerRight}
      />

      {loading && !data ? <ConsoleSkeleton variant="tiles" style={s.overlap} /> : (
        <ConsoleGrid overlap>
          <ConsoleStatTile label="Bookings" value={Number(summary?.bookings || 0)} icon="confirmation-number" accent="indigo" hint={`${Number(summary?.paidBookings || 0)} paid`} />
          <ConsoleStatTile label="Seats taken" value={Number(summary?.seats || 0)} icon="groups" accent="sky" hint={capacity > 0 ? `of ${capacity}` : selected?.bookingHistoryOnly ? 'retained booking history' : 'no seat limit set'} delay={60} />
          <ConsoleStatTile label="Collected" value={money(Number(summary?.collected || 0))} icon="payments" accent="green" hint="money actually received" delay={120} />
          <ConsoleStatTile
            label="Awaiting payment"
            value={money(Number(summary?.pending || 0))}
            icon="schedule"
            accent="amber"
            hint={`${Number(summary?.pendingBookings || 0)} booking${Number(summary?.pendingBookings || 0) === 1 ? '' : 's'}`}
            delay={180}
          />
        </ConsoleGrid>
      )}

      {/* ------------------------------------------------ the event picker */}
      <ConsoleCard style={s.pickerCard}>
        <Text style={s.eyebrow} maxFontSizeMultiplier={1.2}>EVENT</Text>
        <TouchableOpacity
          onPress={() => setPickerOpen((v) => !v)}
          activeOpacity={0.8}
          style={s.picker}
          disabled={eventsLoading || !(events || []).length}
          accessibilityRole="button"
          accessibilityLabel="Choose an event"
          accessibilityState={{ expanded: pickerOpen }}
        >
          <View style={s.flexText}>
            <Text style={s.pickTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>{title}</Text>
            {selected ? <Text style={s.sub} maxFontSizeMultiplier={1.3}>{eventLine(selected)}</Text>
              : eventsLoading ? <Text style={s.sub} maxFontSizeMultiplier={1.3}>Loading events…</Text> : null}
          </View>
          <Icon name={pickerOpen ? 'expand-less' : 'expand-more'} size={24} color={PALETTE.indigo} />
        </TouchableOpacity>
        {pickerOpen ? (
          <View style={s.pickList}>
            {(events || []).map((e) => (
              <TouchableOpacity
                key={e?.id}
                onPress={() => pickEvent(e)}
                style={[s.pickRow, e?.id === eventId && s.pickRowOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: e?.id === eventId }}
              >
                <Text style={s.pickRowTitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>{e?.title || 'Untitled event'}</Text>
                <Text style={s.sub} maxFontSizeMultiplier={1.3}>{eventLine(e)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ConsoleCard>

      <ConsoleTabs<Tab>
        value={tab}
        onChange={setTab}
        style={s.tabs}
        options={[
          { value: 'bookings', label: 'Bookings', ...(data ? { count: Number(summary?.bookings || 0) } : {}) },
          { value: 'attendees', label: 'Who is coming', ...(data ? { count: Number(summary?.seats || 0) } : {}) },
        ]}
      />

      {error && (data || attendees) ? <ConsoleNote kind="red" icon="error-outline" text={error} style={s.note} /> : null}

      {tab === 'bookings' ? (
        <>
          <ConsoleSearch value={search} onChangeText={setSearch} placeholder="Name, email, mobile or booking reference" />
          <View style={s.filters}>
            <ChipRow<PayFilter> value={paymentStatus} onChange={setPaymentStatus}
              options={[{ value: '', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Unpaid' }]} />
          </View>
        </>
      ) : (
        <View style={s.filters}>
          <ConsoleSearch value={attQuery} onChangeText={setAttQuery} placeholder="Search a name, email, mobile or booking reference" />
        </View>
      )}

      {error && !data ? <ConsoleState kind="error" title="Could not load the bookings" message={error} action="Try again" onAction={() => load('load')} /> : null}
      {tab === 'bookings' && loading && !data && !error ? <ConsoleSkeleton rows={3} /> : null}
      {tab === 'attendees' && (attLoading || attendees === null) && !error ? <ConsoleSkeleton rows={3} /> : null}
    </>
  );

  const pager = (
    <View style={s.pager}>
      <Text style={s.showing} maxFontSizeMultiplier={1.3}>{showingLine}</Text>
      {pages > 1 ? (
        <View style={s.pagerRow}>
          <TouchableOpacity onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={pageNo <= 1} style={[s.pageBtn, pageNo <= 1 && s.off]} accessibilityRole="button" accessibilityLabel="Previous page">
            <Icon name="chevron-left" size={20} color={PALETTE.textSoft} />
          </TouchableOpacity>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => Math.abs(n - pageNo) <= 1 || n === 1 || n === pages)
            .map((n, idx, all) => (
              <View key={n} style={s.pageCell}>
                {idx > 0 && all[idx - 1] !== n - 1 ? <Text style={s.ellipsis}>…</Text> : null}
                <TouchableOpacity onPress={() => setPage(n)} style={[s.pageBtn, n === pageNo && s.pageOn]} accessibilityRole="button" accessibilityLabel={`Page ${n}`} accessibilityState={{ selected: n === pageNo }}>
                  <Text style={[s.pageText, n === pageNo && s.pageTextOn]} maxFontSizeMultiplier={1.2}>{n}</Text>
                </TouchableOpacity>
              </View>
            ))}
          <TouchableOpacity onPress={() => setPage((p) => Math.min(pages, p + 1))} disabled={pageNo >= pages} style={[s.pageBtn, pageNo >= pages && s.off]} accessibilityRole="button" accessibilityLabel="Next page">
            <Icon name="chevron-right" size={20} color={PALETTE.textSoft} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const attFooter = attendees && attendees.length ? (
    <View style={s.attFoot}>
      <Text style={s.attFootText} maxFontSizeMultiplier={1.3}><Text style={s.bold}>{confirmed}</Text> named</Text>
      {seatsBooked > confirmed + waiting ? <Text style={s.attFootText} maxFontSizeMultiplier={1.3}><Text style={s.bold}>{seatsBooked}</Text> seats booked in total</Text> : null}
      {waiting ? <Text style={[s.attFootText, s.waitText]} maxFontSizeMultiplier={1.3}><Text style={s.bold}>{waiting}</Text> on the waiting list — no seat held</Text> : null}
    </View>
  ) : null;

  if (!eventId) {
    return (
      <ConsoleFrame>
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={CONSOLE_LIST}
          ListHeaderComponent={<ConsoleHeader compact eyebrow="Super Admin · event bookings" title="Event Bookings" left={back} />}
          ListEmptyComponent={<ConsoleState title="No event chosen" message="Open an event from Booking Details." />}
        />
      </ConsoleFrame>
    );
  }

  const showList = tab === 'bookings' ? (data ? rows : []) : (attendees && !attLoading ? attRows : []);

  return (
    <ConsoleFrame>
      <FlatList
        data={showList}
        keyExtractor={(x: any, i) => String(tab === 'bookings' ? x?.bookingRef || i : x?.key || `${x?.bookingRef || ''}-${i}`)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { load('refresh'); bump(); if (tab === 'attendees') loadAttendees(); }} tintColor={PALETTE.indigo} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={tab === 'bookings'
          ? (data ? <ConsoleState title={debounced || paymentStatus ? 'No bookings match that filter.' : 'No bookings for this event yet.'} /> : null)
          : (attendees && !attLoading ? <ConsoleState title={attQuery ? 'Nobody matches' : 'Nobody has booked a seat on this event yet.'} /> : null)}
        ListFooterComponent={tab === 'bookings' ? (data ? pager : null) : attFooter}
        renderItem={({ item, index }) => (tab === 'bookings'
          ? (
            <BookingCard
              b={item}
              n={(pageNo - 1) * limit + index + 1}
              onOpen={() => openBooking(item)}
              delivery={delivery?.[String(item?.bookingRef || '')] || null}
              deliveryLoading={deliveryLoading}
              onMessages={() => openMessages(item)}
            />
          )
          : <AttendeeRow a={item} n={index + 1} />)}
      />
    </ConsoleFrame>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  alignEnd: { alignItems: 'flex-end', maxWidth: '45%' },
  headRight: { flexDirection: 'row', gap: SPACE.sm },
  overlap: { marginTop: -30 },
  note: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  pickerCard: { marginHorizontal: SPACE.lg, marginTop: SPACE.xs, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.eyebrow, color: PALETTE.indigoDark, marginBottom: SPACE.xs + 2 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: PALETTE.canvasAdmin, borderRadius: 14, padding: SPACE.md, minHeight: 52 },
  pickTitle: { ...TYPE.subheading, fontWeight: '800' },
  pickList: { marginTop: SPACE.sm },
  pickRow: { paddingVertical: 10, paddingHorizontal: SPACE.md, borderRadius: 12, minHeight: 44 },
  pickRowOn: { backgroundColor: PALETTE.indigoSoft },
  pickRowTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.text },
  tabs: { marginBottom: SPACE.md },
  filters: { marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  dim: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  sno: { minWidth: 20, fontSize: 13, fontWeight: '800', color: PALETTE.textFaint, marginTop: 2 },
  name: { ...TYPE.subheading, fontWeight: '800' },
  sub: { ...TYPE.caption, marginTop: 2 },
  faint: { color: PALETTE.textFaint },
  mono: { fontSize: 11, color: PALETTE.textMuted, marginTop: 2, fontFamily: 'monospace' },
  amount: { fontSize: 16, fontWeight: '800', color: PALETTE.text },
  rate: { fontSize: 11, fontWeight: '800', color: PALETTE.greenDark, marginTop: 2, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
  messages: { marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm },
  pager: { paddingHorizontal: SPACE.lg, marginTop: SPACE.sm, gap: SPACE.sm },
  showing: { ...TYPE.caption },
  pagerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  pageCell: { flexDirection: 'row', alignItems: 'center' },
  pageBtn: { minWidth: 44, height: 44, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: PALETTE.border, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.card },
  pageOn: { backgroundColor: PALETTE.indigo, borderColor: PALETTE.indigo },
  pageText: { fontSize: 14, fontWeight: '800', color: PALETTE.textSoft },
  pageTextOn: { color: PALETTE.white },
  off: { opacity: 0.4 },
  ellipsis: { paddingHorizontal: 4, color: PALETTE.textFaint },
  attFoot: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm, padding: SPACE.md, borderRadius: 16, backgroundColor: PALETTE.indigoSoft, gap: 4 },
  attFootText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSoft },
  waitText: { color: PALETTE.amberDark },
  bold: { fontWeight: '800', color: PALETTE.text },
});

export default SuperEventBookingsScreen;

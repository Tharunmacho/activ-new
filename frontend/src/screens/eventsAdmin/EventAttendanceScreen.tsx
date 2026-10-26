import { useLegacyAppearance } from '../../ui/legacyAppearance';
import { saveSpreadsheetReport } from '../../services/reportExport';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs,
  ConsoleSearch, ConsoleSkeleton, ConsoleState, ConsoleButton, ConsoleNote, GlassIconButton, CONSOLE_LIST,
} from '../../ui';
import {
  checkinErrorMessage, exportAttendanceCsv, getAttendance, type Attendance, type AttendanceRow,
} from '../../services/eventCheckinApi';

/**
 * ============================================================================
 * ATTENDANCE — one event's door list
 * ============================================================================
 *
 * Every seat entitled to enter, checked in or not: when each person was let
 * in, by whom, and how (QR scan or manual entry). Shared by two roles:
 *
 *   events admin  the door team — scan, open a booking, export the CSV.
 *   super admin   `readOnly: true` — the same list and export, no scanning
 *                 and no admitting. The server also hands this role each
 *                 attendee's email and phone (includeContact); the events
 *                 admin gets a masked number only.
 *
 * Search and the tab filter are answered by the server (the same query the
 * website's Attendance screen sends), so the counts and the list never
 * disagree. While the screen is open the list refreshes itself every 10 s —
 * other gates are admitting people too.
 *
 * GET /events/:id/attendance · GET /events/:id/attendance/export
 * (ATTENDANCE_VIEWERS: super_admin, events_admin).
 */

type Props = { navigation: any; route: any };
type Status = 'all' | 'in' | 'out';

const LIVE_MS = 10000; // live at the door: a seat let in shows within ~10 s

const EMPTY: Attendance = {
  event: { id: '', title: '', startAt: null, venue: '' },
  totals: { registered: 0, checkedIn: 0, notYet: 0, percent: 0 },
  rows: [],
};

const clock = (ms: number) => {
  try {
    return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
};

export default function EventAttendanceScreen({ navigation, route }: Props) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const TYPE = useLegacyAppearance(legacyAppearance_TYPE);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const eventId: string = String(route?.params?.eventId || '');
  const eventTitle: string = String(route?.params?.eventTitle || '');
  const readOnly: boolean = route?.params?.readOnly === true;

  const [data, setData] = useState<Attendance>(EMPTY);
  const [status, setStatus] = useState<Status>('all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const seq = useRef(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(String(query || '').trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    if (!eventId) { setLoading(false); setError('No event was chosen.'); return; }
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'first') setLoading(true);
    if (mode !== 'quiet') setError('');
    try {
      const next = await getAttendance(eventId, { q: debounced, status });
      if (mine === seq.current) { setData(next || EMPTY); setUpdatedAt(Date.now()); setError(''); }
    } catch (err: any) {
      // A failed background refresh keeps the list on screen; only a load the
      // user asked for replaces it with the error.
      if (mine === seq.current && mode !== 'quiet') setError(checkinErrorMessage(err, 'The attendance could not be loaded.'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [eventId, debounced, status]);

  // Load on focus, then keep the counts live while the screen is in front.
  useFocusEffect(useCallback(() => {
    load('first');
    const timer = setInterval(() => { load('quiet'); }, LIVE_MS);
    return () => clearInterval(timer);
  }, [load]));

  const t = data?.totals || EMPTY.totals;
  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);
  const title = data?.event?.title || eventTitle || 'Event';

  const scan = useCallback(() => {
    navigation?.navigate?.('EventCheckinScanner', { eventId, eventTitle: title });
  }, [navigation, eventId, title]);

  const openBooking = useCallback((row: AttendanceRow) => {
    if (!row?.bookingRef) return;
    navigation?.navigate?.('EventBookingDetail', { eventId, eventTitle: title, bookingRef: row.bookingRef, readOnly });
  }, [navigation, eventId, title, readOnly]);

  const exportCsv = useCallback(async () => {
    if (exporting || !eventId) return;
    setExporting(true);
    try {
      await saveSpreadsheetReport(await exportAttendanceCsv(eventId, title));
    } catch (err: any) {
      Alert.alert('Export failed', checkinErrorMessage(err, 'The attendance report could not be downloaded.'));
    } finally {
      setExporting(false);
    }
  }, [exporting, eventId, title]);

  const renderItem = useCallback(({ item }: { item: AttendanceRow }) => {
    const contact = [item?.phone, item?.email].filter(Boolean).join(' · ');
    return (
      <ConsoleCard
        style={s.card}
        accent={item?.checkedIn ? PALETTE.green : undefined}
        onPress={item?.bookingRef ? () => openBooking(item) : undefined}
        accessibilityLabel={`${item?.name || 'Attendee'}, ${item?.checkedIn ? 'checked in' : 'not yet in'}`}
      >
        <View style={s.row}>
          <View style={s.flexText}>
            <Text style={TYPE.bodyStrong} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item?.name || 'Attendee'}</Text>
            <Text style={s.reg} numberOfLines={1} selectable maxFontSizeMultiplier={1.3}>{item?.registrationNo || ''}</Text>
          </View>
          <ConsoleChip
            label={item?.checkedIn ? 'Checked in' : 'Not yet'}
            kind={item?.checkedIn ? 'approved' : 'neutral'}
          />
        </View>
        {item?.checkedIn ? (
          <View style={s.meta}>
            <Icon name={item?.method === 'manual' ? 'keyboard' : 'qr-code-2'} size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {item?.admittedAtLabel || ''}
              {item?.admittedBy ? ` · by ${item.admittedBy}` : ''}
              {item?.method ? ` · ${item.method === 'manual' ? 'manual entry' : 'QR scan'}` : ''}
              {item?.bookingStatus === 'changed' ? ' · booking changed since' : ''}
            </Text>
          </View>
        ) : (
          <View style={s.meta}>
            <Icon name="person-outline" size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {item?.bookedBy ? `Booked by ${item.bookedBy}` : 'Registered'}{item?.payment ? ` · ${item.payment}` : ''}
            </Text>
          </View>
        )}
        {contact ? (
          <View style={s.meta}>
            <Icon name="contact-phone" size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} selectable maxFontSizeMultiplier={1.3}>{contact}</Text>
          </View>
        ) : item?.phoneMasked ? (
          <View style={s.meta}>
            <Icon name="phone" size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item.phoneMasked}</Text>
          </View>
        ) : null}
      </ConsoleCard>
    );
  }, [openBooking]);

  const live = updatedAt && clock(updatedAt) ? `Live · ${clock(updatedAt)}` : 'Live';

  const header = (
    <>
      <ConsoleHeader
        compact
        eyebrow={readOnly ? 'Event attendance' : 'Attendance'}
        title={title}
        subtitle="Who has been let in, when, and by whom"
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
        right={readOnly ? undefined : (
          <GlassIconButton icon="qr-code-scanner" accessibilityLabel="Scan passes" onPress={scan} />
        )}
        badges={[{ icon: 'sensors', label: live }]}
      />
      <ConsoleGrid overlap>
        <ConsoleStatTile label="Checked in" value={Number(t.checkedIn || 0)} icon="how-to-reg" accent="green" hint={`${Number(t.percent || 0)}% turnout`} />
        <ConsoleStatTile label="Not yet in" value={Number(t.notYet || 0)} icon="hourglass-empty" accent="amber" hint={`of ${Number(t.registered || 0)} registered`} delay={60} />
      </ConsoleGrid>
      <View style={s.tools}>
        {!readOnly ? (
          <ConsoleButton
            size="sm"
            kind="soft"
            icon="groups"
            label="Bookings"
            onPress={() => navigation?.navigate?.('EventDoorBookings', { eventId, eventTitle: title })}
            style={s.flexBtn}
          />
        ) : null}
        <ConsoleButton
          size="sm"
          kind="soft"
          icon="ios-share"
          label="Export Excel"
          onPress={exportCsv}
          loading={exporting}
          disabled={!eventId}
          style={s.flexBtn}
          accessibilityLabel="Export attendance Excel report"
        />
      </View>
      <ConsoleSearch value={query} onChangeText={setQuery} placeholder="Search name, registration no or staff" />
      <ConsoleTabs
        options={[{ value: 'all', label: 'All' }, { value: 'in', label: 'Checked in' }, { value: 'out', label: 'Not yet' }]}
        value={status}
        onChange={(v) => setStatus(v as Status)}
        style={s.tabs}
      />
      {error ? <ConsoleState kind="error" title="Could not load" message={error} action="Try again" onAction={() => load('first')} /> : null}
      {loading && !error ? <ConsoleSkeleton rows={4} /> : null}
    </>
  );

  return (
    <ConsoleFrame
      footer={eventId && !readOnly ? (
        <View style={[s.footer, { paddingBottom: Math.max(SPACE.lg, Number(insets?.bottom || 0) + SPACE.sm) }]}>
          <ConsoleButton icon="qr-code-scanner" label="Scan passes" onPress={scan} />
        </View>
      ) : undefined}
    >
      <FlatList
        data={loading || error ? [] : rows}
        keyExtractor={(item, index) => String(item?.registrationNo || index)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={[CONSOLE_LIST, s.listBottom]}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? (
          <ConsoleState
            title={debounced ? 'No match' : status === 'in' ? 'Nobody checked in yet' : 'Nobody here'}
            message={debounced ? 'Try another name or number.' : 'Registered attendees appear here.'}
          />
        ) : null}
        ListFooterComponent={!loading && !error && readOnly ? (
          <ConsoleNote
            style={s.note}
            icon="visibility"
            text="Read-only. Entry is recorded by the events team at the door. The CSV includes each attendee's email and phone."
          />
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </ConsoleFrame>
  );
}

const s = StyleSheet.create({
  tools: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.lg, marginTop: SPACE.xs, marginBottom: SPACE.sm },
  flexBtn: { flex: 1 },
  tabs: { marginTop: SPACE.md, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flexText: { flex: 1, minWidth: 0 },
  reg: { ...TYPE.caption, marginTop: 2, fontVariant: ['tabular-nums'] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
  footer: {
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.lg,
    backgroundColor: PALETTE.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PALETTE.border,
  },
  listBottom: { paddingBottom: SPACE.xl },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_TYPE = TYPE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;

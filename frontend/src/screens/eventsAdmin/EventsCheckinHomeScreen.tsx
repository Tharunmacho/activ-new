import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs,
  ConsoleButton, ConsoleSkeleton, ConsoleState, ConsoleNote, CoverageRing,
  EventTicket3D, CONSOLE_LIST, consoleGreeting,
} from '../../ui';
import { useAuthStore } from '../../stores/exampleStore';
import { checkinErrorMessage, listCheckinEvents, type CheckinEvent } from '../../services/eventCheckinApi';
import { eventWhen } from './checkinKit';

/**
 * ============================================================================
 * EVENTS ADMIN — the Events tab: every event to check people in to
 * ============================================================================
 *
 * One tab of the events console (EventsAdminBottomTabs). The website is where
 * the programme is written; the phone is the door. Today's events first, then
 * what is coming (and the last two days, for a multi-day or late-running
 * event); "Past" for anything older.
 *
 * Each card: registered seats (paid or free, confirmed) against checked in,
 * and the three things staff do — scan, open the bookings, read the list.
 * Log out lives on the Account tab.
 */

type Props = { navigation: any };
type Scope = 'upcoming' | 'past';

/** Live counts while the screen is open — check-ins at the door appear within ~10 s. */
const LIVE_MS = 10000;

export default function EventsCheckinHomeScreen({ navigation }: Props) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const [scope, setScope] = useState<Scope>('upcoming');
  const [events, setEvents] = useState<CheckinEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuthStore();

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'first') setLoading(true);
    setError('');
    try {
      const list = await listCheckinEvents(scope);
      setEvents(Array.isArray(list) ? list : []);
    } catch (err: any) {
      // A failed background refresh keeps the list on screen.
      if (mode !== 'quiet') setError(checkinErrorMessage(err, 'The events could not be loaded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  // Back from the scanner: the counts have moved — and stay live while open.
  useFocusEffect(useCallback(() => {
    load('first');
    const timer = setInterval(() => { load('quiet'); }, LIVE_MS);
    return () => clearInterval(timer);
  }, [load]));

  const totals = useMemo(() => (events || []).reduce(
    (t, e) => ({
      today: t.today + (e?.isToday ? 1 : 0),
      registered: t.registered + Number(e?.registered || 0),
      checkedIn: t.checkedIn + Number(e?.checkedIn || 0),
    }),
    { today: 0, registered: 0, checkedIn: 0 },
  ), [events]);

  // Always for one event: the server refuses a scan with no event.
  const scan = useCallback((e: CheckinEvent) => {
    if (!e?.id) return;
    navigation?.navigate?.('EventCheckinScanner', { eventId: e.id, eventTitle: e.title });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: CheckinEvent }) => {
    const registered = Number(item?.registered || 0);
    const checkedIn = Number(item?.checkedIn || 0);
    const online = item?.mode === 'online';
    return (
      <ConsoleCard style={s.card} accent={item?.isToday ? PALETTE.green : undefined}>
        <View style={s.row}>
          <View style={s.flexText}>
            <View style={s.chips}>
              {item?.isToday ? <ConsoleChip label="Today" kind="approved" /> : null}
              {online ? <ConsoleChip label="Online" kind="neutral" icon="videocam" /> : null}
              {item?.category ? <ConsoleChip label={item.category} kind="info" dot={false} /> : null}
            </View>
            <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item?.title || 'Untitled event'}</Text>
            <View style={s.meta}>
              <Icon name="event" size={15} color={PALETTE.textMuted} />
              <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{eventWhen(item?.startAt)}</Text>
            </View>
            {item?.venue && !online ? (
              <View style={s.meta}>
                <Icon name="place" size={15} color={PALETTE.textMuted} />
                <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item.venue}</Text>
              </View>
            ) : null}
          </View>
          <CoverageRing
            progress={registered > 0 ? checkedIn / registered : 0}
            accent="green"
            center={`${checkedIn}`}
            caption={`of ${registered}`}
          />
        </View>
        <View style={s.actions}>
          <ConsoleButton size="sm" icon="qr-code-scanner" label="Scan" accessibilityLabel="Scan passes" onPress={() => scan(item)} style={s.flexBtn} />
          <ConsoleButton
            size="sm"
            kind="soft"
            icon="groups"
            label="Bookings"
            onPress={() => navigation?.navigate?.('EventDoorBookings', { eventId: item?.id, eventTitle: item?.title })}
            style={s.flexBtn}
          />
          <ConsoleButton
            size="sm"
            kind="soft"
            icon="fact-check"
            label="List"
            accessibilityLabel="Attendance"
            onPress={() => navigation?.navigate?.('EventAttendance', { eventId: item?.id, eventTitle: item?.title })}
            style={s.flexBtn}
          />
        </View>
      </ConsoleCard>
    );
  }, [navigation, scan]);

  const header = (
    <>
      <ConsoleHeader
        eyebrow={consoleGreeting()}
        title="Events"
        subtitle={user?.fullName ? `Signed in as ${user.fullName}` : 'Scan attendees’ entry passes at the door'}
        art={<EventTicket3D size={104} />}
        badges={[{ icon: 'badge', label: 'Event Attendance Admin' }]}
      />
      <ConsoleGrid overlap>
        <ConsoleStatTile label="Checked in" value={totals.checkedIn} icon="how-to-reg" accent="green" hint={`of ${totals.registered} registered`} />
        <ConsoleStatTile label="Events today" value={totals.today} icon="today" accent="indigo" delay={60} />
      </ConsoleGrid>
      {/* No "scan for any event": a pass only works at its own event's door,
          so the scanner is always opened from an event below. */}
      <View style={s.gutter}>
        <ConsoleNote icon="qr-code-scanner" text="Tap Scan on the event you are checking in. A pass only works at its own event, and online events have no door." />
      </View>
      <ConsoleTabs
        options={[{ value: 'upcoming', label: 'Today & upcoming' }, { value: 'past', label: 'Past' }]}
        value={scope}
        onChange={(v) => setScope(v as Scope)}
        style={s.tabs}
      />
      {error ? (
        <ConsoleState kind="error" title="Could not load events" message={error} action="Try again" onAction={() => load('first')} />
      ) : null}
      {loading && !error ? <ConsoleSkeleton rows={3} /> : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || error ? [] : events}
        keyExtractor={(item, index) => String(item?.id || index)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? (
          <ConsoleState
            title={scope === 'past' ? 'No past events' : 'No events coming up'}
            message="Published events appear here with their registrations."
          />
        ) : null}
        ListFooterComponent={!loading && !error && (events || []).length ? (
          <ConsoleNote
            style={s.note}
            text="Registered counts paid and free confirmed seats. Unpaid, cancelled and waitlisted passes are refused at the door."
          />
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        showsVerticalScrollIndicator={false}
      />
    </ConsoleFrame>
  );
}

const s = StyleSheet.create({
  gutter: { paddingHorizontal: SPACE.lg, marginTop: SPACE.xs },
  tabs: { marginTop: SPACE.lg, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginBottom: SPACE.xs },
  title: { ...TYPE.heading, fontSize: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  flexBtn: { flex: 1 },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;

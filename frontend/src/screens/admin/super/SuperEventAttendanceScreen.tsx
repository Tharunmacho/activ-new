import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs,
  ConsoleSearch, ConsoleSkeleton, ConsoleState, ConsoleNote, CoverageRing, GlassIconButton, CONSOLE_LIST,
} from '../../../ui';
import { checkinErrorMessage, listCheckinEvents, type CheckinEvent } from '../../../services/eventCheckinApi';
import { eventWhen } from '../../eventsAdmin/checkinKit';

/**
 * ============================================================================
 * SUPER ADMIN — Event attendance (read-only)
 * ============================================================================
 *
 * Read-only by design (the website's Attendance page). Writing events is the
 * Events tab, bookings and payments are Bookings & revenue; this answers
 * "who actually came": every event with registered vs checked in, and each
 * event's door list — who, when, admitted by whom, by QR or by hand — with
 * search and the CSV.
 *
 *   GET /event-checkin/events?scope=upcoming|past   (CHECKIN_STAFF)
 *   GET /events/:id/attendance[/export]             (ATTENDANCE_VIEWERS)
 *
 * Reuses the events admin's EventAttendance screen with `readOnly: true`: no
 * scanner, no Admit. The server adds attendees' email and phone for this role.
 */

type Props = { navigation: any };
type Scope = 'upcoming' | 'past';

export default function SuperEventAttendanceScreen({ navigation }: Props) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const [scope, setScope] = useState<Scope>('upcoming');
  const [events, setEvents] = useState<CheckinEvent[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (mode: 'first' | 'refresh' = 'first') => {
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const list = await listCheckinEvents(scope);
      if (mine === seq.current) setEvents(Array.isArray(list) ? list : []);
    } catch (err: any) {
      if (mine === seq.current) setError(checkinErrorMessage(err, 'The events could not be loaded.'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { load('first'); }, [load]));

  const shown = useMemo(() => {
    const needle = String(query || '').trim().toLowerCase();
    const list = Array.isArray(events) ? events : [];
    if (!needle) return list;
    return list.filter((e) => [e?.title, e?.venue, e?.category].some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [events, query]);

  const totals = useMemo(() => (events || []).reduce(
    (t, e) => ({ registered: t.registered + Number(e?.registered || 0), checkedIn: t.checkedIn + Number(e?.checkedIn || 0) }),
    { registered: 0, checkedIn: 0 },
  ), [events]);
  const turnout = totals.registered > 0 ? Math.round((totals.checkedIn / totals.registered) * 100) : 0;

  const open = useCallback((e: CheckinEvent) => {
    navigation?.navigate?.('EventAttendance', { eventId: e?.id, eventTitle: e?.title, readOnly: true });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: CheckinEvent }) => {
    const registered = Number(item?.registered || 0);
    const inside = Number(item?.checkedIn || 0);
    const online = item?.mode === 'online';
    return (
      <ConsoleCard
        style={s.card}
        accent={item?.isToday ? PALETTE.green : undefined}
        onPress={() => open(item)}
        accessibilityLabel={`${item?.title || 'Untitled event'}, ${inside} of ${registered} checked in`}
      >
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
            <View style={s.meta}>
              <Icon name="how-to-reg" size={15} color={PALETTE.greenDark} />
              <Text style={[s.metaText, s.count]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {inside} checked in · {registered} registered
              </Text>
            </View>
          </View>
          <CoverageRing
            progress={registered > 0 ? inside / registered : 0}
            accent="green"
            center={`${registered > 0 ? Math.round((inside / registered) * 100) : 0}%`}
            caption="turnout"
          />
        </View>
      </ConsoleCard>
    );
  }, [open]);

  const header = (
    <>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · read-only"
        title="Event attendance"
        subtitle="Registered against checked in, for every published event"
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
      />
      <ConsoleGrid overlap>
        <ConsoleStatTile label="Checked in" value={totals.checkedIn} icon="how-to-reg" accent="green" hint={`${turnout}% turnout`} />
        <ConsoleStatTile label="Registered" value={totals.registered} icon="confirmation-number" accent="indigo" hint={`${(events || []).length} events`} delay={60} />
      </ConsoleGrid>
      <ConsoleSearch value={query} onChangeText={setQuery} placeholder="Search events by name or venue" />
      <ConsoleTabs
        options={[{ value: 'upcoming', label: 'Today & upcoming' }, { value: 'past', label: 'Past' }]}
        value={scope}
        onChange={(v) => setScope(v as Scope)}
        style={s.tabs}
      />
      {error ? <ConsoleState kind="error" title="Could not load events" message={error} action="Try again" onAction={() => load('first')} /> : null}
      {loading && !error ? <ConsoleSkeleton rows={3} /> : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || error ? [] : shown}
        keyExtractor={(item, index) => String(item?.id || index)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? (
          <ConsoleState
            title={query ? 'No match' : scope === 'past' ? 'No past events' : 'No events coming up'}
            message={query ? 'Try another name.' : 'Published events appear here with their attendance.'}
          />
        ) : null}
        ListFooterComponent={!loading && !error ? (
          <ConsoleNote
            style={s.note}
            icon="language"
            text="Registered counts paid and free confirmed seats. Bookings and payments are under More → Bookings & revenue."
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
  tabs: { marginTop: SPACE.md, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginBottom: SPACE.xs },
  title: { ...TYPE.heading, fontSize: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  count: { color: PALETTE.greenDark, fontWeight: '700' },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;

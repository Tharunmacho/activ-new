import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleButton,
  ConsoleSectionTitle, ConsoleSkeleton, ConsoleState, ConsoleNote, CoverageRing, GlassIconButton,
  EventTicket3D, consoleGreeting,
} from '../../ui';
import { useAuthStore } from '../../stores/exampleStore';
import {
  checkinErrorMessage, listCheckinEvents, listProgrammeEvents, programmeCounts,
  type CheckinEvent, type ProgrammeEvent,
} from '../../services/eventCheckinApi';
import { eventWhen } from './checkinKit';

/**
 * ============================================================================
 * EVENTS ADMIN — Dashboard
 * ============================================================================
 *
 * The door at a glance: what is on today and how full the hall is, what is
 * coming, and how the last events turned out. Plus the programme counts the
 * website's Events Dashboard shows (published / drafts / upcoming).
 *
 *   GET /event-checkin/events?scope=upcoming|past   registered vs checked in
 *   GET /cms/events                                 the programme, drafts included
 *
 * NO MONEY HERE, by the server's decision: bookings and takings are the super
 * admin's alone (BOOKING_VIEWERS in event.routes.js), and the website's
 * events-admin portal shows neither. "Registered" is confirmed paid + free
 * seats — the ones the door will admit.
 *
 * The programme counts load separately and fail soft: a CMS list that does not
 * answer must not blank the door figures.
 */

type Props = { navigation: any };

const pct = (inside: number, registered: number) => (registered > 0 ? Math.round((inside / registered) * 100) : 0);

function EventRow({ e, big, go }: { e: CheckinEvent; big?: boolean; go: (name: string, params?: any) => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const registered = Number(e?.registered || 0);
  const inside = Number(e?.checkedIn || 0);
  return (
    <ConsoleCard style={s.card} accent={e?.isToday ? PALETTE.green : undefined}>
      <View style={s.row}>
        <View style={s.flexText}>
          <View style={s.chips}>
            {e?.isToday ? <ConsoleChip label="Today" kind="approved" /> : null}
            {e?.mode === 'online' ? <ConsoleChip label="Online" kind="neutral" icon="videocam" /> : null}
            {e?.category ? <ConsoleChip label={e.category} kind="info" dot={false} /> : null}
          </View>
          <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{e?.title || 'Untitled event'}</Text>
          <View style={s.meta}>
            <Icon name="event" size={15} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{eventWhen(e?.startAt)}</Text>
          </View>
          {e?.venue && e?.mode !== 'online' ? (
            <View style={s.meta}>
              <Icon name="place" size={15} color={PALETTE.textMuted} />
              <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{e.venue}</Text>
            </View>
          ) : null}
        </View>
        <CoverageRing
          progress={registered > 0 ? inside / registered : 0}
          accent="green"
          size={big ? 68 : 56}
          center={`${inside}`}
          caption={`of ${registered}`}
        />
      </View>
      {big ? (
        <View style={s.actions}>
          <ConsoleButton size="sm" icon="qr-code-scanner" label="Scan" onPress={() => go('EventCheckinScanner', { eventId: e?.id, eventTitle: e?.title })} style={s.flexBtn} />
          <ConsoleButton size="sm" kind="soft" icon="groups" label="Bookings" onPress={() => go('EventDoorBookings', { eventId: e?.id, eventTitle: e?.title })} style={s.flexBtn} />
          <ConsoleButton size="sm" kind="soft" icon="fact-check" label="List" accessibilityLabel="Attendance" onPress={() => go('EventAttendance', { eventId: e?.id, eventTitle: e?.title })} style={s.flexBtn} />
        </View>
      ) : (
        <View style={s.actions}>
          <ConsoleButton size="sm" kind="soft" icon="groups" label="Bookings" onPress={() => go('EventDoorBookings', { eventId: e?.id, eventTitle: e?.title })} style={s.flexBtn} />
          <ConsoleButton size="sm" kind="ghost" icon="fact-check" label="Attendance" onPress={() => go('EventAttendance', { eventId: e?.id, eventTitle: e?.title })} style={s.flexBtn} />
        </View>
      )}
    </ConsoleCard>
  );
}

/** Live counts while the screen is open — check-ins at the door appear within ~10 s. */
const LIVE_MS = 10000;

export default function EventsAdminDashboardScreen({ navigation }: Props) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const { user } = useAuthStore();
  const [upcoming, setUpcoming] = useState<CheckinEvent[]>([]);
  const [past, setPast] = useState<CheckinEvent[]>([]);
  const [programme, setProgramme] = useState<ProgrammeEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'first') setLoading(true);
    setError('');
    const [up, old, prog] = await Promise.allSettled([
      listCheckinEvents('upcoming'),
      listCheckinEvents('past'),
      listProgrammeEvents(),
    ]);
    if (mine !== seq.current) return;
    if (up.status === 'fulfilled') setUpcoming(Array.isArray(up.value) ? up.value : []);
    else setError(checkinErrorMessage(up.reason, 'The events could not be loaded.'));
    if (old.status === 'fulfilled') setPast(Array.isArray(old.value) ? old.value : []);
    setProgramme(prog.status === 'fulfilled' ? (Array.isArray(prog.value) ? prog.value : []) : null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const firstLoad = useRef(true);
  // Load on focus, then keep today's counts live while the screen is in front.
  useFocusEffect(useCallback(() => {
    load(firstLoad.current ? 'first' : 'quiet');
    firstLoad.current = false;
    const timer = setInterval(() => { load('quiet'); }, LIVE_MS);
    return () => clearInterval(timer);
  }, [load]));

  const today = useMemo(() => (upcoming || []).filter((e) => !!e?.isToday), [upcoming]);
  const next = useMemo(() => (upcoming || []).filter((e) => !e?.isToday).slice(0, 5), [upcoming]);
  const recent = useMemo(() => (past || []).slice(0, 3), [past]);

  const todayTotals = useMemo(() => (today || []).reduce(
    (t, e) => ({ registered: t.registered + Number(e?.registered || 0), checkedIn: t.checkedIn + Number(e?.checkedIn || 0) }),
    { registered: 0, checkedIn: 0 },
  ), [today]);
  const upcomingSeats = useMemo(
    () => (upcoming || []).reduce((n, e) => n + Number(e?.registered || 0), 0),
    [upcoming],
  );
  const counts = useMemo(() => (programme ? programmeCounts(programme) : null), [programme]);

  const go = useCallback((name: string, params?: any) => navigation?.navigate?.(name, params), [navigation]);


  return (
    <ConsoleScroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
    >
      <ConsoleHeader
        eyebrow={consoleGreeting()}
        title="Events console"
        subtitle={user?.fullName ? `Signed in as ${user.fullName}` : 'Today at the door, and the programme ahead'}
        art={<EventTicket3D size={104} />}
        right={<GlassIconButton icon="qr-code-scanner" accessibilityLabel="Choose an event to scan" onPress={() => go('Events')} />}
        badges={[{ icon: 'badge', label: 'Event Attendance Admin' }, { icon: 'today', label: `${today.length} today` }]}
      />

      <ConsoleGrid overlap>
        <ConsoleStatTile
          label="Checked in today"
          value={todayTotals.checkedIn}
          icon="how-to-reg"
          accent="green"
          hint={today.length ? `${pct(todayTotals.checkedIn, todayTotals.registered)}% of ${todayTotals.registered}` : 'no event today'}
        />
        <ConsoleStatTile
          label="Registered"
          value={upcomingSeats}
          icon="confirmation-number"
          accent="indigo"
          hint="seats, today & upcoming"
          delay={60}
          onPress={() => go('Events')}
        />
        <ConsoleStatTile
          label="Upcoming"
          value={counts ? counts.upcoming : '–'}
          icon="event-available"
          accent="sky"
          hint={counts ? `${counts.published} published` : 'programme unavailable'}
          delay={120}
          onPress={() => go('Events')}
        />
        <ConsoleStatTile
          label="Drafts"
          value={counts ? counts.drafts : '–'}
          icon="edit-note"
          accent="amber"
          hint="finish on the website"
          delay={180}
        />
      </ConsoleGrid>

      <View style={s.gutter}>
        {/* A pass only works at its own event's door — pick the event first. */}
        <ConsoleButton icon="qr-code-scanner" label="Choose an event to scan" onPress={() => go('Events')} />
      </View>

      {error ? (
        <ConsoleState kind="error" title="Could not load events" message={error} action="Try again" onAction={() => load('first')} />
      ) : null}
      {loading && !error ? <ConsoleSkeleton rows={3} /> : null}

      {!loading && !error ? (
        <>
          <ConsoleSectionTitle
            title="Today at the door"
            subtitle={today.length ? 'Live counts — pull to refresh' : undefined}
            icon="door-front"
            style={s.section}
          />
          {today.length ? today.map((e, i) => <EventRow key={String(e?.id || i)} e={e} big go={go} />) : (
            <ConsoleCard style={s.card}>
              <View style={s.emptyRow}>
                <Icon name="event-busy" size={22} color={PALETTE.textMuted} />
                <Text style={s.emptyText} maxFontSizeMultiplier={1.3}>No event is on today.</Text>
              </View>
            </ConsoleCard>
          )}

          <ConsoleSectionTitle
            title="Coming up"
            icon="upcoming"
            action={(upcoming || []).length ? 'All events' : undefined}
            onAction={() => go('Events')}
            style={s.section}
          />
          {next.length ? next.map((e, i) => <EventRow key={String(e?.id || i)} e={e} go={go} />) : (
            <ConsoleCard style={s.card}>
              <View style={s.emptyRow}>
                <Icon name="event-note" size={22} color={PALETTE.textMuted} />
                <Text style={s.emptyText} maxFontSizeMultiplier={1.3}>Nothing else is scheduled yet.</Text>
              </View>
            </ConsoleCard>
          )}

          {recent.length ? (
            <>
              <ConsoleSectionTitle title="Recently held" icon="history" style={s.section} />
              {recent.map((e, i) => <EventRow key={String(e?.id || i)} e={e} go={go} />)}
            </>
          ) : null}
        </>
      ) : null}

      <ConsoleNote
        icon="language"
        style={s.note}
        text="Writing events, categories, gallery, news and schemes stays on the ACTIV website. Payments and cancellations are handled by the Super Admin."
      />
    </ConsoleScroll>
  );
}

const s = StyleSheet.create({
  gutter: { paddingHorizontal: SPACE.lg, marginTop: SPACE.xs },
  section: { marginTop: SPACE.xl },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginBottom: SPACE.xs },
  title: { ...TYPE.heading, fontSize: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  flexBtn: { flex: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  emptyText: { ...TYPE.body, color: PALETTE.textMuted, flex: 1 },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.xl },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;

import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs,
  ConsoleSearch, ConsoleSkeleton, ConsoleState, ConsoleNote, CoverageRing, GlassIconButton, CONSOLE_LIST,
} from '../../ui';
import {
  checkinErrorMessage, doorStateOf, filterDoorBookings, getAttendance, groupDoorBookings,
  type DoorBooking, type DoorFilter,
} from '../../services/eventCheckinApi';

/**
 * ============================================================================
 * DOOR BOOKINGS — one event's registrations, one card per booking
 * ============================================================================
 *
 * The events admin's bookings view. It is built from the ATTENDANCE list
 * (GET /events/:id/attendance), grouped by booking ID, because that is what
 * the server lets this role read: the booking endpoints (/events/:id/bookings,
 * /attendees, /bookings/overview, record-payment, cancel) are the super
 * admin's alone — BOOKING_VIEWERS in event.routes.js — and the website's
 * events-admin portal has no Bookings section for the same reason.
 *
 * So: who booked, how many seats, how many are inside, the payment label
 * (only paid and free seats are admissible, so those are what is listed) and
 * the booking ID. No amounts, no contact details. Tapping a booking opens every
 * seat on it with an Admit button each.
 */

type Props = { navigation: any; route: any };

export default function EventDoorBookingsScreen({ navigation, route }: Props) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const eventId: string = String(route?.params?.eventId || '');
  const eventTitle: string = String(route?.params?.eventTitle || '');

  const [bookings, setBookings] = useState<DoorBooking[]>([]);
  const [title, setTitle] = useState(eventTitle);
  const [filter, setFilter] = useState<DoorFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (mode: 'first' | 'refresh' = 'first') => {
    if (!eventId) { setLoading(false); setError('No event was chosen.'); return; }
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const data = await getAttendance(eventId, {});
      if (mine !== seq.current) return;
      setBookings(groupDoorBookings(data?.rows));
      if (data?.event?.title) setTitle(data.event.title);
    } catch (err: any) {
      if (mine === seq.current) setError(checkinErrorMessage(err, 'The bookings could not be loaded.'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [eventId]);

  // Back from a booking where someone was admitted: the counts have moved.
  useFocusEffect(useCallback(() => { load('first'); }, [load]));

  const counts = useMemo(() => {
    const list = bookings || [];
    return {
      all: list.length,
      waiting: list.filter((b) => doorStateOf(b) === 'waiting').length,
      partial: list.filter((b) => doorStateOf(b) === 'partial').length,
      in: list.filter((b) => doorStateOf(b) === 'in').length,
      seats: list.reduce((n, b) => n + Number(b?.seats || 0), 0),
      inside: list.reduce((n, b) => n + Number(b?.checkedIn || 0), 0),
    };
  }, [bookings]);

  const shown = useMemo(() => filterDoorBookings(bookings, query, filter), [bookings, query, filter]);

  const open = useCallback((b: DoorBooking) => {
    navigation?.navigate?.('EventBookingDetail', { eventId, eventTitle: title, bookingRef: b?.bookingRef });
  }, [navigation, eventId, title]);

  const renderItem = useCallback(({ item }: { item: DoorBooking }) => {
    const state = doorStateOf(item);
    const seats = Number(item?.seats || 0);
    const inside = Number(item?.checkedIn || 0);
    const others = (item?.names || []).filter((n) => n && n !== item?.bookedBy);
    return (
      <ConsoleCard
        style={s.card}
        accent={state === 'in' ? PALETTE.green : state === 'partial' ? PALETTE.amber : undefined}
        onPress={() => open(item)}
        accessibilityLabel={`Booking ${item?.bookingRef}, ${inside} of ${seats} checked in`}
      >
        <View style={s.row}>
          <View style={s.flexText}>
            <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item?.bookedBy || 'Booking'}</Text>
            <Text style={s.ref} numberOfLines={1} selectable maxFontSizeMultiplier={1.3}>{item?.bookingRef}</Text>
            <View style={s.chips}>
              <ConsoleChip label={`${seats} seat${seats === 1 ? '' : 's'}`} kind="info" icon="event-seat" />
              {item?.payment ? (
                <ConsoleChip label={item.payment} kind={/pending|failed/i.test(item.payment) ? 'rejected' : 'approved'} />
              ) : null}
              {item?.bookingStatus === 'changed' ? <ConsoleChip label="Changed" kind="warning" /> : null}
            </View>
          </View>
          <CoverageRing
            progress={seats > 0 ? inside / seats : 0}
            accent={state === 'in' ? 'green' : 'amber'}
            size={56}
            center={`${inside}/${seats}`}
          />
        </View>
        {others.length ? (
          <View style={s.meta}>
            <Icon name="group" size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{others.join(', ')}</Text>
          </View>
        ) : null}
      </ConsoleCard>
    );
  }, [open]);

  const header = (
    <>
      <ConsoleHeader
        compact
        eyebrow="Bookings at the door"
        title={title || 'Event'}
        subtitle="Every paid or free booking, and how much of each party is inside"
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
        right={<GlassIconButton
          icon="qr-code-scanner"
          accessibilityLabel="Scan passes"
          onPress={() => navigation?.navigate?.('EventCheckinScanner', { eventId, eventTitle: title })}
        />}
      />
      <ConsoleGrid overlap>
        <ConsoleStatTile label="Bookings" value={counts.all} icon="confirmation-number" accent="indigo" hint={`${counts.seats} seats`} />
        <ConsoleStatTile label="Inside" value={counts.inside} icon="how-to-reg" accent="green" hint={`${counts.in} parties complete`} delay={60} />
      </ConsoleGrid>
      <ConsoleSearch value={query} onChangeText={setQuery} placeholder="Search booker, attendee or booking ID" />
      <ConsoleTabs
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'waiting', label: 'Waiting', count: counts.waiting },
          { value: 'partial', label: 'Partly in', count: counts.partial },
          { value: 'in', label: 'All in', count: counts.in },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as DoorFilter)}
        style={s.tabs}
      />
      {error ? <ConsoleState kind="error" title="Could not load" message={error} action="Try again" onAction={() => load('first')} /> : null}
      {loading && !error ? <ConsoleSkeleton rows={4} /> : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || error ? [] : shown}
        keyExtractor={(item, index) => String(item?.bookingRef || index)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? (
          <ConsoleState
            title={query ? 'No match' : 'No bookings here'}
            message={query ? 'Try another name or booking ID.' : 'Confirmed bookings for this event appear here.'}
          />
        ) : null}
        ListFooterComponent={!loading && !error ? (
          <ConsoleNote
            style={s.note}
            icon="lock-outline"
            text="Unpaid, cancelled and waitlisted bookings, amounts and contact details are with the Super Admin."
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
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0 },
  name: { ...TYPE.bodyStrong },
  ref: { ...TYPE.caption, marginTop: 2, fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;

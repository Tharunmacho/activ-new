import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, RADIUS,
  ConsoleFrame, ConsoleHeader, ConsoleCard, ConsoleChip, ConsoleButton, ConsoleSkeleton, ConsoleState,
  ConsoleNote, CoverageRing, GlassIconButton, CONSOLE_LIST,
} from '../../ui';
import {
  admitSeat, checkinErrorMessage, lookupBooking, type CheckinSeat,
} from '../../services/eventCheckinApi';
import { eventWhen } from './checkinKit';

/**
 * ============================================================================
 * BOOKING AT THE DOOR — every seat on one booking, admitted one by one
 * ============================================================================
 *
 * POST /event-checkin/lookup { bookingRef, eventId } answers every seat on the
 * booking with its own verdict (admissible, or the reason it is refused) and
 * its check-in, if any. "Admit" sends POST /event-checkin/admit for that seat
 * with method 'manual' — idempotent on the server, so a seat another gate let
 * in a moment ago comes back `already_checked_in`, never a second row.
 *
 * `readOnly: true` (the super admin, from Event attendance) shows the same
 * seats with no Admit buttons.
 *
 * Every seat is a card inline in the list — no native Modal (CLAUDE.md Rule 2).
 */

type Props = { navigation: any; route: any };

const Fact = ({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const text = String(value ?? '').trim();
  if (!text) return null;
  return (
    <View style={s.fact}>
      <Text style={s.factLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={[s.factValue, mono && s.mono]} selectable maxFontSizeMultiplier={1.3}>{text}</Text>
    </View>
  );
};

export default function EventBookingDetailScreen({ navigation, route }: Props) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const eventId: string = String(route?.params?.eventId || '');
  const eventTitle: string = String(route?.params?.eventTitle || '');
  const bookingRef: string = String(route?.params?.bookingRef || '');
  const readOnly: boolean = route?.params?.readOnly === true;

  const [seats, setSeats] = useState<CheckinSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [bulk, setBulk] = useState(false);
  const [seatErrors, setSeatErrors] = useState<Record<number, string>>({});
  const [justAdmitted, setJustAdmitted] = useState<Record<number, boolean>>({});
  const seq = useRef(0);

  const load = useCallback(async (mode: 'first' | 'refresh' = 'first') => {
    if (!bookingRef) { setLoading(false); setError('No booking was chosen.'); return; }
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await lookupBooking(bookingRef, eventId || undefined);
      if (mine === seq.current) setSeats(Array.isArray(res?.seats) ? res.seats : []);
    } catch (err: any) {
      if (mine === seq.current) setError(checkinErrorMessage(err, 'The booking could not be loaded.'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [bookingRef, eventId]);

  useFocusEffect(useCallback(() => { load('first'); }, [load]));

  const first = seats?.[0] || null;
  const total = (seats || []).length;
  const inside = (seats || []).filter((x) => !!x?.checkedIn).length;
  const waiting = useMemo(
    () => (seats || []).filter((x) => !x?.checkedIn && !!x?.admissible),
    [seats],
  );

  /** Admit one seat; the server's answer replaces that seat's card. */
  const admitOne = useCallback(async (seat: CheckinSeat): Promise<boolean> => {
    const index = Number(seat?.participantIndex ?? -1);
    if (index < 0) return false;
    setBusyIndex(index);
    setSeatErrors((m) => ({ ...m, [index]: '' }));
    try {
      const res = await admitSeat({
        bookingRef: seat?.bookingRef || bookingRef,
        participantIndex: index,
        ...(eventId ? { eventId } : {}),
        method: 'manual',
      });
      const next = res?.seat;
      if (next) setSeats((list) => (list || []).map((x) => (Number(x?.participantIndex) === index ? next : x)));
      if (res?.outcome === 'admitted') setJustAdmitted((m) => ({ ...m, [index]: true }));
      return true;
    } catch (err: any) {
      setSeatErrors((m) => ({ ...m, [index]: checkinErrorMessage(err, 'Entry could not be recorded. Try again.') }));
      return false;
    } finally {
      setBusyIndex(null);
    }
  }, [bookingRef, eventId]);

  const admitAll = useCallback(() => {
    const list = waiting || [];
    if (!list.length || bulk) return;
    Alert.alert(
      `Admit ${list.length} ${list.length === 1 ? 'person' : 'people'}?`,
      'Check each person’s photo ID against the names on this booking first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Admit all',
          onPress: async () => {
            setBulk(true);
            try {
              // One at a time: the server's per-seat idempotency is the guard.
              for (const seat of list) {
                await admitOne(seat);
              }
            } finally {
              setBulk(false);
            }
          },
        },
      ],
    );
  }, [waiting, bulk, admitOne]);

  const renderItem = useCallback(({ item }: { item: CheckinSeat }) => {
    const index = Number(item?.participantIndex ?? -1);
    const checked = !!item?.checkedIn;
    const refused = !checked && !item?.admissible;
    const who = item?.checkin?.admittedBy?.name || item?.checkin?.admittedBy?.email || '';
    const errText = seatErrors?.[index] || '';
    const accent = checked ? PALETTE.green : refused ? PALETTE.red : PALETTE.indigo;
    return (
      <ConsoleCard style={s.card} accent={accent}>
        <View style={s.row}>
          <View style={[s.seatBadge, { backgroundColor: checked ? PALETTE.greenSoft : refused ? PALETTE.redSoft : PALETTE.indigoSoft }]}>
            <Text style={[s.seatNo, { color: checked ? PALETTE.greenDark : refused ? PALETTE.redDark : PALETTE.indigoDark }]}>
              {Number(item?.participantNumber || index + 1)}
            </Text>
          </View>
          <View style={s.flexText}>
            <Text style={s.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item?.attendee?.name || 'Attendee'}</Text>
            <Text style={s.reg} numberOfLines={1} selectable maxFontSizeMultiplier={1.3}>{item?.registrationNo || ''}</Text>
          </View>
          <ConsoleChip
            label={checked ? (justAdmitted?.[index] ? 'Admitted' : 'Checked in') : refused ? 'Refused' : 'Not yet'}
            kind={checked ? 'approved' : refused ? 'rejected' : 'neutral'}
          />
        </View>

        {checked ? (
          <View style={s.meta}>
            <Icon name={item?.checkin?.method === 'manual' ? 'keyboard' : 'qr-code-2'} size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {item?.checkin?.admittedAtLabel || 'Checked in'}{who ? ` · by ${who}` : ''}
              {item?.checkin?.method ? ` · ${item.checkin.method === 'manual' ? 'manual entry' : 'QR scan'}` : ''}
            </Text>
          </View>
        ) : refused ? (
          <View style={[s.warn, s.warnRed]}>
            <Icon name="block" size={15} color={PALETTE.redDark} />
            <Text style={[s.warnText, { color: PALETTE.redDark }]} maxFontSizeMultiplier={1.3}>
              {item?.reason?.message || 'This seat cannot be admitted.'}
            </Text>
          </View>
        ) : null}

        {item?.attendee?.phoneMasked ? (
          <View style={s.meta}>
            <Icon name="phone" size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item.attendee.phoneMasked}</Text>
          </View>
        ) : null}

        {errText ? (
          <View style={[s.warn, s.warnRed]}>
            <Icon name="error-outline" size={15} color={PALETTE.redDark} />
            <Text style={[s.warnText, { color: PALETTE.redDark }]} maxFontSizeMultiplier={1.3}>{errText}</Text>
          </View>
        ) : null}

        {!readOnly && !checked && item?.admissible ? (
          <ConsoleButton
            size="sm"
            kind="approve"
            icon="how-to-reg"
            label="Admit"
            accessibilityLabel={`Admit ${item?.attendee?.name || 'attendee'}`}
            onPress={() => { admitOne(item); }}
            loading={busyIndex === index}
            disabled={busyIndex !== null || bulk}
            style={s.admit}
          />
        ) : null}
      </ConsoleCard>
    );
  }, [seatErrors, justAdmitted, readOnly, busyIndex, bulk, admitOne]);

  const ticket = [first?.ticket?.category, first?.ticket?.label].filter(Boolean).join(' · ');
  const paid = first?.payment?.status === 'paid' || first?.payment?.status === 'not_required';

  const header = (
    <>
      <ConsoleHeader
        compact
        eyebrow={readOnly ? 'Booking · read-only' : 'Booking at the door'}
        title={first?.bookedBy?.name || bookingRef || 'Booking'}
        subtitle={first?.event?.title || eventTitle || undefined}
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
      />
      {error ? <ConsoleState kind="error" title="Could not load" message={error} action="Try again" onAction={() => load('first')} /> : null}
      {loading && !error ? <ConsoleSkeleton rows={3} /> : null}
      {!loading && !error && first ? (
        <ConsoleCard style={s.summary}>
          <View style={s.row}>
            <View style={s.flexText}>
              <View style={s.chips}>
                <ConsoleChip label={`${total} seat${total === 1 ? '' : 's'}`} kind="info" icon="event-seat" />
                {first?.payment?.label ? <ConsoleChip label={first.payment.label} kind={paid ? 'approved' : 'rejected'} /> : null}
                {first?.bookingStatus && first.bookingStatus !== 'active' ? (
                  <ConsoleChip label={first.bookingStatus} kind="warning" />
                ) : null}
              </View>
              <Fact label="Booking ID" value={first?.bookingRef || bookingRef} mono />
              <Fact label="Booked by" value={first?.bookedBy?.name} />
              <Fact label="When" value={eventWhen(first?.event?.startAt)} />
              <Fact label="Ticket" value={ticket} />
            </View>
            <CoverageRing
              progress={total > 0 ? inside / total : 0}
              accent={inside >= total && total > 0 ? 'green' : 'amber'}
              center={`${inside}/${total}`}
              caption="inside"
            />
          </View>
          {!readOnly && (waiting || []).length > 1 ? (
            <ConsoleButton
              kind="approve"
              icon="groups"
              label={`Admit all ${(waiting || []).length} remaining`}
              onPress={admitAll}
              loading={bulk}
              disabled={busyIndex !== null}
              style={s.admitAll}
            />
          ) : null}
        </ConsoleCard>
      ) : null}
      {!loading && !error && first && !first?.eventIsToday ? (
        <ConsoleNote kind="amber" icon="event-busy" style={s.note} text="This event is not scheduled for today." />
      ) : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || error ? [] : seats}
        keyExtractor={(item, index) => String(item?.registrationNo || item?.participantIndex || index)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? (
          <ConsoleState title="No seats" message="This booking has no seats to admit." />
        ) : null}
        ListFooterComponent={!loading && !error && total && !readOnly ? (
          <ConsoleNote
            style={s.note}
            text="Check each person’s photo ID against the name before admitting. Entry is recorded against your account."
          />
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        showsVerticalScrollIndicator={false}
      />
    </ConsoleFrame>
  );
}

const s = StyleSheet.create({
  summary: { marginHorizontal: SPACE.lg, marginTop: SPACE.md, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginBottom: SPACE.sm },
  seatBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  seatNo: { fontSize: 15, fontWeight: '800' },
  name: { ...TYPE.bodyStrong },
  reg: { ...TYPE.caption, marginTop: 2, fontVariant: ['tabular-nums'] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  warn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm,
    backgroundColor: PALETTE.amberSoft, borderRadius: RADIUS.md, padding: SPACE.sm,
  },
  warnRed: { backgroundColor: PALETTE.redSoft },
  warnText: { ...TYPE.label, flex: 1, minWidth: 0 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: 2 },
  factLabel: { ...TYPE.caption, width: 84 },
  factValue: { ...TYPE.bodyStrong, flex: 1, minWidth: 0 },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
  admit: { marginTop: SPACE.md },
  admitAll: { marginTop: SPACE.md },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;

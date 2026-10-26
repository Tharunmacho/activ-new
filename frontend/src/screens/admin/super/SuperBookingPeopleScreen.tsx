import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, money, shortDate,
  ConsoleFrame, ConsoleHeader, ConsoleCard, ConsoleChip, ConsoleSearch, ConsoleSkeleton, ConsoleState, ConsoleNote,
  GlassIconButton, GradientAvatar, CONSOLE_LIST, type ConsoleChipKind,
} from '../../../ui';
import { listBookingPeople, getBookingPerson, errorText } from '../../../services/superApi';
import { MiniAction, callNumber, whatsappNumber } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — Booking people (website Bookings → People tab, BookingPeople)
 * ============================================================================
 *
 * GET /events/bookings/people — everyone who has booked anything, members and
 * guests alike, one row per EMAIL ADDRESS (a guest booking and a signed-in one
 * by the same person are one row with their totals added). Loaded once and
 * searched in place, as the website's table does.
 *
 * Tap a person for their whole history (GET /events/bookings/person?email=),
 * shown inline under the card — the website's slide-over, without a native
 * Modal (CLAUDE.md Rule 2).
 *
 * `BookingPeoplePane` is also the People tab of the Bookings screen; it is a
 * FlatList meant to sit directly inside a ConsoleFrame.
 */

const payTone = (status: string): { label: string; kind: ConsoleChipKind } => (status === 'paid'
  ? { label: 'Paid', kind: 'approved' }
  : status === 'not_required' ? { label: 'Free', kind: 'info' }
    : status === 'failed' ? { label: 'Failed', kind: 'rejected' }
      : { label: 'Unpaid', kind: 'pending' });

const modeWord = (mode: string) => (mode === 'bank_transfer' ? 'Bank' : mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '');
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function Tile({ icon, label, value }: { icon: string; label: string; value: string }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={s.tile}>
      <View style={s.tileHead}>
        <Icon name={icon} size={14} color={PALETTE.indigo} />
        <Text style={s.tileLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label.toUpperCase()}</Text>
      </View>
      <Text style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{value}</Text>
    </View>
  );
}

function Contact({ icon, label, value }: { icon: string; label: string; value?: string }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  if (!String(value || '').trim()) return null;
  return (
    <View style={s.contact}>
      <Icon name={icon} size={16} color={PALETTE.textFaint} style={s.contactIcon} />
      <View style={s.flexText}>
        <Text style={s.contactLabel} maxFontSizeMultiplier={1.3}>{label.toUpperCase()}</Text>
        <Text style={s.contactValue} selectable maxFontSizeMultiplier={1.3}>{value}</Text>
      </View>
    </View>
  );
}

function PersonDetail({ p, bookings, loading }: { p: any; bookings: any[] | null; loading: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const list = Array.isArray(bookings) ? bookings : [];
  return (
    <View style={s.detail}>
      <Contact icon="mail-outline" label="Email" value={p?.email} />
      <Contact icon="phone" label="Mobile" value={p?.phone} />
      <Contact icon="verified-user" label="Account" value={p?.isMember ? 'Signed-in member' : 'Guest checkout only'} />
      <Contact icon="event" label="First booked" value={shortDate(p?.firstBookedAt)} />

      <View style={s.tiles}>
        <Tile icon="confirmation-number" label="Bookings" value={String(Number(p?.bookings || 0))} />
        <Tile icon="event" label="Events" value={String(Number(p?.events || 0))} />
        <Tile icon="groups" label="Seats" value={String(Number(p?.seats || 0))} />
        <Tile icon="currency-rupee" label="Paid" value={money(Number(p?.paid || 0))} />
      </View>
      {Number(p?.pending || 0) > 0 ? (
        <ConsoleNote kind="amber" icon="schedule" style={s.owed} text={`${money(Number(p?.pending || 0))} is owed on a booking that was never completed.`} />
      ) : null}

      <Text style={s.histTitle} maxFontSizeMultiplier={1.3}>Booking history</Text>
      <Text style={s.sub} maxFontSizeMultiplier={1.3}>Newest first.</Text>
      {loading ? <ActivityIndicator style={s.spinner} color={PALETTE.indigo} /> : list.length === 0 ? (
        <Text style={[s.sub, s.gapTop]} maxFontSizeMultiplier={1.3}>No bookings found for this address.</Text>
      ) : list.map((b, i) => {
        const pay = payTone(String(b?.payment?.status || 'pending'));
        const names = (Array.isArray(b?.participants) ? b.participants : []).map((x: any) => String(x?.name || '').trim()).filter(Boolean);
        const seats = Number(b?.noOfPersons || 0);
        return (
          <View key={String(b?.bookingRef || i)} style={[s.bRow, i === list.length - 1 && s.bRowLast]}>
            <View style={s.bHead}>
              <View style={s.flexText}>
                <Text style={s.bTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>{b?.eventTitle || 'Untitled event'}</Text>
                <Text style={s.mono} maxFontSizeMultiplier={1.2}>{b?.bookingRef || ''}{b?.eventStartAt ? ` · ${shortDate(b.eventStartAt)}` : ''}</Text>
              </View>
              <View style={s.alignEnd}>
                <Text style={s.bAmount} maxFontSizeMultiplier={1.2}>{Number(b?.totalAmount || 0) > 0 ? money(Number(b?.totalAmount || 0)) : 'Free'}</Text>
                <Text style={s.sub} maxFontSizeMultiplier={1.2}>{plural(seats, 'seat')}</Text>
              </View>
            </View>
            <View style={s.chips}>
              <ConsoleChip label={pay.label} kind={pay.kind} />
              {b?.payment?.mode ? <ConsoleChip label={modeWord(String(b.payment.mode))} kind="info" dot={false} /> : null}
              {b?.status === 'cancelled' ? <ConsoleChip label="Cancelled" kind="rejected" /> : null}
              {b?.status === 'waitlist' ? <ConsoleChip label="Waiting list" kind="warning" /> : null}
              {b?.memberRateApplied ? (
                <ConsoleChip label={`Member rate${Number(b?.memberSaving || 0) > 0 ? ` · saved ${money(Number(b?.memberSaving || 0))}` : ''}`} kind="approved" icon="loyalty" />
              ) : null}
            </View>
            {names.length ? <Text style={[s.sub, s.gapTop]} maxFontSizeMultiplier={1.3}>{names.join(' · ')}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function PersonCard({ p, index, open, bookings, loading, onToggle }: {
  p: any; index: number; open: boolean; bookings: any[] | null; loading: boolean; onToggle: () => void;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const events = Number(p?.events || 0);
  const seats = Number(p?.seats || 0);
  return (
    <ConsoleCard style={s.card} accent={Number(p?.pending || 0) > 0 ? PALETTE.amber : undefined}>
      <View style={s.row}>
        <GradientAvatar name={p?.name || p?.email || '?'} size={46} tone="admin" ring={false} />
        <View style={s.flexText}>
          <Text style={s.eyebrowNo} maxFontSizeMultiplier={1.2}>#{index + 1}</Text>
          {p?.name
            ? <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>{p.name}</Text>
            : <Text style={[s.name, s.noName]} numberOfLines={1} maxFontSizeMultiplier={1.3}>No name given</Text>}
          <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{p?.email || ''}</Text>
          <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{p?.phone || '—'}{p?.lastBookedAt ? ` · last booked ${shortDate(p.lastBookedAt)}` : ''}</Text>
        </View>
        <View style={[s.alignEnd, s.badgeCol]}>
          <ConsoleChip label={p?.isMember ? 'Member' : 'Guest'} kind={p?.isMember ? 'info' : 'neutral'} />
          {p?.hasMemberRate ? <ConsoleChip label="Member rate" kind="approved" dot={false} style={s.gapTopSm} /> : null}
        </View>
      </View>
      <View style={s.figures}>
        <Text style={s.fig} maxFontSizeMultiplier={1.3}><Text style={s.figStrong}>{Number(p?.bookings || 0)}</Text> booking{Number(p?.bookings || 0) === 1 ? '' : 's'}</Text>
        <Text style={s.fig} maxFontSizeMultiplier={1.3}>{plural(events, 'event')} · {plural(seats, 'seat')}</Text>
        <Text style={[s.fig, s.figStrong]} maxFontSizeMultiplier={1.3}>{money(Number(p?.paid || 0))}</Text>
        {Number(p?.pending || 0) > 0 ? <Text style={[s.fig, s.unpaid]} maxFontSizeMultiplier={1.3}>{money(Number(p?.pending || 0))} unpaid</Text> : null}
      </View>
      <View style={s.actions}>
        {p?.phone ? <MiniAction icon="call" label="Call" onPress={() => callNumber(p?.phone)} /> : null}
        {p?.phone ? <MiniAction icon="chat" label="WhatsApp" color={PALETTE.greenDark} onPress={() => whatsappNumber(p?.phone)} /> : null}
        <View style={s.flex} />
        <MiniAction
          icon={open ? 'expand-less' : 'visibility'}
          label={open ? 'Close' : 'View'}
          onPress={onToggle}
        />
      </View>
      {open ? <PersonDetail p={p} bookings={bookings} loading={loading} /> : null}
    </ConsoleCard>
  );
}

/** The people list, with whatever header the host screen puts above it. */
const NO_FILTERS = {};
export function BookingPeoplePane({ header, refreshKey = 0, filters = NO_FILTERS }: { header?: React.ReactElement | null; refreshKey?: number; filters?: import('../../../services/bookingFilters').BookingFiltersValue }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openEmail, setOpenEmail] = useState('');
  const [history, setHistory] = useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const data = await listBookingPeople('', filters);
      if (mine === seq.current) setPeople(Array.isArray(data?.people) ? data.people : []);
    } catch (err) {
      if (mine === seq.current) setError(errorText(err, 'The list could not be loaded'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [filters]);
  useEffect(() => { load(refreshKey ? 'refresh' : 'load'); }, [load, refreshKey]);

  const toggle = useCallback(async (p: any) => {
    const email = String(p?.email || '');
    if (openEmail === email) { setOpenEmail(''); setHistory(null); return; }
    setOpenEmail(email); setHistory(null); setHistoryLoading(true);
    try {
      const data = await getBookingPerson(email, filters);
      setHistory(Array.isArray(data?.bookings) ? data.bookings : []);
    } catch (err) {
      setError(errorText(err, 'That history could not be loaded'));
      setHistory([]);
    } finally { setHistoryLoading(false); }
  }, [openEmail, filters]);

  const rows = useMemo(() => {
    const needle = (q || '').trim().toLowerCase();
    const list = Array.isArray(people) ? people : [];
    if (!needle) return list;
    return list.filter((p) => [p?.name, p?.email, p?.phone].some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [people, q]);

  const total = Array.isArray(people) ? people.length : 0;

  const listHeader = (
    <>
      {header || null}
      {!filters.history ? <ConsoleSearch value={q} onChangeText={setQ} placeholder="Search a name, email address or mobile number" /> : null}
      {error && people ? <ConsoleNote kind="red" icon="error-outline" text={error} style={s.note} /> : null}
      {total ? (
        <Text style={s.count} maxFontSizeMultiplier={1.3}>{rows.length === total ? (total === 1 ? '1 person' : `${total} people`) : `${rows.length} of ${total}`}</Text>
      ) : null}
      {error && !people ? <ConsoleState kind="error" title="Could not load the people" message={error} action="Try again" onAction={() => load('load')} /> : null}
      {loading && !people && !error ? <ConsoleSkeleton rows={3} style={s.skeleton} /> : null}
    </>
  );

  return (
    <FlatList
      data={people ? rows : []}
      keyExtractor={(p, i) => String(p?.email || i)}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      contentContainerStyle={CONSOLE_LIST}
      ListHeaderComponent={listHeader}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={people ? <ConsoleState title={q ? 'Nobody matches' : 'Nobody has booked an event yet.'} message={q ? 'Try another name, email or number.' : undefined} /> : null}
      ListFooterComponent={total ? (
        <ConsoleNote
          style={s.note}
          text="One row per person, matched on their email address — so somebody who booked once as a guest and once signed in appears once, with their totals added together. Bookings, events and seats are three different numbers: one booking can cover four seats at a single event."
        />
      ) : null}
      renderItem={({ item, index }) => (
        <PersonCard
          p={item}
          index={index}
          open={openEmail === String(item?.email || '')}
          bookings={history}
          loading={historyLoading}
          onToggle={() => toggle(item)}
        />
      )}
    />
  );
}

const SuperBookingPeopleScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  return (
    <ConsoleFrame>
      <BookingPeoplePane
        header={(
          <ConsoleHeader
            compact
            eyebrow="Super Admin · bookings"
            title="Booking people"
            subtitle="Everyone who has booked an event"
            left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
          />
        )}
      />
    </ConsoleFrame>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  alignEnd: { alignItems: 'flex-end' },
  badgeCol: { maxWidth: 120 },
  gapTop: { marginTop: SPACE.xs + 2 },
  gapTopSm: { marginTop: SPACE.xs },
  spinner: { marginTop: SPACE.md },
  skeleton: { marginTop: SPACE.md },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm, marginBottom: SPACE.sm },
  count: { ...TYPE.caption, fontWeight: '700', paddingHorizontal: SPACE.lg, marginTop: SPACE.md, marginBottom: SPACE.sm },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  eyebrowNo: { fontSize: 10, fontWeight: '800', color: PALETTE.textFaint },
  name: { ...TYPE.subheading, fontWeight: '800' },
  noName: { fontStyle: 'italic', fontWeight: '600', color: PALETTE.textFaint },
  sub: { ...TYPE.caption, marginTop: 2 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.md },
  fig: { fontSize: 12, color: PALETTE.textMuted, fontWeight: '600' },
  figStrong: { color: PALETTE.text, fontWeight: '800' },
  unpaid: { color: PALETTE.amberDark, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  detail: { marginTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider, paddingTop: SPACE.md },
  contact: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.sm },
  contactIcon: { marginTop: 2 },
  contactLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: PALETTE.textFaint },
  contactValue: { fontSize: 14, fontWeight: '700', color: PALETTE.text, marginTop: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  tile: { flexGrow: 1, flexBasis: '45%', minWidth: 0, backgroundColor: PALETTE.canvasAdmin, borderRadius: 14, padding: SPACE.md },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: PALETTE.textMuted },
  tileValue: { fontSize: 20, fontWeight: '800', color: PALETTE.text, marginTop: 4 },
  owed: { marginTop: SPACE.md },
  histTitle: { ...TYPE.subheading, fontWeight: '800', marginTop: SPACE.lg },
  bRow: { paddingVertical: SPACE.md, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  bRowLast: { borderBottomWidth: 0 },
  bHead: { flexDirection: 'row', gap: SPACE.sm },
  bTitle: { fontSize: 14, fontWeight: '800', color: PALETTE.text },
  bAmount: { fontSize: 14, fontWeight: '800', color: PALETTE.text },
  mono: { fontSize: 11, color: PALETTE.textMuted, marginTop: 2, fontFamily: 'monospace' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
});

export default SuperBookingPeopleScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;

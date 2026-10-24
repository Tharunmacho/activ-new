import EventFilters from '../../../components/EventFilters';
import { EMPTY_EVENT_FILTERS, matchesEventFilters } from '../../../utils/eventFilters';
import { useEventClock } from '../../../utils/useEventClock';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Badge, PALETTE, SPACE, SIZE, TYPE, asArray, BRAND,
  PremiumListPage, PremiumPageHeader, HeaderStat, HeaderStatRow, PillTabs, SurfaceCard, DateTile, SeatMeter,
  StateView, CardSkeletons, EventTicket3D, EventCalendar3D, PREMIUM_OVERLAP, untilLabel, FitImage, PressableScale } from '../../../ui';
import { listMemberEvents } from '../../../services/memberApi';
import { useEventSeats, seatsLeftOf, wantsSeats, SeatInfo } from './eventSeats';
import { resolveMediaUrl } from '../../../config/api.config';
import { useLoad } from '../useLoad';
import { isPastEvent, eventTime, dateParts, priceLabel, myActiveRegistration, seatState, openEventOrTicket, eventPhase, feeFor } from './eventFormat';

/**
 * Member events — website MemberEvents: Upcoming · My registrations · Past.
 * GET /events (already filtered server-side to what this member may see, each
 * carrying `myRegistration` and the member's own `yourPrice`).
 *
 * Premium: brand header with live counts (upcoming · registered · this month),
 * tabs overlapping the waves, event cards with a calendar tile, poster,
 * relative time and a seats meter when the event is capped.
 */

type Tab = 'upcoming' | 'mine' | 'past';

const EMPTY: Record<Tab, { title: string; detail: string }> = {
  upcoming: { title: 'Nothing scheduled', detail: 'Events published by the association will appear here, with the full programme.' },
  past: { title: 'No past events', detail: 'Events that have finished stay here so you can look back at the programme.' },
  mine: { title: 'You have not registered for any events yet', detail: 'Events you book — here or on the ACTIV website with this email — appear here with your ticket.' },
};

/** Only upcoming, capped events take registrations worth a seat count. */
const pickSeats = (e: any) => wantsSeats(e) && !isPastEvent(e);

/** Website EventRow, premium: poster, calendar tile, chips, title, time · venue · seats · ref, one action. */
function EventCard({ e, seat, onPress }: { e: any; seat?: SeatInfo | null; onPress: () => void }) {
  const d = dateParts(e?.startAt);
  const banner = e?.bannerUrl ? resolveMediaUrl(e.bannerUrl) : '';
  const { reg, awaitingPayment, waitlisted, label, action } = seatState(e);
  const seats = Number(reg?.seats || 0);
  const venue = [e?.venue, e?.district].filter(Boolean).join(', ');
  const past = isPastEvent(e);
  const phase = eventPhase(e);
  const live = phase === 'live';
  const when = live ? 'Happening now' : past ? '' : untilLabel(e?.startAt);
  const seatTone = awaitingPayment ? 'awaiting' : waitlisted ? 'inactive' : 'confirmed';
  const ok = !!reg && !awaitingPayment;
  // Booking-system seats (both collections). Unknown → no seat line at all.
  const left = seatsLeftOf(seat);
  const capacity = Number(seat?.capacity || 0);
  const free = feeFor(e) <= 0;
  const actionColors = awaitingPayment ? ['#B45309', '#F59E0B'] : ['#1E3A8A', '#2563EB'];

  return (
    <SurfaceCard
      padded={false}
      accent={reg ? (awaitingPayment ? '#FCD34D' : '#A7F3D0') : undefined}
      contentStyle={past ? { opacity: 0.94 } : undefined}
    >
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${e?.title || 'Untitled event'}, ${action}`}>
      {banner ? (
        <View style={styles.bannerWrap}>
          <FitImage uri={banner} style={styles.banner} fit={e?.media?.fit === 'cover' ? 'cover' : 'contain'} accessibilityLabel={e?.bannerAlt || ''} />
          <LinearGradient colors={['rgba(11,26,69,0)', 'rgba(11,26,69,0.55)']} style={styles.bannerShade} pointerEvents="none" />
          {when ? (
            <View style={[styles.whenPill, live && { backgroundColor: 'rgba(5,150,105,0.92)' }]}>
              <Icon name={live ? 'fiber-manual-record' : 'schedule'} size={12} color={PALETTE.white} />
              <Text style={styles.whenText} maxFontSizeMultiplier={1.2}>{when}</Text>
            </View>
          ) : null}
          <View style={styles.pricePill}>
            <Text style={[styles.pricePillText, free && { color: PALETTE.greenDark }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{priceLabel(e)}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.headingRow}>
          <DateTile date={e?.startAt} muted={past} size={58} />
          <View style={styles.main}>
            {(e?.category || e?.audience === 'paid' || reg) ? (
              <View style={styles.chips}>
                {e?.category ? <Badge label={String(e.category)} color={PALETTE.blueDark} bg={PALETTE.blueSoft} size="sm" style={{ maxWidth: 150 }} /> : null}
                {e?.audience === 'paid' ? <Badge label="Members only" icon="lock" color={PALETTE.amberDark} bg={PALETTE.amberSoft} size="sm" /> : null}
                {reg ? <Badge label={label} status={seatTone} icon={awaitingPayment ? 'schedule' : 'verified'} size="sm" /> : null}
              </View>
            ) : null}
            <Text style={styles.title}>{e?.title || 'Untitled event'}</Text>
          </View>
        </View>
        <View style={styles.details}>
          <View style={styles.metaRow}>
            <Icon name="schedule" size={SIZE.iconSm} color={PALETTE.textFaint} />
            <Text style={styles.meta}>
              {e?.startAt ? [d.time, !banner ? when : ''].filter(Boolean).join(' · ') : 'Date to be confirmed'}
            </Text>
          </View>
          {String(e?.mode || '') === 'online' ? (
            <View style={styles.metaRow}>
              <Icon name="videocam" size={SIZE.iconSm} color={PALETTE.textFaint} />
              <Text style={styles.meta}>Online{e?.onlinePlatform ? ` · ${e.onlinePlatform}` : ''}</Text>
            </View>
          ) : venue ? (
            <View style={styles.metaRow}>
              <Icon name="place" size={SIZE.iconSm} color={PALETTE.textFaint} />
              <Text style={styles.meta}>{venue}</Text>
            </View>
          ) : null}
          {reg && seats > 1 ? (
            <View style={styles.metaRow}><Icon name="groups" size={SIZE.iconSm} color={PALETTE.textFaint} /><Text style={styles.meta}>{seats} seats</Text></View>
          ) : null}
          {reg?.bookingRef ? (
            <View style={styles.bookingReference}>
              <Icon name="confirmation-number" size={SIZE.iconSm} color={PALETTE.blueDark} />
              <View style={styles.referenceText}>
                <Text style={styles.referenceLabel}>Booking reference</Text>
                <Text style={styles.ref} selectable>{reg.bookingRef}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {!past && !reg && left !== null && capacity > 0 ? (
        <SeatMeter capacity={capacity} left={left} style={styles.meter} />
      ) : null}
      </PressableScale>

      <View style={styles.footer}>
        {!banner ? (
          <Text style={[styles.price, free && { color: PALETTE.greenDark }]}>{priceLabel(e)}</Text>
        ) : null}
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${action}: ${e?.title || 'Untitled event'}`} style={styles.actionWrap}>
        {ok ? (
          <View style={[styles.action, { backgroundColor: PALETTE.greenSoft }]}>
            <Text style={[styles.actionText, { color: PALETTE.greenDark }]}>{action}</Text>
            <Icon name="arrow-forward" size={SIZE.iconSm} color={PALETTE.greenDark} />
          </View>
        ) : (
          <LinearGradient colors={actionColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
            <Text style={styles.actionText}>{action}</Text>
            <Icon name="arrow-forward" size={SIZE.iconSm} color={PALETTE.white} />
          </LinearGradient>
        )}
        </PressableScale>
      </View>
    </SurfaceCard>
  );
}

const MemberEventsScreen = ({ navigation }: any) => {
  const { width, fontScale } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(width);
  const availableWidth = Math.max(1, viewportWidth - SPACE.lg * 2);
  const columns = availableWidth >= 640 && fontScale <= 1.2 ? 2 : 1;
  const cardWidth = (availableWidth - SPACE.md * (columns - 1)) / columns;
  const carousel = useRef<FlatList<any>>(null);
  const now = useEventClock();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [filters, setFilters] = useState({ ...EMPTY_EVENT_FILTERS });
  // Search, tab changes and rotation should start with a fully visible card,
  // including when the previous result set was scrolled to its last item.
  useEffect(() => {
    carousel.current?.scrollToOffset({ offset: 0, animated: false });
  }, [tab, filters, cardWidth]);
  const { data, loading, error, reload, refreshing, refresh } = useLoad<any>(() => listMemberEvents(), [], { events: [] });
  const events = asArray<any>(data?.events);
  // Real seat numbers per capped, open event — `registeredCount` misses every booking.
  const seats = useEventSeats(events, data, pickSeats);
  // Back from a booking or a cancelled seat: re-read quietly (the first focus is the load itself).
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (seen.current) refresh();
    seen.current = true;
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = useMemo(() => events.filter((e) => !isPastEvent(e, now)).sort((a, b) => eventTime(a) - eventTime(b)), [events, now]);
  const past = useMemo(() => events.filter(e => isPastEvent(e, now)).sort((a, b) => eventTime(b) - eventTime(a)), [events, now]);
  const mine = useMemo(() => events.filter((e) => !!myActiveRegistration(e)).sort((a, b) => eventTime(a) - eventTime(b)), [events]);
  const thisMonth = useMemo(() => {
    const now = new Date();
    return upcoming.filter((e) => {
      if (!e?.startAt) return false;
      const d = new Date(e.startAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [upcoming]);
  const rows = (tab === 'upcoming' ? upcoming : tab === 'past' ? past : mine).filter(e => matchesEventFilters(e, filters));
  const n = (v: number) => (loading ? '–' : String(v));

  return (
    <PremiumListPage<any>
      header={(
        <PremiumPageHeader
          eyebrow="Association programme"
          title="Events"
          subtitle="Meetings, summits and trainings — book your seat in a tap."
          onBack={() => navigation.goBack()}
          art={<EventTicket3D size={88} />}
          artLabel="Event ticket"
        >
          <HeaderStatRow>
            <HeaderStat value={n(upcoming.length)} label="Upcoming" icon="event" />
            <HeaderStat value={n(mine.length)} label="Registered" icon="confirmation-number" />
            <HeaderStat value={n(thisMonth)} label="This month" icon="today" />
          </HeaderStatRow>
        </PremiumPageHeader>
      )}
      listHeader={(
        <>
        <PillTabs<Tab>
          value={tab}
          onChange={setTab}
          style={styles.tabs}
          options={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { value: 'mine', label: 'Registered', count: mine.length },
            { value: 'past', label: 'Past', count: past.length },
          ]}
        />
        <View testID="member-event-filters" style={styles.gutter}>
          <EventFilters events={events} value={filters} onChange={setFilters} />
        </View>
        {!loading && !error && !!rows.length && <FlatList testID="member-event-carousel" ref={carousel} key={tab} horizontal data={rows} style={styles.carousel}
          onLayout={({ nativeEvent }) => {
            const measured = nativeEvent.layout.width;
            if (Number.isFinite(measured) && measured > 0) setViewportWidth(measured);
          }}
          keyExtractor={(e, i) => String(e?.id || e?._id || i)} extraData={seats}
          showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + SPACE.md} decelerationRate="fast"
          keyboardShouldPersistTaps="handled" maxToRenderPerBatch={4}
          contentContainerStyle={styles.cardRow} initialNumToRender={4}
          renderItem={({ item }) => <View testID="member-event-card" style={[styles.cardCell, { width: cardWidth }]}><EventCard e={item}
            seat={seats[String(item?.id || item?._id || '')]} onPress={() => openEventOrTicket(navigation, item)} /></View>} />}
        </>
      )}
      data={[]}
      extraData={[tab, seats]}
      keyExtractor={(e, i) => String(e?.id || e?._id || i)}
      renderItem={() => null}
      ListEmptyComponent={rows.length && !loading && !error ? null : <View style={styles.gutter}>{loading ? <CardSkeletons rows={3} variant="media" /> : error ? (
        <StateView kind="error" title="Events could not be loaded" message={error} onAction={reload} />
      ) : (
        <StateView
          art={tab === 'mine' ? <EventTicket3D size={84} /> : <EventCalendar3D size={84} />}
          title={Object.values(filters).some(Boolean) ? 'No matching events' : EMPTY[tab].title}
          message={Object.values(filters).some(Boolean) ? 'Try a wider date range or clear your filters.' : EMPTY[tab].detail}
          action={tab === 'mine' && upcoming.length > 0 ? 'See all events' : undefined}
          onAction={tab === 'mine' && upcoming.length > 0 ? () => setTab('upcoming') : undefined}
        />
      )}</View>}
      refreshing={refreshing}
      onRefresh={refresh}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
    />
  );
};

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: SPACE.lg },
  // Horizontal cards measure their complete content before the footer. A
  // vertical flex: 1 chain here can collapse the body during Android layout.
  carousel: { flexGrow: 0 },
  cardRow: { gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingTop: SPACE.xs, paddingBottom: SPACE.lg, alignItems: 'flex-start' },
  cardCell: { flexGrow: 0, flexShrink: 0 },
  tabs: { marginTop: -PREMIUM_OVERLAP },
  bannerWrap: { width: '100%', height: 148, backgroundColor: PALETTE.field },
  banner: { width: '100%', height: '100%' },
  bannerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 },
  whenPill: {
    position: 'absolute', left: SPACE.md, bottom: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(11,26,69,0.78)',
  },
  whenText: { color: PALETTE.white, fontSize: 12, lineHeight: 15, fontWeight: '700' },
  pricePill: {
    position: 'absolute', right: SPACE.md, top: SPACE.md, maxWidth: '50%', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: PALETTE.white,
  },
  pricePillText: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: BRAND.navy, fontVariant: ['tabular-nums'] },
  body: { padding: SPACE.lg, gap: SPACE.md },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  details: { gap: SPACE.sm },
  main: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs + 2, marginBottom: SPACE.sm },
  title: { ...TYPE.heading, fontSize: 17, lineHeight: 23, color: BRAND.navyDeep },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  meta: { ...TYPE.caption, fontSize: 13, lineHeight: 19, flex: 1, minWidth: 0 },
  bookingReference: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, padding: SPACE.md, borderRadius: 12, backgroundColor: PALETTE.blueTint, marginTop: SPACE.xs },
  referenceText: { flex: 1, minWidth: 0, gap: SPACE.xs },
  referenceLabel: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  ref: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: PALETTE.blueDark, letterSpacing: 0.3 },
  meter: { marginHorizontal: SPACE.lg, marginTop: -SPACE.xs, marginBottom: SPACE.md },
  footer: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider, backgroundColor: PALETTE.blueTint,
  },
  price: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: BRAND.navy, flexShrink: 1, minWidth: 0, fontVariant: ['tabular-nums'] },
  actionWrap: { maxWidth: '100%', marginLeft: 'auto', flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md + 2, paddingVertical: SPACE.sm, minHeight: 44, borderRadius: 999 },
  actionText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.white, flexShrink: 1 },
});

export default MemberEventsScreen;

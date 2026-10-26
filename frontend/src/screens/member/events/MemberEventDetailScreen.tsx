import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { useEventClock } from '../../../utils/useEventClock';
import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  BottomActionBar, Skeleton, PALETTE, SPACE, SIZE, TYPE, BRAND, asArray, money, errorText,
  PremiumPage, PremiumPageHeader, GlassIconButton, GlassBadge, GradientButton, GradientAvatar, FadeInUp, PressableScale,
  SurfaceCard, GradientGlyph, GroupTitle, SeatMeter, StateView, CardSkeletons, ReceiptLine, DateTile,
  EventCalendar3D, EventTicket3D, PREMIUM_OVERLAP, FitImage } from '../../../ui';
import {
  getMemberEvent, cancelEventRegistration, payForEvent, registrationGate,
} from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { getPublicEventDetail } from '../../../services/publicContent';
import { openPublicAction } from '../../../services/publicNavigation';
import { openWebsitePage } from '../../../services/websiteNavigation';
import type { PublicAction } from '../../../utils/publicBrowse';
import { publicShareUrl, sharePublicPage } from '../../../services/contentShare';
import { QrCode } from '../../admin/super/events/qr';
import { useLoad } from '../useLoad';
import { useEventSeat, seatsLeftOf, isFillingFast, toSeatInfo } from './eventSeats';
import {
  feeFor, myActiveRegistration, isPastEvent, formatWhen, longDate, eventPhase, countdownLabel,
  formatReminders, googleCalendarUrl, directionsUrl, eventShareContent, programmeTime,
} from './eventFormat';

/**
 * One event — website `features/member/pages/MemberEventDetail.tsx`.
 *
 * GET /events/:id (myRegistration + yourPrice resolved for THIS member).
 *
 *   header      category · Members only · taken place / Happening now / countdown
 *               · Fully booked / Only N seats left (≤ max(1, 25% of capacity); booking-system seats)
 *   actions     Add to calendar · Share · Directions (website EventActions)
 *   programme   agenda (time, title, description, speaker · location)
 *   speakers    photo / initials, role, organisation, bio
 *   facts       Date and time · Venue (+address, Open in maps) · Region · Contact · Phone · Email
 *   your seat   amount due + reference + Pay and confirm (booking → its ticket;
 *               a legacy held seat → POST /events/:id/register/pay { method }),
 *               "Give up this seat instead"; registered / waiting list, booking
 *               ref + seats, View your ticket, the paid receipt, Cancel
 *   not open    the gate's reason + who to contact
 *   open        Please note · price (member saving / "Members pay ₹X") · seats
 *               left · closes · Book Now / Join the waiting list (sticky footer)
 *   reminders   "Reminder 24 hours before"
 *   QR          the event's public page as a scannable code (website
 *               EventQrFeature; hidden when `showQrOnPage === false`)
 */

const METHODS: { key: 'upi' | 'card' | 'netbanking'; label: string; icon: string }[] = [
  { key: 'upi', label: 'UPI', icon: 'smartphone' },
  { key: 'card', label: 'Card', icon: 'credit-card' },
  { key: 'netbanking', label: 'Net banking', icon: 'account-balance' },
];

function Fact({ icon, tone = 'blue', label, value, onPress, children, last }: {
  icon: string; tone?: 'blue' | 'teal' | 'sky' | 'amber' | 'green' | 'navy'; label: string; value?: string; onPress?: () => void; children?: React.ReactNode; last?: boolean;
}) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <View style={[styles.fact, !last && styles.divider]}>
      <GradientGlyph icon={icon} tone={tone} size={40} />
      <View style={styles.flexMin}>
        <Text style={styles.factLabel} maxFontSizeMultiplier={1.3}>{(label || '').toUpperCase()}</Text>
        {value ? (
          onPress
            ? <Text style={[styles.factValue, styles.link]} onPress={onPress} accessibilityRole="link">{value}</Text>
            : <Text style={styles.factValue} selectable>{value}</Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** A translucent chip on the gradient header. */
function HeaderChip({ icon, text, tint }: { icon?: string; text: string; tint?: string }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={[styles.hChip, tint ? { backgroundColor: tint, borderColor: 'transparent' } : null]}>
      {icon ? <Icon name={icon} size={13} color={PALETTE.white} /> : null}
      <Text style={styles.hChipText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{text}</Text>
    </View>
  );
}

function ActionPill({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <PressableScale onPress={onPress} contentStyle={styles.pill} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={SIZE.iconSm} color={PALETTE.blueDark} />
      <Text style={styles.pillText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
    </PressableScale>
  );
}

const MemberEventDetailScreen = ({ navigation, route, publicAccess = false }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const open = (url: string) => { if (url) openWebsitePage(navigation, url, 'Event information'); };
  const eventNow = useEventClock();
  const id = String(route?.params?.id || '');
  const { data: e, loading, error, reload, refreshing, refresh } = useLoad<any>(
    () => publicAccess ? getPublicEventDetail(id) : getMemberEvent(id), [id, publicAccess], null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    refreshRef.current();
  }, []));
  // Seats from the booking system — `registeredCount` on this payload misses every booking.
  const memberSeat = useEventSeat(publicAccess ? null : e);
  const seat = publicAccess ? toSeatInfo(e?.publicAvailability) : memberSeat;
  const [working, setWorking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');

  const back = () => navigation.goBack();
  const allEvents = () => publicAccess ? navigation.navigate('PublicExplore', { section: 'events' }) : navigation.navigate('MemberEvents');
  const continueAsMember = async (action: PublicAction) => {
    setWorking(true);
    try { await openPublicAction(navigation, action); }
    catch (err) { Alert.alert('Unable to continue', errorText(err, 'Please try again.')); }
    finally { setWorking(false); }
  };
  const membership = () => publicAccess ? continueAsMember({ kind: 'membership' }) : navigation.navigate('MembershipPlans');

  if (loading || error || !e) {
    return (
      <PremiumPage
        header={(
          <PremiumPageHeader
            eyebrow="Event"
            title={loading ? 'Loading the event…' : 'Event'}
            subtitle="The association programme"
            onBack={back}
            art={<EventCalendar3D size={88} />}
          />
        )}
      >
        {loading ? (
          <View style={styles.overlap} accessibilityLabel="Loading">
            <View style={styles.skelCard}>
              <Skeleton height={170} radius={16} />
              <Skeleton width="40%" height={18} radius={999} style={{ marginTop: SPACE.lg }} />
              <Skeleton width="85%" height={20} style={{ marginTop: SPACE.md }} />
              <Skeleton width="100%" height={12} style={{ marginTop: SPACE.md }} />
              <Skeleton width="70%" height={12} style={{ marginTop: SPACE.sm }} />
            </View>
            <CardSkeletons rows={2} style={{ marginTop: SPACE.md, paddingHorizontal: 0 }} />
          </View>
        ) : (
          <FadeInUp style={styles.overlap}>
            <SurfaceCard>
              {/active membership/i.test(error || '') ? (
                <StateView
                  compact
                  art={<EventTicket3D size={64} />}
                  title="Members-only event"
                  message="This event is for members with an active membership. Activate yours to see the programme and book a seat."
                  action="Activate membership"
                  actionIcon="workspace-premium"
                  onAction={membership}
                  secondary="Back to events"
                  onSecondary={allEvents}
                />
              ) : (
              <StateView
                kind={error ? 'error' : 'empty'}
                compact
                art={error ? undefined : <EventCalendar3D size={64} />}
                title="This event is not available"
                message={error || 'It may have been withdrawn, or it is for a different membership.'}
                action={error ? 'Try again' : 'Back to events'}
                onAction={() => (error ? reload() : allEvents())}
              />
              )}
            </SurfaceCard>
          </FadeInUp>
        )}
      </PremiumPage>
    );
  }

  const registration = publicAccess ? null : myActiveRegistration(e);
  const fromBooking = registration?.source === 'booking';
  const awaitingPayment = !!registration && registration?.payment?.status === 'pending';
  const fee = feeFor(e);
  const listFee = Number(e?.registrationFee || 0);
  const saving = Number(e?.yourSaving || 0);
  const gate = publicAccess && e?.publicAvailability?.closed ? { open: false, reason: 'Registration has closed' } : registrationGate(e);
  const left = seatsLeftOf(seat);
  const past = isPastEvent(e, eventNow);
  const phase = eventPhase(e, eventNow);
  const countdown = !past && phase === 'upcoming' ? countdownLabel(e?.startAt) : null;
  const capacity = Number(seat?.capacity || 0);
  const fillingFast = isFillingFast(seat);
  const region = [e?.block, e?.district, e?.state].filter(Boolean).join(', ');
  const banner = e?.bannerUrl ? resolveMediaUrl(e.bannerUrl) : '';
  const agenda = asArray<any>(e?.agenda).filter((r) => r && (r.title || r.startTime));
  const speakers = asArray<any>(e?.speakers).filter((s) => s && s.name);
  const reminders = formatReminders(e?.reminderOffsetsHours);
  const shareContent = eventShareContent(e, publicAccess);
  const pageUrl = publicShareUrl(shareContent.path);
  const calendar = googleCalendarUrl(e, pageUrl);
  const directions = directionsUrl(e);
  const due = Number(registration?.payment?.amount || 0);
  const bookable = !awaitingPayment && !registration && gate.open;
  const showQr = e?.showQrOnPage !== false && !!pageUrl;
  const online = String(e?.mode || '') === 'online';
  const ticket = () => navigation.navigate('EventBooking', { eventId: String(e.id), ref: String(registration?.bookingRef || '') });

  const share = () => sharePublicPage(shareContent);

  const cancel = (giveUp = false) => {
    Alert.alert(giveUp ? 'Give up this seat' : 'Cancel registration', 'Give up your seat for this event?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Give it up', style: 'destructive', onPress: async () => {
          setWorking(true);
          try {
            await cancelEventRegistration(String(e.id));
            Alert.alert('Events', 'Your registration has been cancelled');
            await refresh();
          } catch (err) {
            Alert.alert('Events', errorText(err, 'Could not cancel your registration'));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  /** A held LEGACY seat: settle it (website EventRegistration "payment" step). */
  const pay = async () => {
    setPaying(true);
    try {
      await payForEvent(String(e.id), { method });
      Alert.alert('Events', 'Payment received — your seat is confirmed');
      await refresh();
    } catch (err) {
      Alert.alert('Events', errorText(err, 'The payment could not be completed'));
    } finally {
      setPaying(false);
    }
  };

  const contactLast = (after: string) => {
    const order = ['venue', 'region', 'name', 'phone', 'email'];
    const present: Record<string, boolean> = {
      venue: !!(e?.venue || e?.venueAddress), region: !!region, name: !!e?.contactName, phone: !!e?.contactPhone, email: !!e?.contactEmail,
    };
    return !order.slice(order.indexOf(after) + 1).some((k) => present[k]);
  };

  let d = 0;
  const next = () => { d += 70; return d; };

  return (
    <PremiumPage
      refreshing={refreshing}
      onRefresh={refresh}
      header={(
        <PremiumPageHeader
          eyebrow={e?.category ? String(e.category) : 'Event'}
          title={e?.title || 'Untitled event'}
          subtitle={formatWhen(e)}
          onBack={back}
          right={(
            <>
              <GlassIconButton icon="share" onPress={share} accessibilityLabel="Share this event" />
              <GlassIconButton icon="event-note" onPress={allEvents} accessibilityLabel="All events" />
            </>
          )}
          art={banner ? undefined : (registration ? <EventTicket3D size={84} /> : <EventCalendar3D size={84} />)}
          artSize={84}
        >
          <View style={styles.hChips}>
            {e?.audience === 'paid' ? <HeaderChip icon="lock" text="Members only" /> : null}
            {online ? <HeaderChip icon="videocam" text={`Online${e?.onlinePlatform ? ` · ${e.onlinePlatform}` : ''}`} /> : null}
            {past ? <HeaderChip icon="history" text="This event has taken place" />
              : phase === 'live' ? <HeaderChip icon="fiber-manual-record" text="Happening now" tint="rgba(5,150,105,0.9)" />
                : countdown ? <HeaderChip icon="timer" text={countdown} /> : null}
            {left === 0 ? <HeaderChip icon="groups" text="Fully booked" tint="rgba(220,38,38,0.85)" />
              : fillingFast ? <HeaderChip icon="local-fire-department" text={`Only ${left} seats left`} tint="rgba(217,119,6,0.9)" /> : null}
            {registration ? (
              <GlassBadge label={awaitingPayment ? 'Payment due' : registration?.status === 'waitlist' ? 'Waiting list' : 'Registered'} icon="verified" />
            ) : null}
          </View>
        </PremiumPageHeader>
      )}
      footer={bookable ? (
        <BottomActionBar note={fee > 0 ? `${money(fee)} per seat${saving > 0 ? ` · member price, you save ${money(saving)}` : ''}` : 'Free to attend'}>
          <GradientButton
            label={left === 0 ? 'Fully booked' : 'Book Now'}
            disabled={left === 0}
            loading={working}
            iconRight="chevron-right"
            icon="confirmation-number"
            onPress={() => publicAccess ? continueAsMember({ kind: 'event', id: String(e.id) }) : navigation.navigate('EventBooking', { eventId: String(e.id) })}
            style={{ flex: 1 }}
          />
        </BottomActionBar>
      ) : undefined}
    >
      {/* ---------------- the event */}
      <FadeInUp delay={next()} style={styles.overlap}>
        <SurfaceCard padded={false}>
          {banner ? (
            <View>
              <FitImage uri={banner} mode="auto" minRatio={1.25} maxRatio={2.6} fit={e?.media?.fit === 'cover' ? 'cover' : 'contain'} accessibilityLabel={e?.bannerAlt || e?.title || ''} />
              <LinearGradient colors={['rgba(11,26,69,0)', 'rgba(11,26,69,0.5)']} style={styles.bannerShade} pointerEvents="none" />
              <DateTile date={e?.startAt} muted={past} style={styles.bannerDate} />
            </View>
          ) : null}
          <View style={styles.cardPad}>
            <Text style={styles.sectionEyebrow}>ABOUT THIS EVENT</Text>
            {e?.description
              ? <Text style={styles.desc} selectable>{e.description}</Text>
              : <Text style={styles.muted}>No description was published for this event.</Text>}
            <View style={styles.actions}>
              {calendar ? <ActionPill icon="event" label="Add to calendar" onPress={() => open(calendar)} /> : null}
              <ActionPill icon="share" label="Share" onPress={share} />
              {directions ? <ActionPill icon="directions" label="Directions" onPress={() => open(directions)} /> : null}
            </View>
          </View>
        </SurfaceCard>
      </FadeInUp>

      {/* ---------------- facts */}
      <FadeInUp delay={next()}>
        <SurfaceCard style={styles.card} contentStyle={styles.factsCard}>
          <Fact icon="event" label="Date and time" value={formatWhen(e)} last={contactLast('date')} />
          {!online && (e?.venue || e?.venueAddress) ? (
            <Fact icon="place" tone="teal" label="Venue" value={e?.venue} last={contactLast('venue')}>
              {e?.venueAddress ? <Text style={styles.sub} selectable>{e.venueAddress}</Text> : null}
              {e?.venueMapUrl ? (
                <TouchableOpacity onPress={() => open(String(e.venueMapUrl))} style={styles.inline} accessibilityRole="link">
                  <Text style={styles.linkSmall}>Open in maps</Text><Icon name="open-in-new" size={SIZE.iconSm} color={PALETTE.blue} />
                </TouchableOpacity>
              ) : null}
            </Fact>
          ) : null}
          {online ? <Fact icon="videocam" label="Attend online" value={e?.onlinePlatform || 'Online event'} /> : null}
          {region ? <Fact icon="map" tone="sky" label="Region" value={region} last={contactLast('region')} /> : null}
          {e?.contactName ? <Fact icon="person-outline" tone="navy" label="Contact" value={e.contactName} last={contactLast('name')} /> : null}
          {e?.contactPhone ? <Fact icon="call" tone="green" label="Phone" value={e.contactPhone} onPress={() => open(`tel:${String(e.contactPhone).replace(/[^\d+]/g, '')}`)} last={contactLast('phone')} /> : null}
          {e?.contactEmail ? <Fact icon="mail-outline" tone="amber" label="Email" value={e.contactEmail} onPress={() => open(`mailto:${e.contactEmail}`)} last /> : null}
        </SurfaceCard>
      </FadeInUp>

      {/* ---------------- registration / your seat */}
      <FadeInUp delay={next()}>
        <SurfaceCard style={styles.card} accent={registration && !awaitingPayment ? '#A7F3D0' : undefined}>
          <View style={styles.seatHead}>
            <GradientGlyph icon={registration ? 'verified' : 'confirmation-number'} tone={registration && !awaitingPayment ? 'green' : 'blue'} size={42} />
            <Text style={styles.cardTitle}>{registration ? 'Your seat' : 'Registration'}</Text>
          </View>

          {awaitingPayment ? (
            <View>
              <LinearGradient colors={['#0B1A45', '#1E3A8A', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.due}>
                <Text style={styles.dueLabel}>AMOUNT DUE</Text>
                <Text style={styles.dueAmount}>{money(due)}</Text>
                <Text style={styles.dueCopy}>Your seat is held. It is confirmed the moment this is paid.</Text>
                {registration?.payment?.reference ? (
                  <Text style={styles.dueRef}>Reference <Text style={{ color: PALETTE.white, fontWeight: '800' }} selectable>{registration.payment.reference}</Text></Text>
                ) : null}
              </LinearGradient>
              {fromBooking ? (
                <GradientButton label={`Pay ${money(due)} and confirm`} icon="verified-user" onPress={ticket} style={{ marginTop: SPACE.md }} />
              ) : (
                <>
                  <Text style={[styles.label, { marginTop: SPACE.lg }]}>How would you like to pay?</Text>
                  <View style={styles.methods}>
                    {METHODS.map((m) => {
                      const on = method === m.key;
                      return (
                        <PressableScale
                          key={m.key}
                          onPress={() => setMethod(m.key)}
                          style={styles.methodWrap}
                          contentStyle={[styles.method, on && styles.methodOn]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={m.label}
                        >
                          <Icon name={m.icon} size={20} color={on ? PALETTE.blue : PALETTE.textMuted} />
                          <Text style={[styles.methodText, on && { color: PALETTE.blueDark }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{m.label}</Text>
                          {on ? <View style={styles.methodTick}><Icon name="check" size={11} color={PALETTE.white} /></View> : null}
                        </PressableScale>
                      );
                    })}
                  </View>
                  <GradientButton label={`Pay ${money(due)} and confirm`} icon="verified-user" loading={paying} onPress={pay} style={{ marginTop: SPACE.md }} />
                </>
              )}
              {!past && !fromBooking ? (
                <TouchableOpacity onPress={() => cancel(true)} disabled={working} style={styles.ghost} accessibilityRole="button">
                  <Text style={styles.ghostText}>Give up this seat instead</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : registration ? (
            <View>
              <View style={[styles.seatBox, registration?.status === 'waitlist' ? styles.seatWait : styles.seatOk]}>
                <View style={styles.inline}>
                  <Icon name={registration?.status === 'waitlist' ? 'hourglass-top' : 'verified'} size={SIZE.icon} color={registration?.status === 'waitlist' ? PALETTE.amberDark : PALETTE.greenDark} />
                  <Text style={[styles.seatTitle, { color: registration?.status === 'waitlist' ? PALETTE.amberDark : PALETTE.greenDark }]}>
                    {registration?.status === 'waitlist' ? 'You are on the waiting list' : 'You are registered'}
                  </Text>
                </View>
                <Text style={styles.sub}>
                  {registration?.status === 'waitlist'
                    ? fromBooking ? 'No seat is held and no payment is due. The organiser will contact you if a place becomes available.' : 'You will move into a seat automatically if one is given up.'
                    : `Registered on ${longDate(registration?.registeredAt) || '—'}.`}
                </Text>
                {fromBooking ? (
                  <Text style={styles.sub}>
                    {registration?.bookingRef ? <>Booking <Text style={{ fontWeight: '800', color: PALETTE.text }} selectable>{registration.bookingRef}</Text>   </> : null}
                    {Number(registration?.seats || 0) > 0 ? `${registration.seats} ${Number(registration.seats) === 1 ? 'seat' : 'seats'}` : ''}
                  </Text>
                ) : null}
              </View>
              {fromBooking ? <GradientButton label="View your ticket" icon="confirmation-number" onPress={ticket} style={{ marginTop: SPACE.md }} /> : null}
              {!past && gate.open ? <GradientButton label="Book for someone else" variant="outline" icon="person-add" onPress={() => navigation.navigate('EventBooking', { eventId: String(e.id || e._id), forOthers: true })} style={{ marginTop: SPACE.md }} /> : null}
              {asArray<any>(registration?.responses).length ? <View style={styles.receipt}><Text style={styles.receiptHead}>REGISTRATION DETAILS</Text>{asArray<any>(registration.responses).map((answer, index) => <ReceiptLine key={answer.key || index} label={answer.label || answer.key} value={answer.value || '—'} />)}</View> : null}
              {registration?.payment?.status === 'paid' ? (
                <View style={styles.receipt}>
                  <View style={styles.inline}>
                    <Icon name="verified-user" size={SIZE.iconSm} color={PALETTE.green} />
                    <Text style={styles.receiptHead}>PAYMENT RECEIVED</Text>
                  </View>
                  <ReceiptLine label="Amount" value={money(registration?.payment?.amount)} selectable />
                  {registration?.payment?.method ? <ReceiptLine label="Method" value={String(registration.payment.method).toUpperCase()} /> : null}
                  {registration?.payment?.reference ? <ReceiptLine label="Reference" value={String(registration.payment.reference)} selectable /> : null}
                  {registration?.payment?.paidAt ? <ReceiptLine label="Paid on" value={longDate(registration.payment.paidAt)} /> : null}
                </View>
              ) : null}
              {!past && !fromBooking ? (
                <GradientButton label="Cancel my registration" variant="outline" loading={working} onPress={() => cancel(false)} style={{ marginTop: SPACE.md }} />
              ) : null}
            </View>
          ) : !gate.open ? (
            <View style={styles.closed}>
              <GradientGlyph icon="lock-outline" tone="slate" size={48} />
              <Text style={styles.closedTitle}>Registration is not open</Text>
              <Text style={[styles.sub, { textAlign: 'center' }]}>
                {gate.reason === 'Registration has closed' && e?.registrationClosesAt
                  ? `Registration closed on ${longDate(e.registrationClosesAt)}`
                  : gate.reason || 'The organiser has not opened registration for this event.'}
              </Text>
              {e?.contactPhone || e?.contactEmail ? (
                <Text style={[styles.sub, { textAlign: 'center', marginTop: SPACE.sm }]}>
                  Contact {e?.contactName ? <Text style={{ fontWeight: '800', color: PALETTE.textSoft }}>{e.contactName}</Text> : 'the organiser'}
                  {e?.contactPhone ? <>{' on '}<Text style={styles.link} onPress={() => open(`tel:${String(e.contactPhone).replace(/[^\d+]/g, '')}`)}>{e.contactPhone}</Text></> : null}
                  {e?.contactEmail ? <>{e?.contactPhone ? ' or ' : ' at '}<Text style={styles.link} onPress={() => open(`mailto:${e.contactEmail}`)}>{e.contactEmail}</Text></> : null}
                  .
                </Text>
              ) : null}
            </View>
          ) : (
            <View>
              {e?.registrationNote ? (
                <View style={styles.note}>
                  <Text style={styles.noteHead}>PLEASE NOTE</Text>
                  <Text style={styles.noteText}>{e.registrationNote}</Text>
                </View>
              ) : null}
              {fee > 0 ? (
                <View style={styles.price}>
                  <GradientGlyph icon="confirmation-number" size={44} />
                  <View style={styles.flexMin}>
                    <Text style={styles.priceBig}>{money(fee)}</Text>
                    {saving > 0 ? (
                      <Text style={styles.save}>Member price — you save {money(saving)} <Text style={styles.strike}>{money(listFee)}</Text></Text>
                    ) : e?.hasMemberRate && Number(e?.memberPrice) < listFee ? (
                      <TouchableOpacity onPress={membership} style={styles.memberRate} accessibilityRole="button">
                        <Text style={styles.memberRateText}>Members pay {money(Number(e.memberPrice))} — activate your membership</Text>
                      </TouchableOpacity>
                    ) : null}
                    <Text style={styles.sub}>per seat</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.price, { backgroundColor: PALETTE.greenSoft, borderColor: '#A7F3D0' }]}>
                  <GradientGlyph icon="celebration" tone="green" size={44} />
                  <View style={styles.flexMin}>
                    <Text style={[styles.priceBig, { color: PALETTE.greenDark }]}>Free</Text>
                    <Text style={styles.sub}>Free to attend</Text>
                  </View>
                </View>
              )}
              {left !== null && capacity > 0 ? (
                left === 0 ? (
                  <Text style={[styles.sub, { marginTop: SPACE.md, fontWeight: '700', color: PALETTE.amberDark }]}>This event is fully booked. Contact the organiser for availability.</Text>
                ) : <SeatMeter capacity={capacity} left={left} style={{ marginTop: SPACE.md }} />
              ) : null}
              {e?.registrationDeadline ? <Text style={[styles.sub, { marginTop: SPACE.sm }]}>Registration closes {longDate(e?.registrationClosesAt)}.</Text> : null}
              {publicAccess && <Text style={[styles.sub, { marginTop: SPACE.md }]}>Sign in when you’re ready to book. Your event will be kept ready for you.</Text>}
            </View>
          )}

          {reminders ? (
            <View style={[styles.inline, styles.reminders]}>
              <Icon name="notifications-active" size={SIZE.iconSm} color={PALETTE.blue} />
              <Text style={styles.sub}>{reminders}</Text>
            </View>
          ) : null}
        </SurfaceCard>
      </FadeInUp>

      {/* ---------------- programme */}
      {agenda.length ? (
        <FadeInUp delay={next()}>
          <GroupTitle title="Programme" count={agenda.length} />
          <SurfaceCard style={styles.cardTight}>
            {agenda.map((r, i) => (
              <View key={String(r?.id || `${r?.title}-${i}`)} style={styles.agenda}>
                <View style={styles.rail}>
                  <LinearGradient colors={['#3B82F6', '#1E3A8A']} style={styles.railDot} />
                  {i < agenda.length - 1 ? <View style={styles.railLine} /> : null}
                </View>
                <View style={[styles.flexMin, { paddingBottom: i < agenda.length - 1 ? SPACE.lg : 0 }]}>
                  {r?.startTime || r?.endTime ? (
                    <View style={styles.timeChip}><Text style={styles.agendaTime}>{[r?.startTime, r?.endTime].filter(Boolean).map(programmeTime).join(' – ')} IST</Text></View>
                  ) : null}
                  <Text style={styles.agendaTitle}>{r?.title || 'Session'}</Text>
                  {r?.description ? <Text style={styles.sub}>{r.description}</Text> : null}
                  {r?.speaker || r?.location ? (
                    <View style={[styles.inline, { marginTop: SPACE.xs }]}>
                      <Icon name={r?.speaker ? 'record-voice-over' : 'place'} size={14} color={PALETTE.textFaint} />
                      <Text style={styles.agendaMeta}>{[r?.speaker, r?.location].filter(Boolean).join(' · ')}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </SurfaceCard>
        </FadeInUp>
      ) : null}

      {/* ---------------- speakers */}
      {speakers.length ? (
        <FadeInUp delay={next()}>
          <GroupTitle title="Speakers" count={speakers.length} />
          {speakers.map((s, i) => {
            const photo = s?.photoUrl ? resolveMediaUrl(s.photoUrl) : '';
            return (
              <SurfaceCard key={String(s?.id || `${s?.name}-${i}`)} style={styles.cardTight}>
                <View style={styles.speaker}>
                  <GradientAvatar name={s?.name} uri={photo || undefined} size={64} />
                  <View style={styles.flexMin}>
                    <Text style={styles.speakerName}>{s?.name}</Text>
                    {s?.role ? <Text style={styles.speakerRole}>{s.role}</Text> : null}
                    {s?.organization ? (
                      <View style={[styles.inline, { marginTop: 2 }]}>
                        <Icon name="business" size={13} color={PALETTE.textFaint} />
                        <Text style={styles.sub}>{s.organization}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {s?.bio ? <Text style={[styles.sub, styles.bio]}>{s.bio}</Text> : null}
              </SurfaceCard>
            );
          })}
        </FadeInUp>
      ) : null}

      {/* ---------------- QR (website EventQrFeature) */}
      {showQr ? (
        <FadeInUp delay={next()}>
          <GroupTitle title="Event QR code" subtitle="Scan to open this event's page — show it to a colleague." />
          <SurfaceCard style={styles.cardTight}>
            <View style={styles.qrRow}>
              <View style={styles.qrFrame}><QrCode value={pageUrl} size={132} /></View>
              <View style={styles.flexMin}>
                <Text style={styles.agendaTitle} numberOfLines={2}>{e?.title || 'ACTIV event'}</Text>
                <Text style={styles.sub} numberOfLines={2} selectable>{pageUrl.replace(/^https?:\/\//, '')}</Text>
                <TouchableOpacity onPress={share} style={[styles.inline, { minHeight: SIZE.touch }]} accessibilityRole="button">
                  <Icon name="share" size={SIZE.iconSm} color={PALETTE.blue} />
                  <Text style={styles.linkSmall}>Share the link</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SurfaceCard>
        </FadeInUp>
      ) : null}
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },
  overlap: { marginTop: -PREMIUM_OVERLAP, marginHorizontal: SPACE.lg },
  skelCard: { backgroundColor: PALETTE.card, borderRadius: 22, borderWidth: 1, borderColor: PALETTE.border, padding: SPACE.lg },
  card: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  cardTight: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  cardPad: { padding: SPACE.lg },
  factsCard: { paddingVertical: SPACE.xs },

  hChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  hChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: BRAND.glassStrong, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  hChipText: { color: PALETTE.white, fontSize: 12, lineHeight: 15, fontWeight: '700', flexShrink: 1 },

  banner: { width: '100%', aspectRatio: 16 / 9, backgroundColor: PALETTE.field },
  bannerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  bannerDate: { position: 'absolute', left: SPACE.md, bottom: SPACE.md },
  sectionEyebrow: { ...TYPE.eyebrow, color: PALETTE.blue },
  desc: { ...TYPE.body, fontSize: 15, lineHeight: 23, marginTop: SPACE.sm },
  muted: { ...TYPE.body, color: PALETTE.textFaint, marginTop: SPACE.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.lg },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, paddingHorizontal: 14, minHeight: SIZE.touch,
    borderRadius: 999, borderWidth: 1, borderColor: '#C7DAFB', backgroundColor: PALETTE.blueTint,
  },
  pillText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.blueDark },

  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: SPACE.md },
  factLabel: { ...TYPE.eyebrow, color: PALETTE.textFaint, marginTop: 1 },
  factValue: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: PALETTE.text, marginTop: 3 },
  link: { color: PALETTE.blue, fontWeight: '700' },
  linkSmall: { color: PALETTE.blue, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, marginTop: SPACE.xs },
  divider: { borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  sub: { ...TYPE.body, fontSize: 13, lineHeight: 19, color: PALETTE.textMuted, marginTop: 3, flexShrink: 1 },
  label: { ...TYPE.label },

  seatHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md },
  cardTitle: { ...TYPE.heading, fontSize: 17 },
  due: { borderRadius: 18, padding: SPACE.lg },
  dueLabel: { ...TYPE.eyebrow, color: 'rgba(255,255,255,0.75)' },
  dueAmount: { ...TYPE.display, color: PALETTE.white, marginTop: SPACE.xs, fontVariant: ['tabular-nums'] },
  dueCopy: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.88)', marginTop: SPACE.xs + 2 },
  dueRef: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.75)', marginTop: SPACE.md, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  methods: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  methodWrap: { flex: 1, minWidth: 0 },
  method: {
    minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, paddingVertical: SPACE.md, paddingHorizontal: 4,
    borderRadius: 16, borderWidth: 1.5, borderColor: PALETTE.border, backgroundColor: PALETTE.card,
  },
  methodOn: { borderColor: PALETTE.blue, backgroundColor: PALETTE.blueSoft },
  methodText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: PALETTE.textMuted, textAlign: 'center' },
  methodTick: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: PALETTE.blue, alignItems: 'center', justifyContent: 'center' },
  ghost: { alignSelf: 'center', minHeight: SIZE.touch, justifyContent: 'center', paddingHorizontal: SPACE.md, marginTop: SPACE.xs },
  ghostText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: PALETTE.textMuted },
  seatBox: { borderRadius: 16, padding: SPACE.md, borderWidth: 1 },
  seatOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  seatWait: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  seatTitle: { ...TYPE.subheading, fontWeight: '700', flexShrink: 1 },
  receipt: { marginTop: SPACE.md, padding: SPACE.md, borderRadius: 16, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.fieldBg },
  receiptHead: { ...TYPE.eyebrow },
  closed: { alignItems: 'center', paddingVertical: SPACE.md, gap: SPACE.xs },
  closedTitle: { ...TYPE.subheading, color: PALETTE.textSoft, marginTop: SPACE.sm },
  note: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: SPACE.md, marginBottom: SPACE.md, borderWidth: 1, borderColor: '#FDE68A' },
  noteHead: { ...TYPE.eyebrow, color: PALETTE.amberDark },
  noteText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: PALETTE.amberDark, marginTop: SPACE.xs },
  price: { flexDirection: 'row', gap: SPACE.md, alignItems: 'center', backgroundColor: PALETTE.blueTint, borderRadius: 16, padding: SPACE.md, borderWidth: 1, borderColor: '#C7DAFB' },
  priceBig: { ...TYPE.number, fontSize: 24, lineHeight: 30, color: BRAND.navy },
  save: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.green, marginTop: 3 },
  strike: { color: PALETTE.textFaint, fontWeight: '400', textDecorationLine: 'line-through' },
  memberRate: { alignSelf: 'flex-start', backgroundColor: PALETTE.amberSoft, borderRadius: 8, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, marginTop: SPACE.xs + 1 },
  memberRateText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: PALETTE.amberDark },
  reminders: { marginTop: SPACE.md, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: PALETTE.divider },

  agenda: { flexDirection: 'row', gap: SPACE.md },
  rail: { width: 16, alignItems: 'center' },
  railDot: { width: 14, height: 14, borderRadius: 7, marginTop: 4, borderWidth: 2, borderColor: PALETTE.blueSoft },
  railLine: { width: 2, flex: 1, backgroundColor: '#C7DAFB', marginTop: 2 },
  timeChip: { alignSelf: 'flex-start', backgroundColor: PALETTE.blueSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  agendaTime: { ...TYPE.eyebrow, color: PALETTE.blueDark },
  agendaTitle: { ...TYPE.subheading, fontWeight: '700', marginTop: 4 },
  agendaMeta: { ...TYPE.caption, fontWeight: '600', color: PALETTE.textMuted, flexShrink: 1 },

  speaker: { flexDirection: 'row', gap: SPACE.md, alignItems: 'center' },
  speakerName: { ...TYPE.heading, color: BRAND.navyDeep },
  speakerRole: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.blue, marginTop: 2 },
  bio: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },

  qrRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  qrFrame: { padding: 6, borderRadius: 16, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.white },
});

export default MemberEventDetailScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;

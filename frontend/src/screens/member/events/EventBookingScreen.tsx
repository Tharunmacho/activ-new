import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { onlineRegistrationLink } from '../../../utils/onlineEvent';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, Share, ScrollView, BackHandler } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Notice, BottomActionBar, PALETTE, SPACE, SIZE, TYPE, BRAND, asArray, money, shortDate, errorText,
  PremiumPage, PremiumPageHeader, PremiumSection, PremiumInput, GradientButton, GradientAvatar, FadeInUp, PressableScale,
  SurfaceCard, DateTile, SeatMeter, StateView, CardSkeletons, TornEdge, ReceiptLine, GradientGlyph,
  EventTicket3D, EventCalendar3D, PREMIUM_OVERLAP, FitImage,
} from '../../../ui';
import { getBookableEvent, createEventBooking, getEventBooking, getMyProfile, checkEventBooking } from '../../../services/memberApi';
import { getAuthToken, getUserRole } from '../../../services/api';
import { clearPublicAction, openPublicAction } from '../../../services/publicNavigation';
import EventBookingChoice from './EventBookingChoice';
import { publicShareUrl, sharePublicPage } from '../../../services/contentShare';
import { websiteUrl } from '../../../config/website.config';
import { openPublicAttachment, openWebsitePage } from '../../../services/websiteNavigation';
import { QrCode } from '../../admin/super/events/qr';
import { useEventClock } from '../../../utils/useEventClock';
import { resolveMediaUrl } from '../../../config/api.config';
import { bookingClosed, bookingParticipants, bookingState, mapBookingErrors, nationalMobile, validateBookingForm, type RegistrationAnswers, type RegistrationField } from './bookingForm';
import { RegistrationFields } from './RegistrationFields';
import { whereOf, googleCalendarUrl, directionsUrl, eventShareContent, formatWhen } from './eventFormat';

/**
 * Book seats through the website's shared guest/member booking system.
 * Visitors choose guest checkout or member sign-in inside this screen.
 *
 *   GET  /event-bookings/event/:eventId          price for THIS caller, seats left
 *   POST /event-bookings/event/:eventId/check    "already booked" before writing
 *   POST /event-bookings/event/:eventId          { name, email, phone, noOfPersons, participants, note }
 *   GET  /event-bookings/:ref                     the ticket
 *
 * No amount is ever sent. A free booking is confirmed at once; a priced one is
 * handed to checkout (PaymentCheckout, event_booking) — the payment area.
 *
 * Validation is the website's (and so the server's) rules, no stricter: name,
 * a valid email, a 10-digit mobile starting 6–9; every participant is required,
 * every email / mobile must be valid and two participant rows may not
 * repeat each other. "Already booked" answers from /check land under the
 * field they are about (`fields: { email, phone, 'participants.N.email' … }`).
 *
 * The ticket follows the website's confirmation: headline by state
 * (confirmed · cancelled · waitlist · payment not completed), the reference,
 * the online join section, calendar / share / directions, and the event and
 * booking details with the SERVER's amounts.
 */

type Person = { name: string; email: string; phone: string };
type Errors = Record<string, string>;


function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={styles.stepper}>
      <PressableScale onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} scaleTo={0.9} contentStyle={[styles.stepBtn, value <= min && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="One fewer seat">
        <Icon name="remove" size={SIZE.icon} color={PALETTE.blue} />
      </PressableScale>
      <Text style={styles.stepValue} accessibilityLiveRegion="polite">{value}</Text>
      <PressableScale onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} scaleTo={0.9} style={value >= max ? { opacity: 0.4 } : undefined} accessibilityRole="button" accessibilityLabel="One more seat">
        <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.stepBtnOn}>
          <Icon name="add" size={SIZE.icon} color={PALETTE.white} />
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

function TicketAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <PressableScale onPress={onPress} style={styles.tActionWrap} contentStyle={styles.tAction} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={18} color={PALETTE.blueDark} />
      <Text style={styles.tActionText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
    </PressableScale>
  );
}

/** The confirmation, drawn as a real ticket: gradient stub, perforation, details, torn foot. */
function Ticket({ b, event, onPay, onRebook, open }: { b: any; event: any; onPay: () => void; onRebook: () => void; open: (url: string) => void }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const now = useEventClock();
  const { status, payment: payStatus, payable, settled, needsReview, headline, paymentLabel, expired } = bookingState(b, now);
  const mode = b?.mode ?? event?.mode;
  const online = String(mode || '') === 'online';
  const copy = needsReview
    ? 'Your payment has been received, but your seats are not confirmed. Contact the organiser with this booking reference so they can review it. Please do not pay again.'
    : settled
    ? online ? 'Your seats are confirmed. Keep your booking reference and use the online event details below.'
      : 'Your seats are confirmed. Keep your booking reference and show your entry pass at the venue.'
    : status === 'cancelled' ? 'This booking was cancelled. Contact the organiser if you have a question.'
      : status === 'waitlist' ? 'The event is full. No seat is held and no payment is due. The organiser will contact you if places become available.'
        : payable ? 'Complete the payment before the hold expires to confirm your seats.'
          : 'Your seats are not confirmed. Refresh the booking status before trying again if money was debited.';
  const tone = settled ? ['#047857', '#10B981'] : status === 'cancelled' ? ['#991B1B', '#EF4444'] : ['#B45309', '#F59E0B'];
  const closed = bookingClosed({ ...event, endAt: b?.eventEndAt || event?.endAt, archivedAt: b?.eventArchived ? true : event?.archivedAt }, now);
  const passes = asArray<any>(b?.passes).filter(pass => /^https?:\/\//i.test(String(pass?.url || '')));
  const people = asArray<any>(b?.participants);
  const merged = {
    id: event?.id, slug: event?.slug,
    title: b?.eventTitle || event?.title,
    description: event?.description,
    startAt: b?.eventStartAt || event?.startAt,
    endAt: event?.endAt,
    venue: b?.eventVenue || event?.venue,
    venueAddress: event?.venueAddress,
    venueMapUrl: b?.eventMapUrl || event?.venueMapUrl,
    mode,
    onlinePlatform: b?.onlinePlatform ?? event?.onlinePlatform,
  };
  const shareContent = eventShareContent(event);
  const pageUrl = publicShareUrl(shareContent.path);
  // Website EventActions sit under every confirmation; a cancelled booking has nothing to diary.
  const actionable = status !== 'cancelled';
  const calendar = actionable ? googleCalendarUrl(merged, pageUrl) : '';
  const directions = actionable ? directionsUrl(merged) : '';
  const share = () => sharePublicPage(shareContent);
  const unit = Number(b?.unitAmount || 0);
  const total = Number(b?.totalAmount || 0);
  const seats = Number(b?.noOfPersons || people.length || 1);

  return (
    <View style={styles.ticketShadow}>
      <LinearGradient colors={['#0B1A45', '#1E3A8A', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stub}>
        <View pointerEvents="none" style={styles.stubOrb} />
        <View style={styles.stubTop}>
          <LinearGradient colors={tone} style={styles.statusDisc}>
            <Icon name={settled ? 'check' : status === 'cancelled' ? 'close' : 'schedule'} size={22} color={PALETTE.white} />
          </LinearGradient>
          <View style={styles.flexMin}>
            <Text style={styles.stubEyebrow}>ACTIV EVENT TICKET</Text>
            <Text style={styles.stubTitle} numberOfLines={2}>{headline}</Text>
          </View>
        </View>
        <Text style={styles.stubCopy}>{copy}</Text>
        <View style={styles.refBox}>
          <Text style={styles.refLabel}>YOUR BOOKING REFERENCE</Text>
          <Text style={styles.ref} selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{b?.bookingRef || '—'}</Text>
          <Text style={styles.refHint}>Keep this — it is how we find your booking.</Text>
        </View>
      </LinearGradient>

      <View style={styles.perf}>
        <View style={[styles.notch, { left: -11 }]} />
        <View style={styles.perfLine} />
        <View style={[styles.notch, { right: -11 }]} />
      </View>

      <View style={styles.tBody}>
        <Text style={styles.tEvent}>{merged.title || 'Event'}</Text>
        <View style={styles.tFacts}>
          <View style={styles.tFact}>
            <Icon name="event" size={16} color={PALETTE.blue} />
            <Text style={styles.tFactText}>{merged.startAt ? formatWhen(merged) : 'To be confirmed'}</Text>
          </View>
          <View style={styles.tFact}>
            <Icon name={online ? 'videocam' : 'place'} size={16} color={PALETTE.blue} />
            <Text style={styles.tFactText}>{online ? (merged.onlinePlatform || 'Online') : (merged.venue || 'Venue to be announced')}</Text>
          </View>
        </View>

        {/* Website parity: drawn for every online booking. The server only
            fills `onlineUrl` on a by-reference read (GET /event-bookings/:ref),
            which is the proof of booking; without it the copy says it is coming. */}
        {online && settled ? (
          <View style={styles.online}>
            <Text style={styles.onlineHead}>YOUR ONLINE EVENT</Text>
            {b?.onlineUrl ? (
              <>
                <Text style={styles.small}>{merged.onlinePlatform ? `This event runs on ${merged.onlinePlatform}.` : 'This event is online.'}</Text>
                <GradientButton label={onlineRegistrationLink(b.onlineUrl) ? 'Complete platform registration' : 'Join online event'} icon="videocam" onPress={() => open(String(b.onlineUrl))} style={{ marginTop: SPACE.sm }} />
                <Text style={[styles.small, { marginTop: SPACE.sm }]} selectable numberOfLines={2}>{b.onlineUrl}</Text>
                <Text style={styles.small}>{onlineRegistrationLink(b.onlineUrl) ? 'Complete the platform form and follow its instructions to receive your personal joining link.' : 'Open this link at the event start time. Please keep it private.'}</Text>
              </>
            ) : (
              <Text style={styles.small}>
                {merged.onlinePlatform ? `This event runs on ${merged.onlinePlatform}. ` : 'This event is online. '}
                The organiser has not added the joining details yet. Check this booking again or contact the event team.
              </Text>
            )}
          </View>
        ) : null}

        {actionable ? (
          <View style={styles.tActions}>
            {calendar ? <TicketAction icon="event" label="Calendar" onPress={() => open(calendar)} /> : null}
            {!!shareContent.path && <TicketAction icon="share" label="Share" onPress={share} />}
            {directions ? <TicketAction icon="directions" label="Directions" onPress={() => open(directions)} /> : null}
          </View>
        ) : null}

        {settled && !online ? (passes.length ? passes.map((pass, index) => (
          <View key={pass.registrationNo || index} style={styles.qrRow}>
            <View style={styles.qrFrame}><QrCode value={String(pass.url)} size={104} /></View>
            <View style={styles.flexMin}>
              <Text style={styles.qrTitle}>{pass.name || 'Participant ' + (index + 1)}</Text>
              <Text style={styles.small} selectable>{pass.registrationNo}</Text>
              <Text style={styles.small}>Show this entry pass and your ID at the entrance.</Text>
              <Text style={styles.link} accessibilityRole="button" onPress={() => Share.share({ message: String(pass.url), title: 'ACTIV event pass' }).catch(() => null)}>Share entry pass</Text>
            </View>
          </View>
        )) : <Text style={[styles.small, { marginTop: SPACE.md }]}>Your entry pass is not available here yet. Refresh your booking or contact the organiser with your booking reference.</Text>) : null}
        {settled && b?.whatsappChannelUrl ? <GradientButton label="Join the event WhatsApp group or channel" icon="chat" onPress={() => open(String(b.whatsappChannelUrl))} style={{ marginTop: SPACE.md }} /> : null}
        {settled ? asArray<any>(b?.attachments).map((file, index) => <GradientButton key={file.id || index} label={'Download ' + (file.title || file.name || 'event document ' + (index + 1))} icon="download" variant="outline" onPress={() => openPublicAttachment(resolveMediaUrl(file.url || file.fileUrl))} style={{ marginTop: SPACE.sm }} />) : null}

        <Text style={styles.tSection}>BOOKING DETAILS</Text>
        {b?.bookedBy?.name ? <ReceiptLine label="Name" value={b.bookedBy.name} /> : null}
        {b?.bookedBy?.email ? <ReceiptLine label="Email" value={b.bookedBy.email} selectable /> : null}
        {b?.bookedBy?.phone ? <ReceiptLine label="Mobile" value={b.bookedBy.phone} selectable /> : null}
        <ReceiptLine label="Price per seat" value={unit > 0 ? money(unit) : total > 0 ? money(total / Math.max(1, seats)) : 'Free'} />
        <ReceiptLine label="No. of persons" value={String(seats)} />
        {b?.createdAt ? <ReceiptLine label="Booked on" value={formatWhen({ startAt: b.createdAt })} /> : null}
        {b?.payment?.reference ? <ReceiptLine label="Payment reference" value={b.payment.reference} selectable /> : null}
        {b?.payment?.paidAt ? <ReceiptLine label="Paid on" value={formatWhen({ startAt: b.payment.paidAt })} /> : null}
        {payable && b?.expiresAt ? <ReceiptLine label="Complete payment by" value={formatWhen({ startAt: b.expiresAt })} /> : null}
        <ReceiptLine label="Payment status" value={paymentLabel} />
        <View style={styles.dash} />
        <ReceiptLine label="Total amount" value={status === 'waitlist' ? 'No payment due' : total > 0 ? money(total) : 'Free'} strong />

        {people.length ? (
          <View style={styles.people}>
            <Text style={styles.tSection}>PARTICIPANTS</Text>
            {people.map((p, i) => (
              <View key={`${p?.email || p?.phone || ''}-${i}`} style={styles.personRow}>
                <GradientAvatar name={p?.name || `Participant ${i + 1}`} size={34} />
                <View style={styles.flexMin}>
                  <Text style={styles.person}>{p?.name || `Participant ${i + 1}`}</Text>
                  {!!p?.email && <Text style={styles.small} selectable>{p.email}</Text>}
                  {!!p?.phone && <Text style={styles.small} selectable>{p.phone}</Text>}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {asArray<any>(b?.responses).length ? <><Text style={styles.tSection}>REGISTRATION DETAILS</Text>{asArray<any>(b.responses).map((answer, index) => <ReceiptLine key={answer.key || index} label={answer.label || answer.key} value={answer.value || '?'} />)}</> : null}
        {b?.note ? <ReceiptLine label="Note to organiser" value={String(b.note)} /> : null}
        {b?.contactPhone || event?.contactPhone ? <Text style={styles.link} onPress={() => open('tel:' + String(b.contactPhone || event.contactPhone).replace(/[^\d+]/g, ''))}>Contact the organiser</Text> : null}
        {b?.contactEmail || event?.contactEmail ? <Text style={styles.link} onPress={() => open('mailto:' + String(b.contactEmail || event.contactEmail))}>Email the organiser</Text> : null}
        {settled ? <Text style={styles.small}>For a change of attendee, contact the organiser. Paid bookings follow the event cancellation policy.</Text> : null}
        {payable && !closed ? <GradientButton label={`Pay ${money(total)} and confirm`} icon="payment" onPress={onPay} style={{ marginTop: SPACE.lg }} /> : null}
        {!closed && !payable && !settled && status !== 'waitlist' && (expired || payStatus === 'failed' || status === 'cancelled') ? (
          <GradientButton label="Book again" variant="outline" icon="replay" onPress={onRebook} style={{ marginTop: SPACE.lg }} />
        ) : null}
      </View>
      <TornEdge color={PALETTE.white} flip teeth={24} />
    </View>
  );
}

const EventBookingScreen = ({ navigation, route }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const open = (url: string) => { if (url) openWebsitePage(navigation, url, 'Event information'); };
  const eventId = String(route?.params?.eventId || '');
  const now = useEventClock();
  const scroll = useRef<ScrollView>(null);
  const busy = useRef(false);
  const [step, setStep] = useState<'choice' | 'form' | 'review'>('choice');
  const [signedIn, setSignedIn] = useState(false);
  const [answers, setAnswers] = useState<RegistrationAnswers>({});
  const [checking, setChecking] = useState(false);
  const [statusError, setStatusError] = useState('');
  const initialRef = String(route?.params?.ref || '');
  const [event, setEvent] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState<Person>({ name: '', email: '', phone: '' });
  const [count, setCount] = useState(1);
  const [participantDetails, setParticipants] = useState<Person[]>([{ name: '', email: '', phone: '' }]);
  const [firstUsesBooker, setFirstUsesBooker] = useState(!route?.params?.forOthers);
  const participants = Array.from({ length: count }, (_, index) => index === 0 && firstUsesBooker
    ? me : participantDetails[index] || { name: '', email: '', phone: '' });
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // Opened by reference alone (a payment result that lost the event id):
      // the booking names its event.
      const byRef = initialRef ? await getEventBooking(initialRef) : null;
      if (initialRef && !byRef?.bookingRef) throw new Error('This booking could not be found. Check your reference and try again.');
      const id = eventId || String(byRef?.eventId || '');
      const [token, role] = await Promise.all([getAuthToken(), getUserRole()]);
      const memberSession = !!token && role === 'member';
      const [ev, prof] = await Promise.all([
        getBookableEvent(id, !memberSession).catch((err) => { if (byRef) return { id, title: byRef.eventTitle, startAt: byRef.eventStartAt, endAt: byRef.eventEndAt, days: byRef.eventDays, venue: byRef.eventVenue, mode: byRef.mode, closed: true }; throw err; }),
        memberSession ? getMyProfile().catch(() => ({})) : Promise.resolve({}),
      ]);
      const existing = byRef;
      setEvent(ev);
      setBooking(existing);
      setSignedIn(memberSession);
      setStep(memberSession || existing ? 'form' : 'choice');
      if (memberSession) setMe({ name: String(prof?.fullName || ''), email: String(prof?.email || ''), phone: String(prof?.phoneNumber || '') });
      else if (byRef?.bookedBy) setMe({ name: String(byRef.bookedBy.name || ''), email: String(byRef.bookedBy.email || ''), phone: String(byRef.bookedBy.phone || '') });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [eventId, initialRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const enterForm = () => { setStep('form'); setFormError(''); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const memberSignIn = async () => {
    const fresh = await getBookableEvent(eventId || String(event?.id || ''), false);
    if (!fresh) throw new Error('The event could not be refreshed. Please try again.');
    setEvent(fresh); setSignedIn(true); clearPublicAction(); enterForm();
  };
  const backToEvents = () => signedIn ? navigation.navigate('MemberEvents') : navigation.navigate('PublicExplore', { section: 'events' });
  const backStep = () => {
    if (booking || submitting || checking) return false;
    if (step === 'review') setStep('form');
    else if (step === 'form' && !signedIn) setStep('choice');
    else return false;
    scroll.current?.scrollTo({ y: 0, animated: false }); return true;
  };

  /* Back from checkout (paid, abandoned or failed): re-read the ticket quietly
     so its state is the server's, not the one we left with. GET only. */
  const bookingRef = String(booking?.bookingRef || '');
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!focused.current) { focused.current = true; return; }
    if (!bookingRef) return;
    getEventBooking(bookingRef).then((fresh) => { if (fresh?.bookingRef) { setBooking(fresh); setStatusError(''); } }).catch(() => setStatusError('Could not refresh your booking. Check the status before paying again.'));
  }, [bookingRef]));

  const effectiveId = eventId || String(event?.id || booking?.eventId || '');
  const capacity = Number(event?.capacity || 0);
  const left = typeof event?.seatsLeft === 'number' && capacity > 0 ? Math.max(0, Number(event.seatsLeft)) : null;
  const full = left !== null && left <= 0;
  const max = Math.max(1, Math.min(Number(event?.maxPerBooking || 50), left !== null && left > 0 ? left : 50));
  const unit = Number(event?.amount ?? event?.price ?? 0);
  const total = unit * count;
  const closed = !!event && bookingClosed(event, now);
  const fields = asArray<RegistrationField>(event?.registrationFields);
  const attendees = bookingParticipants(me, participants, count, firstUsesBooker);
  useEffect(() => { setParticipants(prev => Array.from({ length: count }, (_, i) => prev[i] || { name: '', email: '', phone: '' })); }, [count]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      return backStep();
    });
    return () => listener.remove();
  }, [navigation, step, booking, submitting, checking, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = (key: string) => setErrors(prev => ({ ...prev, [key]: '' }));
  const setParticipant = (i: number, key: keyof Person, value: string) => {
    setParticipants(participants.map((row, index) => index === i ? { ...row, [key]: value } : row));
    if (i === 0) setFirstUsesBooker(false);
    clear('p' + i + '.' + key);
  };
  const pay = (b: any) => navigation.navigate('PaymentCheckout', { orderType: 'event_booking', bookingRef: String(b?.bookingRef || ''), eventId: effectiveId || String(b?.eventId || '') });
  const formFailure = (err: any) => {
    const found = mapBookingErrors(err);
    if (Object.keys(found).length) { setErrors(prev => ({ ...prev, ...found })); setStep('form'); }
    setFormError(errorText(err)); scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const validate = (current: any = event) => {
    const currentMax = Math.max(1, Number(current?.maxPerBooking || 50));
    const found = validateBookingForm(me, participants, count, currentMax, asArray(current?.registrationFields), answers, firstUsesBooker);
    setErrors(found);
    if (Object.keys(found).length) { setFormError('Please check the highlighted fields.'); setStep('form'); scroll.current?.scrollTo({ y: 0, animated: true }); return false; }
    return true;
  };
  const checkAvailability = (current: any) => {
    if (bookingClosed(current)) throw new Error('Bookings for this event have closed.');
    if (Number(current?.capacity) > 0 && Number(current?.seatsLeft) < count) throw new Error(Number(current?.seatsLeft) <= 0 ? 'This event is fully booked. Contact the organiser for assistance.' : 'Only ' + current.seatsLeft + ' seats remain. Please update the number of people.');
  };
  const goToReview = async () => {
    if (busy.current || !validate()) return;
    busy.current = true; setChecking(true); setFormError('');
    try {
      const fresh = await getBookableEvent(effectiveId, !signedIn); setEvent(fresh);
      checkAvailability(fresh); if (!validate(fresh)) return;
      await checkEventBooking(effectiveId, { email: me.email.trim(), phone: nationalMobile(me.phone), participants: attendees }, !signedIn);
      setStep('review'); scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (err) { formFailure(err); }
    finally { busy.current = false; setChecking(false); }
  };
  const submit = async () => {
    if (busy.current || !validate()) return;
    busy.current = true; setSubmitting(true); setFormError('');
    try {
      const fresh = await getBookableEvent(effectiveId, !signedIn); setEvent(fresh);
      checkAvailability(fresh); if (!validate(fresh)) return;
      if (Number(fresh.amount ?? fresh.price ?? 0) !== unit) { setFormError('The event price has changed. Review the updated total before continuing.'); return; }
      const b = await createEventBooking(effectiveId, {
        name: me.name.trim(), email: me.email.trim().toLowerCase(), phone: nationalMobile(me.phone), noOfPersons: count, participants: attendees, useBookerForFirstParticipant: firstUsesBooker, responses: answers, note: note.trim() || undefined,
      }, !signedIn);
      if (!b?.bookingRef) throw new Error('The booking response was incomplete. Check your confirmation email or contact the organiser before retrying.');
      setBooking(b); scroll.current?.scrollTo({ y: 0, animated: false });
      if (String(b.payment?.status) === 'pending' && String(b.status || 'active') === 'active') pay(b);
      else await getEventBooking(String(b.bookingRef)).then(freshBooking => { if (freshBooking?.bookingRef) setBooking(freshBooking); }).catch(() => setStatusError('Your booking was saved. Refresh to load the latest ticket details.'));
    } catch (err) { formFailure(err); }
    finally { busy.current = false; setSubmitting(false); }
  };
  const refreshTicket = async () => {
    if (!bookingRef || busy.current) return;
    busy.current = true; setChecking(true); setStatusError('');
    try { const fresh = await getEventBooking(bookingRef); if (!fresh?.bookingRef) throw new Error('Booking status unavailable'); setBooking(fresh); }
    catch (err) { setStatusError(errorText(err)); }
    finally { busy.current = false; setChecking(false); }
  };
  const rebook = async () => {
    if (busy.current) return;
    busy.current = true; setChecking(true); setStatusError('');
    try {
      const freshBooking = await getEventBooking(bookingRef); setBooking(freshBooking);
      const state = bookingState(freshBooking);
      if (state.settled || state.payable || state.status === 'waitlist') { setStatusError('Your booking status has changed. Review this ticket before taking another action.'); return; }
      const fresh = await getBookableEvent(effectiveId, !signedIn); setEvent(fresh); checkAvailability(fresh);
      setBooking(null); setStep('form'); setErrors({}); setFormError(''); navigation.setParams({ ref: undefined });
    } catch (err) { setStatusError(errorText(err)); }
    finally { busy.current = false; setChecking(false); }
  };

  const bookForSomeoneElse = async () => {
    if (busy.current) return;
    busy.current = true; setChecking(true); setStatusError('');
    try {
      const fresh = await getBookableEvent(effectiveId, !signedIn);
      if (bookingClosed(fresh)) throw new Error('Bookings for this event have closed.');
      if (Number(fresh.capacity) > 0 && Number(fresh.seatsLeft) <= 0) throw new Error('This event is fully booked. Please contact the organiser.');
      setEvent(fresh); setBooking(null); setCount(1); setParticipants([{ name: '', email: '', phone: '' }]); setFirstUsesBooker(false);
      setAnswers({}); setNote(''); setErrors({}); setFormError(''); setStep('form');
      navigation.setParams({ ref: undefined, forOthers: true });
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (err) { setStatusError(errorText(err)); }
    finally { busy.current = false; setChecking(false); }
  };

  const showForm = !loading && !error && !!event && !booking && !closed && !full && step !== 'choice';

  return (
    <PremiumPage
      scrollRef={scroll}
      header={(
        <PremiumPageHeader
          eyebrow={booking ? 'Your booking' : 'Book Now'}
          title={booking ? 'Your ticket' : step === 'choice' ? 'Choose how to book' : step === 'review' ? 'Review your booking' : 'Book seats'}
          subtitle={booking ? 'Keep your reference and entry pass.' : step === 'choice' ? 'Continue as a guest or sign in for your membership rate.' : 'Book early to avoid missing out.'}
          onBack={() => { if (!backStep()) navigation.goBack(); }}
          art={booking ? <EventTicket3D size={88} /> : <EventCalendar3D size={88} />}
        />
      )}
      footer={showForm ? (
        <BottomActionBar note={total > 0 ? `Total ${money(total)} · ${count} ${count === 1 ? 'seat' : 'seats'}` : 'Free — no payment needed'}>
          <GradientButton label={step === 'form' ? 'Review booking' : total > 0 ? `Pay ${money(total)} and confirm` : 'Confirm booking'} icon={step === 'form' ? 'arrow-forward' : 'check-circle'} loading={submitting || checking} onPress={step === 'form' ? goToReview : submit} style={{ flex: 1 }} />
        </BottomActionBar>
      ) : booking && !loading ? (
        <BottomActionBar>
          <GradientButton label="Back to events" variant="outline" icon="event-note" onPress={backToEvents} style={{ flex: 1 }} />
        </BottomActionBar>
      ) : undefined}
    >
      {loading ? (
        <View style={styles.overlapBare}><CardSkeletons rows={3} /></View>
      ) : error ? (
        <FadeInUp style={styles.overlap}>
          <SurfaceCard>
            {/active membership/i.test(error) ? (
              <StateView
                compact
                art={<EventTicket3D size={64} />}
                title="Members-only event"
                message={error}
                action="Activate membership"
                actionIcon="workspace-premium"
                onAction={() => openPublicAction(navigation, { kind: 'membership' })}
              />
            ) : (
              <StateView kind="error" compact title="The booking could not be loaded" message={error} onAction={load} />
            )}
          </SurfaceCard>
        </FadeInUp>
      ) : !event ? (
        <FadeInUp style={styles.overlap}>
          <SurfaceCard><StateView compact art={<EventCalendar3D size={64} />} title="Event not found" message="It may have been withdrawn." action="Back to events" onAction={backToEvents} /></SurfaceCard>
        </FadeInUp>
      ) : (
        <>
          <FadeInUp delay={60} style={styles.overlap}>
            <SurfaceCard>
              {!booking && event?.bannerUrl ? <FitImage uri={resolveMediaUrl(event.bannerUrl)} style={{ marginBottom: SPACE.md, borderRadius: 14 }} /> : null}
              <View style={styles.evRow}>
                <DateTile date={event?.startAt} size={60} />
                <View style={styles.flexMin}>
                  <Text style={styles.evTitle} numberOfLines={3}>{event?.title || 'Event'}</Text>
                  <View style={styles.metaRow}>
                    <Icon name="schedule" size={SIZE.iconSm} color={PALETTE.textFaint} />
                    <Text style={styles.evMeta}>{formatWhen(event)}</Text>
                  </View>
                  {whereOf(event) ? (
                    <View style={styles.metaRow}>
                      <Icon name={String(event?.mode || '') === 'online' ? 'videocam' : 'place'} size={SIZE.iconSm} color={PALETTE.textFaint} />
                      <Text style={styles.evMeta}>{whereOf(event)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {!booking ? (
                <View style={styles.priceStrip}>
                  <View style={styles.flexMin}>
                    <Text style={styles.priceStripValue}>{unit > 0 ? money(unit) : 'Free'}{unit > 0 ? <Text style={styles.small}>  per seat</Text> : null}</Text>
                    {event?.memberRateApplied && Number(event?.memberSaving) > 0 ? (
                      <Text style={styles.saveText}>Member rate — you save {money(Number(event.memberSaving))} per seat <Text style={styles.strike}>{money(Number(event?.price))}</Text></Text>
                    ) : step !== 'choice' && event?.hasMemberRate && !event?.memberRateApplied && Number(event?.memberPrice) < Number(event?.price) ? (
                      <Text style={styles.memberHint} onPress={() => { if (signedIn) navigation.navigate('MembershipPlans'); else { setStep('choice'); scroll.current?.scrollTo({ y: 0, animated: false }); } }}>Members pay {money(Number(event.memberPrice))} — {signedIn ? 'activate your membership' : 'sign in for your member rate'}</Text>
                    ) : null}
                  </View>
                  {event?.registrationClosesAt ? (
                    <View style={styles.closesChip}>
                      <Icon name="timer" size={13} color={PALETTE.amberDark} />
                      <Text style={styles.closesText} numberOfLines={2}>Closes {shortDate(event.registrationClosesAt)}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {!booking && left !== null ? (
                left <= 0 ? (
                  <Text style={[styles.small, styles.fullText]}>This event is fully booked. Contact the organiser for availability.</Text>
                ) : <SeatMeter capacity={capacity} left={left} style={{ marginTop: SPACE.md }} />
              ) : null}
              {!booking && (event?.contactPhone || event?.contactEmail) ? <View style={{ marginTop: SPACE.md }}>
                <Text style={styles.qtyLabel}>{event.contactName || 'Event organiser'}</Text>
                {event.contactPhone ? <Text style={styles.link} accessibilityRole="link" onPress={() => open('tel:' + String(event.contactPhone).replace(/[^\d+]/g, ''))}>{event.contactPhone}</Text> : null}
                {event.contactEmail ? <Text style={styles.link} accessibilityRole="link" onPress={() => open('mailto:' + event.contactEmail)}>{event.contactEmail}</Text> : null}
              </View> : null}
            </SurfaceCard>
          </FadeInUp>

          {!booking && step !== 'choice' ? <View style={styles.steps}>{['Details', 'Review', 'Confirmation'].map((label, index) => <View key={label} style={styles.stepItem}><Text style={[styles.stepNumber, (step === 'review' ? index <= 1 : index === 0) && styles.stepCurrent]}>{index + 1}</Text><Text style={styles.stepLabel}>{label}</Text></View>)}</View> : null}
          {formError ? <Notice kind="danger" text={formError} style={styles.noteBox} /> : null}
          {statusError ? <Notice kind="warning" text={statusError} style={styles.noteBox} /> : null}
          {booking ? (
            <FadeInUp delay={140} style={styles.pad}>
              <Ticket
                open={open}
                b={booking}
                event={event}
                onPay={() => pay(booking)}
                onRebook={rebook}
              />
              {bookingState(booking, now).settled && !closed ? <GradientButton label="Book for someone else" variant="outline" icon="person-add" loading={checking} onPress={bookForSomeoneElse} style={{ marginTop: SPACE.md }} /> : null}
              <GradientButton label="Refresh booking status" variant="outline" icon="refresh" loading={checking} onPress={refreshTicket} style={{ marginTop: SPACE.md }} />
            </FadeInUp>
          ) : closed || full ? (
            <FadeInUp delay={140} style={styles.pad}>
              <SurfaceCard>
                <StateView compact art={<EventCalendar3D size={64} />} title={full ? 'Fully booked' : 'Bookings closed'} message={full ? 'This event has no seats available. Please contact the organiser.' : 'Bookings for this event have closed.'} />
              </SurfaceCard>
            </FadeInUp>
          ) : step === 'choice' ? (
            <View style={styles.pad}>
              <EventBookingChoice event={{ ...event, id: effectiveId }} navigation={navigation} onGuest={() => { clearPublicAction(); enterForm(); }} onMember={memberSignIn} />
            </View>
          ) : step === 'review' ? (
            <View style={styles.pad}>
              <SurfaceCard>
                <Text style={styles.tSection}>YOUR BOOKING</Text>
                <ReceiptLine label="Name" value={me.name} /><ReceiptLine label="Email" value={me.email} /><ReceiptLine label="Mobile" value={nationalMobile(me.phone)} />
                <ReceiptLine label="Seats" value={String(count)} /><ReceiptLine label="Price per seat" value={unit > 0 ? money(unit) : 'Free'} />
                {event.memberRateApplied && Number(event.memberSaving) > 0 ? <ReceiptLine label="Membership saving" value={money(Number(event.memberSaving) * count)} /> : null}
                <ReceiptLine label="Total" value={total > 0 ? money(total) : 'Free'} strong />
                <Text style={styles.tSection}>PARTICIPANTS</Text>
                {attendees.map((person, index) => <View key={index} style={styles.reviewPerson}><Text style={styles.person}>{person.name || 'Participant ' + (index + 1)}</Text>{person.email ? <Text style={styles.small}>{person.email}</Text> : null}{person.phone ? <Text style={styles.small}>{person.phone}</Text> : null}</View>)}
                {fields.length ? <Text style={styles.tSection}>REGISTRATION DETAILS</Text> : null}
                {fields.map(field => <ReceiptLine key={field.key} label={field.label || field.key} value={field.type === 'checkbox' ? answers[field.key] === true ? 'Yes' : 'No' : String(answers[field.key] || '—')} />)}
                {note ? <ReceiptLine label="Note to organiser" value={note} /> : null}
                <GradientButton label="Edit details" variant="outline" icon="edit" disabled={submitting} onPress={() => { setStep('form'); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={{ marginTop: SPACE.lg }} />
              </SurfaceCard>
              <Text style={styles.terms}>By continuing you agree to <Text style={styles.link} onPress={() => open(websiteUrl('/terms-and-conditions'))}>Terms &amp; Conditions</Text> and <Text style={styles.link} onPress={() => open(websiteUrl('/cancellation-policy'))}>Cancellation Policy</Text>.</Text>
            </View>
          ) : (
            <>
              {event?.registrationNote ? (
                <FadeInUp delay={120}>
                  <Notice kind="warning" title="Please note" text={String(event.registrationNote)} style={styles.noteBox} />
                </FadeInUp>
              ) : null}

              <FadeInUp delay={160} style={{ marginTop: SPACE.lg }}>
                <PremiumSection icon="person-outline" title="Your details" subtitle="The ticket and reminders are sent here">
                  <PremiumInput
                    label="Full name" required value={me.name} error={errors.name}
                    onChangeText={(v) => { setMe({ ...me, name: v }); clear('name'); }}
                    icon="person-outline" autoCapitalize="words" autoComplete="name" textContentType="name"
                  />
                  <PremiumInput
                    label="Email" required value={me.email} error={errors.email}
                    onChangeText={(v) => { setMe({ ...me, email: v }); clear('email'); }}
                    icon="mail-outline" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
                  />
                  <PremiumInput
                    label="Mobile" required value={me.phone} error={errors.phone}
                    onChangeText={(v) => { setMe({ ...me, phone: v }); clear('phone'); }}
                    icon="call" keyboardType="phone-pad" textContentType="telephoneNumber" hint="10-digit mobile number"
                    style={{ marginBottom: 0 }}
                  />
                </PremiumSection>
              </FadeInUp>

              <FadeInUp delay={220}>
                <PremiumSection icon="groups" title="How many people?" subtitle={`Up to ${max} per booking`}>
                  <View style={styles.rowBetween}>
                    <View style={styles.flexMin}>
                      <Text style={styles.qtyLabel}>Seats</Text>
                      <Text style={styles.small}>{unit > 0 ? `${money(unit)} per person${event?.memberRateApplied ? ' · member rate' : ''}` : 'Free event'}</Text>
                    </View>
                    <Stepper value={count} min={1} max={max} onChange={(n) => { setCount(n); clear('count'); }} />
                  </View>
                  {errors.count ? <Text style={styles.err}>{errors.count}</Text> : null}
                  <Text style={[styles.qtyLabel, { marginTop: SPACE.lg }]}>Participants</Text>
                  <Text style={[styles.small, { marginTop: SPACE.xs }]}>Enter each attendee’s name, email and mobile. Each email can be booked once for this event; your booking contact can stay the same.</Text>
                  {!!event?.memberRateApplied && <Text style={[styles.small, { marginTop: SPACE.xs }]}>Your member rate applies to each seat, including the friends you book for.</Text>}
                  {!firstUsesBooker && <Text style={[styles.small, { marginTop: SPACE.xs }]}>You are booking for someone else. Enter their details in Participant 1.</Text>}
                  {participants.map((p, i) => (
                    <View key={i} style={styles.other}>
                      <View style={styles.otherHead}>
                        <GradientGlyph icon="person-add-alt" tone="sky" size={30} />
                        <Text style={styles.otherTitle}>{`Participant ${i + 1}${i === 0 && firstUsesBooker ? ' — your details' : ''}`}</Text>
                      </View>
                      <PremiumInput label="Name" required placeholder="Full name" value={p.name} error={errors[`p${i}.name`]} onChangeText={(v) => setParticipant(i, 'name', v)} icon="person-outline" autoCapitalize="words" />
                      <PremiumInput label="Email" required placeholder="Email address" value={p.email} error={errors[`p${i}.email`]} onChangeText={(v) => setParticipant(i, 'email', v)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} icon="mail-outline" />
                      <PremiumInput label="Mobile" required placeholder="Mobile number" value={p.phone} error={errors[`p${i}.phone`]} onChangeText={(v) => setParticipant(i, 'phone', v)} keyboardType="phone-pad" icon="call" style={{ marginBottom: 0 }} />
                    </View>
                  ))}
                  <PremiumInput
                    label="Note (optional)" value={note} onChangeText={setNote} multiline
                    placeholder="Anything the organiser should know" style={{ marginTop: SPACE.lg, marginBottom: 0 }}
                  />
                </PremiumSection>
              </FadeInUp>

              {fields.length ? <PremiumSection icon="assignment" title="Registration details" subtitle="Questions from the event organiser"><RegistrationFields fields={fields} answers={answers} errors={errors} onChange={(key, value) => { setAnswers(previous => ({ ...previous, [key]: value })); clear('responses.' + key); }} /></PremiumSection> : null}
              <FadeInUp delay={280} style={styles.pad}>
                <LinearGradient colors={['#0B1A45', '#1E3A8A', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.totalCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.flexMin}>
                      <Text style={styles.totalEyebrow}>TOTAL</Text>
                      <Text style={styles.totalSub}>{count} {count === 1 ? 'seat' : 'seats'}{unit > 0 ? ` × ${money(unit)}` : ''}</Text>
                    </View>
                    <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{total > 0 ? money(total) : 'Free'}</Text>
                  </View>
                  <Text style={styles.totalHint}>The final amount is confirmed by the server when you book.</Text>
                </LinearGradient>
                <Text style={styles.terms}>Review your details before payment. <Text style={styles.link} onPress={() => open(websiteUrl('/terms-and-conditions'))}>Terms &amp; Conditions</Text> ? <Text style={styles.link} onPress={() => open(websiteUrl('/cancellation-policy'))}>Cancellation Policy</Text></Text>
              </FadeInUp>

            </>
          )}
        </>
      )}
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },
  link: { color: PALETTE.blue, fontWeight: '700', marginTop: SPACE.sm, lineHeight: 24 },
  steps: { flexDirection: 'row', margin: SPACE.lg, justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', gap: 5, flex: 1 },
  stepNumber: { borderRadius: 16, width: 32, height: 32, textAlign: 'center', textAlignVertical: 'center', lineHeight: 32, backgroundColor: PALETTE.border, color: PALETTE.textMuted, fontWeight: '800' },
  stepCurrent: { backgroundColor: PALETTE.blue, color: PALETTE.white },
  stepLabel: { ...TYPE.caption, fontWeight: '700' },
  reviewPerson: { marginTop: SPACE.sm, paddingBottom: SPACE.sm, borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  overlap: { marginTop: -PREMIUM_OVERLAP, marginHorizontal: SPACE.lg },
  overlapBare: { marginTop: -PREMIUM_OVERLAP },
  pad: { paddingHorizontal: SPACE.lg, marginTop: SPACE.lg },
  noteBox: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  evRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  evTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 23, color: BRAND.navyDeep },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xs + 2, marginTop: SPACE.xs + 2 },
  evMeta: { ...TYPE.caption, fontSize: 13, lineHeight: 18, flexShrink: 1, minWidth: 0 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  qtyLabel: { ...TYPE.subheading, fontWeight: '700' },
  small: { ...TYPE.caption, marginTop: 3, flexShrink: 1 },
  err: { color: PALETTE.redDark, fontSize: 12, lineHeight: 16, fontWeight: '500', marginTop: SPACE.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.xs, borderRadius: 999, backgroundColor: PALETTE.fieldBg, borderWidth: 1, borderColor: PALETTE.border },
  stepBtn: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center' },
  stepBtnOn: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center' },
  stepValue: { ...TYPE.number, fontSize: 20, lineHeight: 26, minWidth: 28, textAlign: 'center' },
  other: { marginTop: SPACE.lg, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  otherHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md },
  otherTitle: { ...TYPE.label, color: PALETTE.text, flex: 1, flexShrink: 1 },
  totalCard: { borderRadius: 22, padding: SPACE.lg },
  totalEyebrow: { ...TYPE.eyebrow, color: 'rgba(255,255,255,0.7)' },
  totalSub: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  total: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: PALETTE.white, fontVariant: ['tabular-nums'], maxWidth: '60%' },
  totalHint: { fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.7)', marginTop: SPACE.sm },
  terms: { ...TYPE.caption, textAlign: 'center', marginTop: SPACE.md },
  priceStrip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  priceStripValue: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: BRAND.navy, fontVariant: ['tabular-nums'] },
  saveText: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: PALETTE.green, marginTop: 2 },
  strike: { color: PALETTE.textFaint, fontWeight: '400', textDecorationLine: 'line-through' },
  memberHint: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: PALETTE.amberDark, marginTop: 2 },
  closesChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '45%', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: PALETTE.amberSoft },
  closesText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: PALETTE.amberDark, flexShrink: 1 },
  fullText: { marginTop: SPACE.md, fontWeight: '700', color: PALETTE.amberDark },

  ticketShadow: {
    // Transparent so the torn foot shows the canvas between its teeth; iOS
    // shadows follow the children, Android draws the paper flat.
    borderRadius: 22, backgroundColor: 'transparent', shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14, shadowRadius: 22,
  },
  stub: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: SPACE.lg, overflow: 'hidden' },
  stubOrb: { position: 'absolute', right: -50, top: -70, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' },
  stubTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  statusDisc: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  stubEyebrow: { ...TYPE.eyebrow, color: 'rgba(255,255,255,0.65)' },
  stubTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: PALETTE.white, marginTop: 2 },
  stubCopy: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.85)', marginTop: SPACE.md },
  refBox: { marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center' },
  refLabel: { ...TYPE.eyebrow, fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  ref: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: 2, color: PALETTE.white, marginTop: 4, fontVariant: ['tabular-nums'] },
  refHint: { fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  perf: { height: 22, justifyContent: 'center', backgroundColor: PALETTE.white },
  perfLine: { marginHorizontal: SPACE.lg, borderTopWidth: 2, borderStyle: 'dashed', borderColor: PALETTE.borderStrong },
  notch: { position: 'absolute', top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: PALETTE.canvas },
  tBody: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md, backgroundColor: PALETTE.white },
  tEvent: { ...TYPE.heading, fontSize: 18, lineHeight: 24, color: BRAND.navyDeep },
  tFacts: { gap: SPACE.xs + 2, marginTop: SPACE.sm },
  tFact: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  tFactText: { ...TYPE.body, flex: 1, minWidth: 0, color: PALETTE.textSoft },
  online: { marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 16, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  onlineHead: { ...TYPE.eyebrow, color: PALETTE.greenDark, marginBottom: 2 },
  tActions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg },
  tActionWrap: { flex: 1, minWidth: 0 },
  tAction: {
    minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 16, borderWidth: 1,
    borderColor: '#C7DAFB', backgroundColor: PALETTE.blueTint, paddingHorizontal: 4,
  },
  tActionText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: PALETTE.blueDark },
  tSection: { ...TYPE.eyebrow, color: PALETTE.textFaint, marginTop: SPACE.lg, marginBottom: SPACE.xs },
  dash: { borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: PALETTE.border, marginVertical: SPACE.xs },
  people: { marginTop: SPACE.xs, gap: SPACE.sm },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 16, backgroundColor: PALETTE.blueTint, borderWidth: 1, borderColor: '#C7DAFB' },
  qrFrame: { padding: 4, borderRadius: 12, backgroundColor: PALETTE.white },
  qrTitle: { ...TYPE.subheading, fontWeight: '700', color: BRAND.navyDeep },
  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  person: { ...TYPE.bodyStrong },
});

export default EventBookingScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;

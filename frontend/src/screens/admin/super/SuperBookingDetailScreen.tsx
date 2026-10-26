import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  PALETTE, SPACE, TYPE, money, shortDate, dateTime,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleChip, ConsoleButton, ConsoleNote, ConsoleSectionTitle,
  GlassIconButton, PremiumInput, type ConsoleChipKind,
} from '../../../ui';
import { recordBookingPayment, cancelEventBooking, errorText } from '../../../services/superApi';
import { ChipRow, MiniAction, callNumber, whatsappNumber } from './superKit';
import { DeliveryChips, useDeliverySummaries, useDelayedNonce } from './delivery/deliveryKit';

/**
 * ============================================================================
 * SUPER ADMIN — one booking in full (website "View Booking Details" panel)
 * ============================================================================
 *
 * Event details, booking details and the participants who were actually
 * entered — a field with no value is NOT drawn, as on the website.
 *
 * The two actions open INLINE, as the website's footer does:
 *   Confirm booking  any booking that has not been paid and is not cancelled
 *                    (pending, or failed — the lapsed online hold): asks how
 *                    the money was collected (cash / UPI / bank transfer /
 *                    other) → POST /events/:id/bookings/:ref/record-payment
 *                    { mode }. The server takes the seats and notifies.
 *   Cancel booking   an active or waiting-list booking: an optional reason
 *                    (sent to the booker, max 300) → POST …/:ref/cancel
 *                    { reason }.
 *
 * Messages: the latest email / WhatsApp state of this booking
 * (GET /notifications/delivery-summary), re-asked four seconds after a payment
 * or a cancellation because the confirmation goes out in the background; tap
 * for every message (SuperBookingMessages).
 */

type PayMode = 'cash' | 'upi' | 'bank_transfer' | 'offline';
const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'offline', label: 'Other (offline)' },
];

const payChip = (status: string): { label: string; kind: ConsoleChipKind } => (status === 'paid'
  ? { label: 'Paid', kind: 'approved' }
  : status === 'not_required' ? { label: 'Free', kind: 'info' }
    : status === 'failed' ? { label: 'Failed', kind: 'rejected' }
      : { label: 'Pending', kind: 'pending' });

const modeWord = (mode: string) => (mode === 'bank_transfer' ? 'Bank' : mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '');

/** One labelled field — or nothing, when there is no value. */
function Row({ label, value, children, last }: { label: string; value?: string | null; children?: React.ReactNode; last?: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const empty = !children && (value === null || value === undefined || value === '');
  if (empty) return null;
  return (
    <View style={[s.field, last && s.fieldLast]}>
      <Text style={s.fieldLabel} maxFontSizeMultiplier={1.3}>{label.toUpperCase()}</Text>
      {children || <Text style={s.fieldValue} selectable maxFontSizeMultiplier={1.3}>{value}</Text>}
    </View>
  );
}

const SuperBookingDetailScreen: React.FC = () => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const TYPE = useLegacyAppearance(legacyAppearance_TYPE);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const eventId: string = String(route?.params?.eventId || '');
  const event = route?.params?.event || {};
  const [booking, setBooking] = useState<any>(route?.params?.booking || {});
  const [acting, setActing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payMode, setPayMode] = useState<PayMode>('cash');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');

  const ref = String(booking?.bookingRef || '');
  const { nonce, bumpSoon } = useDelayedNonce();
  const { map: delivery, loading: deliveryLoading } = useDeliverySummaries(ref ? [ref] : [], nonce);

  const payStatus = String(booking?.payment?.status || 'pending');
  const canConfirm = booking?.status !== 'cancelled' && (payStatus === 'pending' || payStatus === 'failed');
  const canCancel = booking?.status === 'active' || booking?.status === 'waitlist';
  const pay = payChip(payStatus);
  const bookedBy = booking?.bookedBy || {};
  const named = (Array.isArray(booking?.participants) ? booking.participants : [])
    .filter((p: any) => String(p?.name || '').trim() || String(p?.email || '').trim() || String(p?.phone || '').trim());
  const eventTitle = booking?.eventTitle || event?.title || 'Untitled event';

  const openMessages = () => {
    if (!ref) return;
    navigation.navigate('SuperBookingMessages', { bookingRef: ref, title: eventTitle });
  };

  const markPaid = async () => {
    if (!ref || !eventId || acting) return;
    setActing(true);
    try {
      const updated = await recordBookingPayment(eventId, ref, payMode);
      if (updated && updated.bookingRef) setBooking(updated);
      else setBooking((b: any) => ({ ...(b || {}), payment: { ...(b?.payment || {}), status: 'paid', mode: payMode } }));
      setConfirmOpen(false);
      setNotice('Payment recorded — the booker has been sent their confirmation.');
      // The confirmation goes out in the background; look again shortly.
      bumpSoon();
    } catch (err) {
      Alert.alert('The payment could not be recorded', errorText(err));
    } finally { setActing(false); }
  };

  const cancel = async () => {
    if (!ref || !eventId || acting) return;
    setActing(true);
    try {
      await cancelEventBooking(eventId, ref, (reason || '').trim());
      Alert.alert('Booking cancelled', `${ref} is cancelled and its seats are free again.`);
      // The event's list re-asks for its messages when it regains focus.
      navigation.goBack();
    } catch (err) {
      Alert.alert('The booking could not be cancelled', errorText(err));
    } finally { setActing(false); }
  };

  const footer = (
    <View style={s.footer}>
      {confirmOpen ? (
        <ConsoleCard>
          <Text style={s.fieldLabel} maxFontSizeMultiplier={1.3}>PAYMENT COLLECTED BY</Text>
          <View style={s.pullOut}><ChipRow<PayMode> options={PAY_MODES} value={payMode} onChange={setPayMode} /></View>
          <ConsoleButton kind="approve" icon="check-circle" label="Confirm & notify" onPress={markPaid} loading={acting} style={s.gapTop} />
          <ConsoleButton kind="ghost" label="Back" onPress={() => setConfirmOpen(false)} disabled={acting} style={s.gapTopSm} />
        </ConsoleCard>
      ) : cancelOpen ? (
        <ConsoleCard>
          <PremiumInput
            tone="admin"
            label="Reason"
            placeholder="Reason (sent to the booker, optional)"
            value={reason}
            onChangeText={setReason}
            maxLength={300}
            editable={!acting}
          />
          <ConsoleButton kind="dangerSolid" icon="block" label="Cancel & notify" onPress={cancel} loading={acting} style={s.gapTopSm} />
          <ConsoleButton kind="ghost" label="Keep booking" onPress={() => setCancelOpen(false)} disabled={acting} style={s.gapTopSm} />
        </ConsoleCard>
      ) : (
        <>
          {canConfirm ? <ConsoleButton icon="check-circle" label="Confirm booking" onPress={() => { setConfirmOpen(true); setNotice(''); }} disabled={acting} /> : null}
          {canCancel ? <ConsoleButton kind="danger" icon="block" label="Cancel booking" onPress={() => { setCancelOpen(true); setNotice(''); }} disabled={acting} /> : null}
        </>
      )}
      <Text style={{ ...TYPE.caption, color: PALETTE.textMuted }}>Cancelling releases seats and keeps all booking details.</Text>
      <ConsoleButton kind="soft" label="Close" onPress={() => navigation?.goBack?.()} disabled={acting} />
    </View>
  );

  return (
    <ConsoleScroll avoidKeyboard>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · booking"
        title={eventTitle}
        subtitle={ref || undefined}
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
        right={ref ? <GlassIconButton icon="forum" accessibilityLabel="Messages" onPress={openMessages} /> : undefined}
      />

      <View style={s.body}>
        {notice ? <ConsoleNote kind="green" icon="check-circle" text={notice} style={s.block} /> : null}
        {booking?.payment?.reconciliationRequired ? <ConsoleNote kind="amber" icon="warning" text={`Payment received; seats need organiser review. ${booking.payment.reconciliationReason || ''} No entry pass has been issued. Do not collect another payment.`} style={s.block} /> : null}

        <ConsoleCard style={s.block} accent={booking?.status === 'cancelled' ? PALETTE.red : pay.kind === 'pending' ? PALETTE.amber : PALETTE.green}>
          <View style={s.statusRow}>
            <ConsoleChip label={pay.label} kind={pay.kind} />
            {booking?.payment?.mode ? <ConsoleChip label={modeWord(String(booking.payment.mode))} kind="info" dot={false} /> : null}
            {booking?.status === 'cancelled' ? <ConsoleChip label="Cancelled" kind="rejected" /> : null}
            {booking?.status === 'waitlist' ? <ConsoleChip label="Waiting list" kind="warning" /> : null}
            <View style={s.flex} />
            <Text style={s.total} maxFontSizeMultiplier={1.2}>{Number(booking?.totalAmount || 0) > 0 ? money(Number(booking?.totalAmount || 0)) : 'Free'}</Text>
          </View>
          {ref ? (
            <View style={s.messages}>
              <DeliveryChips summary={delivery?.[ref] || null} loading={deliveryLoading} onOpen={openMessages} />
            </View>
          ) : null}
        </ConsoleCard>

        <ConsoleSectionTitle title="Event Details" icon="event" style={s.section} />
        <ConsoleCard style={s.block}>
          <Row label="Event Name" value={booking?.eventTitle || event?.title} />
          <Row label="Date" value={shortDate(booking?.eventStartAt || event?.startAt)} />
          <Row label="No Of Seat" value={Number(event?.capacity || 0) > 0 ? String(event?.capacity) : ''} />
          <Row label="Venue" value={booking?.eventVenue} last />
        </ConsoleCard>

        <ConsoleSectionTitle title="Booking Details" icon="confirmation-number" style={s.section} />
        <ConsoleCard style={s.block}>
          <Row label="Booking Date" value={dateTime(booking?.createdAt)} />
          <Row label="Name" value={bookedBy?.name} />
          <Row label="Email" value={bookedBy?.email} />
          <Row label="Mobile" value={bookedBy?.phone} />
          <Row label="No Of Participants" value={booking?.noOfPersons ? String(booking.noOfPersons) : ''} />
          <Row label="Booked As" value={booking?.isGuest ? 'Guest' : 'Signed-in member'} />
          <Row label="Ticket Price" value={Number(booking?.unitAmount || 0) > 0 ? money(Number(booking?.unitAmount || 0)) : 'Free'} />
          <Row label="Total Amount" value={Number(booking?.totalAmount || 0) > 0 ? money(Number(booking?.totalAmount || 0)) : 'Free'} />
          {booking?.payment?.mode ? <Row label="Payment Mode"><ConsoleChip label={modeWord(String(booking.payment.mode))} kind="info" dot={false} style={s.selfStart} /></Row> : null}
          <Row label="Payment Status"><ConsoleChip label={pay.label} kind={pay.kind} style={s.selfStart} /></Row>
          {booking?.status === 'cancelled' ? <Row label="Booking"><ConsoleChip label="Cancelled" kind="rejected" style={s.selfStart} /></Row> : null}
          {booking?.status === 'waitlist' ? <Row label="Booking"><ConsoleChip label="Waiting list" kind="warning" style={s.selfStart} /></Row> : null}
          {booking?.memberRateApplied ? (
            <Row label="Rate Applied" value={`Member price${Number(booking?.memberSaving || 0) > 0 ? ` · saved ${money(Number(booking?.memberSaving || 0))}` : ''}`} />
          ) : null}
          {bookedBy?.phone ? (
            <View style={s.contactRow}>
              <MiniAction icon="call" label="Call" onPress={() => callNumber(bookedBy?.phone)} />
              <MiniAction icon="chat" label="WhatsApp" color={PALETTE.greenDark} onPress={() => whatsappNumber(bookedBy?.phone)} />
            </View>
          ) : null}
        </ConsoleCard>

        <ConsoleSectionTitle title="Participants" icon="groups" style={s.section} />
        <ConsoleCard style={s.block}>
          {named.length === 0 ? <Text style={s.empty} maxFontSizeMultiplier={1.3}>No participant details were given.</Text> : named.map((p: any, i: number) => (
            <View key={`p${i}`} style={[s.person, i === named.length - 1 && s.fieldLast]}>
              <Text style={s.personNo} maxFontSizeMultiplier={1.2}>{i + 1}</Text>
              <View style={s.flexText}>
                {p?.name ? <Text style={s.personName} maxFontSizeMultiplier={1.3}>{p.name}</Text> : null}
                {p?.email ? <Text style={s.personSub} selectable maxFontSizeMultiplier={1.3}>{p.email}</Text> : null}
                {p?.phone ? <Text style={s.personSub} selectable maxFontSizeMultiplier={1.3}>{p.phone}</Text> : null}
              </View>
            </View>
          ))}
        </ConsoleCard>

        {footer}
      </View>
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  body: { marginTop: -SPACE.lg },
  block: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  section: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm, marginBottom: SPACE.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.xs },
  total: { fontSize: 20, fontWeight: '800', color: PALETTE.text },
  messages: { marginTop: SPACE.md, paddingTop: SPACE.sm, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  field: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  fieldLast: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: PALETTE.textFaint, marginBottom: 4 },
  fieldValue: { fontSize: 15, fontWeight: '700', color: PALETTE.text },
  selfStart: { alignSelf: 'flex-start' },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  empty: { ...TYPE.caption, fontWeight: '700', textAlign: 'center', paddingVertical: SPACE.lg },
  person: { flexDirection: 'row', gap: SPACE.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  personNo: { width: 20, fontSize: 14, fontWeight: '800', color: PALETTE.textFaint },
  personName: { fontSize: 15, fontWeight: '800', color: PALETTE.text },
  personSub: { fontSize: 13, color: PALETTE.textMuted, marginTop: 2 },
  footer: { marginHorizontal: SPACE.lg, marginTop: SPACE.md, gap: SPACE.sm },
  pullOut: { marginHorizontal: -SPACE.lg },
  gapTop: { marginTop: SPACE.md },
  gapTopSm: { marginTop: SPACE.sm },
});

export default SuperBookingDetailScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_TYPE = TYPE;
const legacyAppearance_PALETTE = PALETTE;

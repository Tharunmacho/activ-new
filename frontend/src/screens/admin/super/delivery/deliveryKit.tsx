import { useLegacyAppearance } from '../../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { notificationReason, notificationTemplatePath } from '../../../../services/deliveryReportApi';
import { PALETTE, SPACE, TYPE, ConsoleChip, ConsoleButton, type ConsoleChipKind } from '../../../../ui';
import {
  getDeliverySummaries, resendNotification,
  type BookingDeliverySummary, type ChannelSummary, type DeliveryLogRow,
} from '../../../../services/notificationDeliveryApi';

/**
 * ============================================================================
 * DELIVERY — the pieces every "did the message arrive?" surface shares
 * ============================================================================
 *
 * The mobile twin of `website/src/features/admin/components/DeliveryUI.tsx`.
 * The Notifications "Automation" view, the per-booking Messages chips and the
 * booking's Messages screen must say the SAME word for the same state, so all
 * of them draw from here — labels, hints and message names are the website's.
 */

export const STATE_META: Record<string, { label: string; kind: ConsoleChipKind; hint: string }> = {
  failed: { label: 'Failed', kind: 'rejected', hint: 'The message could not be sent or delivered. The reason is shown below.' },
  read: { label: 'Seen', kind: 'approved', hint: 'WhatsApp reports the recipient saw it.' },
  marked_read: { label: 'Sent', kind: 'neutral', hint: 'Saved in the account and marked read. This does not confirm it was opened.' },
  delivered: { label: 'Delivered', kind: 'approved', hint: 'WhatsApp reports it reached the phone.' },
  sent: { label: 'Sent', kind: 'info', hint: 'WhatsApp is sending the message. Arrival has not been confirmed.' },
  resent: { label: 'Tried again', kind: 'neutral', hint: 'Another send was attempted. The newer entry shows the result.' },
  accepted: { label: 'Sent', kind: 'info', hint: 'The message was passed to the sending service. Arrival has not been confirmed.' },
  mock: { label: 'Not sent', kind: 'neutral', hint: 'The sending service is not set up, so no message was sent.' },
  skipped: { label: 'Not sent', kind: 'neutral', hint: 'No message was sent. The reason is shown below.' },
  queued: { label: 'Waiting', kind: 'neutral', hint: 'Waiting for sending to finish. The message may be waiting or being tried again.' },
};

/** The state a badge shows — the server's `effectiveStatus`, with a safe fallback for older rows. */
export const stateOf = (row: Partial<DeliveryLogRow> | null | undefined): string => {
  if (!row) return 'queued';
  if (row.effectiveStatus) return String(row.effectiveStatus);
  if (row.mock) return 'mock';
  if ((row as { resentAs?: string }).resentAs) return 'resent';
  if (row.status === 'failed') return 'failed';
  if (row.status === 'sent') return 'accepted';
  return 'queued';
};

const MESSAGE_LABELS: Record<string, string> = {
  ASSOCIATION_UPDATE: 'Association update',
  EVENT_BOOKING_CONFIRMED: 'Booking confirmation',
  EVENT_BOOKING_REMINDER: 'Booking reminder',
  EVENT_BOOKING_CANCELLED: 'Booking cancellation',
  EVENT_BOOKING_WAITLISTED: 'Waitlist notice',
  EVENT_PARTICIPANT_CONFIRMED: 'Participant confirmation',
  EVENT_PARTICIPANT_REMINDER: 'Participant reminder',
  EVENT_PARTICIPANT_CANCELLED: 'Participant cancellation',
  EVENT_DOCUMENT_CONFIRMED: 'Event document',
  EVENT_DOCUMENT_REMINDER: 'Event document (reminder)',
  EVENT_REGISTERED: 'Event registration',
  EVENT_REMINDER: 'Event reminder',
  ACCOUNT_REGISTERED: 'Membership · account created',
  APPLICATION_SUBMITTED: 'Membership · application received',
  APPLICATION_ENDORSED: 'Membership · application endorsed',
  CORRECTION_REQUESTED: 'Membership · correction requested',
  APPLICATION_APPROVED: 'Membership · application approved',
  PAYMENT_REQUIRED: 'Membership · payment pending',
  PAYMENT_SUCCESS: 'Membership · payment received',
  MEMBERSHIP_ACTIVATED: 'Membership · activated',
  MEMBERSHIP_RENEWAL_DUE: 'Membership · renewal due',
  PLATINUM_REQUESTED: 'Membership · platinum requested',
  ADMIN_NEW_APPLICATION: 'Admin · new application',
  ADMIN_PLATINUM_REQUEST: 'Admin · platinum request',
  ADMIN_QUEUE_ALERT: 'Admin · queue alert',
  PASSWORD_RESET: 'Account · password reset link',
  ADMIN_WELCOME: 'Admin · welcome & credentials',
  DONATION_RECEIPT: 'Donation · 80G receipt',
  DONATION_STATEMENT: 'Donation · year-end statement',
  STAGE_CHANGED: 'Membership · stage changed',
};

/** The message-type filter, in the order a booker and then a member meet them. */
export const MESSAGE_TYPES: [string, string][] = Object.entries(MESSAGE_LABELS);

/**
 * A reset link is single-use and a welcome email carried a one-time password;
 * neither is stored, so neither can be replayed (the server refuses too).
 */
const NO_RESEND = new Set(['PASSWORD_RESET', 'ADMIN_WELCOME']);
export const canResend = (row: { event?: string } | null | undefined) => !NO_RESEND.has(String(row?.event || ''));

export const messageLabel = (event?: string) =>
  MESSAGE_LABELS[String(event || '')]
  || String(event || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Prefer a known message type over internal event/template names, keeping real subjects. */
export const deliveryTitle = (row: { title?: string; subject?: string; event?: string; campaignKey?: string; templateId?: string } | null | undefined) => {
  const title = String(row?.title || row?.subject || '').trim();
  const event = String(row?.event || ((row?.campaignKey || '').startsWith('automation:') ? (row?.campaignKey || '').slice(11) : ''));
  if (event && (!title || title === event || title === row?.templateId)) return messageLabel(event);
  return title || 'Notification';
};

export const whenLabel = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const reasonOf = (row: Partial<DeliveryLogRow> | null | undefined) =>
  notificationReason(row?.failureReason || row?.lastError);

/**
 * The reason in plain words (website DeliveryUI.plainReason). A message that
 * went out on a backup template also carries a note — not a failure.
 */
export const plainReason = (row: Partial<DeliveryLogRow> | null | undefined): { text: string; failed: boolean } => {
  if (stateOf(row) === 'resent') return { text: 'Tried again — the newer entry shows the result', failed: false };
  const raw = reasonOf(row);
  if (!raw) return { text: '', failed: false };
  const failed = stateOf(row) === 'failed';
  if (!failed && /^Sent on /i.test(raw)) return { text: 'Sent using the backup WhatsApp message', failed: false };
  return { text: raw, failed };
};

export const channelWord = (channel?: string) => (channel === 'whatsapp' ? 'WhatsApp' : channel === 'push' ? 'Push notification' : channel === 'in_app' ? 'In-app' : 'Email');
export const channelIcon = (channel?: string) => (channel === 'whatsapp' ? 'chat' : channel === 'in_app' || channel === 'push' ? 'notifications' : 'email');
export const channelColor = (channel?: string) => (channel === 'whatsapp' ? PALETTE.greenDark : channel === 'in_app' ? PALETTE.textSoft : PALETTE.blueDark);

export function DeliveryBadge({ state }: { state: string }) {
  const meta = STATE_META[state] || STATE_META.queued;
  return <ConsoleChip label={meta.label} kind={meta.kind} />;
}

/* ---------------------------------------------------------------- resend */

/**
 * Resend, confirmed INLINE. It messages a real person, so the first press only
 * asks; the second sends. The server's sentence is shown as the result.
 */
export function ResendButton({ row, onDone, compact }: { row: DeliveryLogRow; onDone?: () => void; compact?: boolean }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  // Only confirmed failures get another attempt; the server rechecks eligibility.
  if (!row?._id || row?.channel === 'in_app' || !canResend(row) || stateOf(row) !== 'failed') return null;

  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const { row: next, message } = await resendNotification(row._id);
      Alert.alert(next ? (STATE_META[stateOf(next)]?.label || 'Resend result') : 'Resend result',
        notificationReason(message) || 'Refresh this message to check the result.');
      onDone?.();
    } catch (err: any) {
      Alert.alert('Could not resend that message', notificationReason(String(err?.response?.data?.message || (err?.response ? err?.message : 'Cannot reach the server. Check your internet connection.') || '')));
    } finally {
      sending.current = false;
      setBusy(false);
      setAsking(false);
    }
  };

  if (asking) {
    return (
      <View style={k.askRow}>
        <ConsoleButton size="sm" icon="replay" label="Confirm resend" loading={busy} onPress={send} style={k.askBtn} />
        <ConsoleButton size="sm" kind="soft" label="Cancel" disabled={busy} onPress={() => setAsking(false)} />
      </View>
    );
  }
  return (
    <ConsoleButton
      size="sm"
      kind="soft"
      icon="replay"
      label="Resend"
      style={compact ? undefined : k.fullBtn}
      accessibilityLabel={`Resend ${channelWord(row?.channel)} to ${row?.recipientName || row?.recipient || 'this person'}`}
      onPress={() => setAsking(true)}
    />
  );
}

/* ------------------------------------------------------------ row details */

function DetailField({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const v = value === null || value === undefined ? '' : String(value);
  if (!v) return null;
  return (
    <View style={k.field}>
      <Text style={k.fieldLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={[k.fieldValue, mono && k.mono]} selectable maxFontSizeMultiplier={1.3}>{v}</Text>
    </View>
  );
}

const providerWord = (p?: string) => (p === 'meta' ? 'WhatsApp (Meta)' : p === 'botbee' ? 'BotBee' : p === 'smtp' ? 'Email service' : String(p || ''));

/**
 * Everything known about one message: who, what, which template, the
 * provider's id, the delivery timeline and the full failure reason.
 */
export function DeliveryDetail({ row }: { row: DeliveryLogRow }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const state = stateOf(row);
  const reason = reasonOf(row);
  const history = Array.isArray(row?.statusHistory) ? row.statusHistory : [];
  return (
    <View>
      <Text style={k.hint} maxFontSizeMultiplier={1.3}>{row?.channel === 'in_app' && state === 'accepted' ? 'Saved in the account. This does not confirm it was seen.' : (STATE_META[state] || STATE_META.queued).hint}</Text>
      {row?.channel === 'email' ? (
        <Text style={k.hint} maxFontSizeMultiplier={1.3}>
          We cannot tell whether an email reached the inbox or was opened. Sent means it was passed to the email service.
        </Text>
      ) : null}
      {reason ? (
        <View style={k.reason}>
          <Icon name="warning-amber" size={16} color={PALETTE.redDark} style={k.reasonIcon} />
          <Text style={k.reasonText} selectable maxFontSizeMultiplier={1.3}>
            {row?.failureCode ? `${String(row.failureCode)} · ` : ''}{reason}
          </Text>
        </View>
      ) : null}

      <View style={k.fields}>
        <DetailField label="To" value={[row?.recipientName, row?.recipient].filter(Boolean).join(' · ')} />
        <DetailField label="Booking" value={row?.bookingRef} mono />
        <DetailField label="Event" value={row?.eventTitle} />
        <DetailField label="Subject / template" value={row?.subject || row?.templateId} />
        <DetailField label="Template used" value={notificationTemplatePath(row?.templatePath || row?.templateId)} />
        <DetailField label="Sending service" value={providerWord(row?.provider)} />
        <DetailField label="Service details" value={reason !== (row?.failureReason || row?.lastError || '') ? row?.failureReason || row?.lastError : ''} />
        <DetailField label="Message reference" value={row?.providerMessageId} mono />
        <DetailField label="First attempted" value={whenLabel(row?.createdAt)} />
        <DetailField label="Attempts" value={row?.attempts ? String(row.attempts) : ''} />
        <DetailField label="Resent as" value={row?.resentAs} mono />
        <DetailField label="Resend of" value={row?.resendOf} mono />
      </View>

      <Text style={k.timelineTitle} maxFontSizeMultiplier={1.3}>TIMELINE</Text>
      {history.length ? history.map((h, i) => {
        const st = String(h?.status || '');
        const dot = st === 'failed' ? PALETTE.red : st === 'read' || st === 'delivered' ? PALETTE.green : PALETTE.blue;
        const extra = [h?.code, h?.title, notificationReason(h?.detail)].filter(Boolean).join(' · ');
        return (
          <View key={`${st}-${h?.at}-${i}`} style={k.step}>
            <View style={[k.stepDot, { backgroundColor: dot }]} />
            <View style={k.flexText}>
              <Text style={k.stepLabel} maxFontSizeMultiplier={1.3}>
                {st === 'marked_read' ? 'Marked read' : (STATE_META[st] || { label: st || '—' }).label}
                <Text style={k.stepWhen}>  {whenLabel(h?.at)}</Text>
              </Text>
              {extra ? <Text style={k.stepExtra} maxFontSizeMultiplier={1.3}>{extra}</Text> : null}
            </View>
          </View>
        );
      }) : (
        <Text style={k.hint} maxFontSizeMultiplier={1.3}>
          No delivery reports recorded for this message yet{row?.channel === 'whatsapp' ? ' — WhatsApp has not sent a status update yet.' : '.'}
        </Text>
      )}
    </View>
  );
}

/* ----------------------------------------------- per-booking chips + hook */

function ChannelChip({ channel, summary }: { channel: 'email' | 'whatsapp'; summary?: ChannelSummary }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const meta = summary ? STATE_META[String(summary?.status || '')] : undefined;
  return (
    <View style={k.chanChip}>
      <Icon name={channelIcon(channel)} size={13} color={channelColor(channel)} />
      {meta ? <ConsoleChip label={meta.label} kind={meta.kind} /> : <Text style={k.none} maxFontSizeMultiplier={1.2}>—</Text>}
    </View>
  );
}

/** The Messages cell: the latest email and WhatsApp state of one booking, as one button. */
export function DeliveryChips({ summary, loading, onOpen }: {
  summary?: BookingDeliverySummary | null; loading?: boolean; onOpen: () => void;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const label = `Messages: email ${summary?.email ? (STATE_META[String(summary.email.status)]?.label || summary.email.status) : 'none'}, WhatsApp ${summary?.whatsapp ? (STATE_META[String(summary.whatsapp.status)]?.label || summary.whatsapp.status) : 'none'}`;
  return (
    <TouchableOpacity onPress={onOpen} style={k.chips} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <Text style={k.chipsLabel} maxFontSizeMultiplier={1.2}>Messages</Text>
      {loading ? <ActivityIndicator size="small" color={PALETTE.textFaint} /> : (
        <>
          <ChannelChip channel="email" summary={summary?.email} />
          <ChannelChip channel="whatsapp" summary={summary?.whatsapp} />
        </>
      )}
      <Icon name="chevron-right" size={18} color={PALETTE.textFaint} />
    </TouchableOpacity>
  );
}

/**
 * The latest email / WhatsApp state for every booking reference on screen, in
 * ONE request (the website's Messages column). A failure only blanks the chips.
 * `nonce` re-asks — bump it a few seconds after a write, because the
 * confirmation goes out in the background.
 */
export function useDeliverySummaries(refs: string[], nonce = 0) {
  const key = (refs || []).map((r) => String(r || '').trim()).filter(Boolean).join(',');
  const [map, setMap] = useState<Record<string, BookingDeliverySummary>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!key) { setMap({}); return undefined; }
    let alive = true;
    setLoading(true);
    getDeliverySummaries(key.split(','))
      .then((m) => { if (alive) setMap(m || {}); })
      .catch(() => { if (alive) setMap({}); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [key, nonce]);
  return { map, loading };
}

/** A nonce plus a "look again in 4 s" bump, for after a payment or a cancellation. */
export function useDelayedNonce() {
  const [nonce, setNonce] = useState(0);
  const bumpSoon = useCallback(() => { setTimeout(() => setNonce((n) => n + 1), 4000); }, []);
  const bump = useCallback(() => setNonce((n) => n + 1), []);
  return { nonce, bump, bumpSoon };
}

const k = StyleSheet.create({
  flexText: { flex: 1, minWidth: 0 },
  askRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  askBtn: { flexGrow: 1 },
  fullBtn: { alignSelf: 'flex-start' },
  hint: { ...TYPE.caption, lineHeight: 18, marginBottom: SPACE.xs },
  reason: { flexDirection: 'row', gap: SPACE.sm, backgroundColor: PALETTE.redSoft, borderRadius: 12, padding: SPACE.md, marginTop: SPACE.sm },
  reasonIcon: { marginTop: 1 },
  reasonText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19, color: PALETTE.redDark, fontWeight: '600' },
  fields: { marginTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  field: { paddingVertical: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: PALETTE.textFaint, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, lineHeight: 20, color: PALETTE.text, marginTop: 2 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  timelineTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: PALETTE.textMuted, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  step: { flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.sm },
  stepDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: PALETTE.text },
  stepWhen: { fontSize: 12, fontWeight: '400', color: PALETTE.textMuted },
  stepExtra: { fontSize: 12, lineHeight: 17, color: PALETTE.textSoft, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.xs + 2, minHeight: 36 },
  chipsLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.textMuted, textTransform: 'uppercase' },
  chanChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  none: { fontSize: 12, color: PALETTE.textFaint, fontWeight: '700' },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_k = k;
const legacyAppearance_PALETTE = PALETTE;

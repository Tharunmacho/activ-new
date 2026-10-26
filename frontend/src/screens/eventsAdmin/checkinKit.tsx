import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, RADIUS,
  ConsoleButton, ConsoleCard, ConsoleChip, FadeInUp,
} from '../../ui';
import type { CheckinSeat } from '../../services/eventCheckinApi';

/**
 * The pieces the events-admin screens share: the scan RESULT CARD (rendered
 * inline under the scanner — never a native Modal, CLAUDE.md Rule 2) and a
 * date label in IST.
 */

const TZ = 'Asia/Kolkata';

/** "Sat, 10 Oct 2026 · 10:00 am" in IST, or "Date to be confirmed". */
export const eventWhen = (iso?: string | null): string => {
  if (!iso) return 'Date to be confirmed';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Date to be confirmed';
    const day = d.toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day} · ${time}`;
  } catch {
    return 'Date to be confirmed';
  }
};

type Verdict = 'admitted' | 'already' | 'refused' | 'valid';

/** What the card says first — the answer staff act on, in one word and a colour. */
export const verdictOf = (seat: CheckinSeat | null, outcome: 'admitted' | 'already_checked_in' | null): Verdict => {
  if (outcome === 'admitted') return 'admitted';
  if (seat?.checkedIn || outcome === 'already_checked_in') return 'already';
  if (!seat?.admissible) return 'refused';
  return 'valid';
};

const BANNER: Record<Verdict, { icon: string; title: string; fg: string; bg: string }> = {
  admitted: { icon: 'check-circle', title: 'Entry allowed', fg: PALETTE.greenDark, bg: PALETTE.greenSoft },
  already: { icon: 'history', title: 'Already checked in', fg: PALETTE.amberDark, bg: PALETTE.amberSoft },
  refused: { icon: 'block', title: 'Do not admit', fg: PALETTE.redDark, bg: PALETTE.redSoft },
  valid: { icon: 'verified', title: 'Valid pass', fg: PALETTE.indigoDark, bg: PALETTE.indigoSoft },
};

function Fact({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const text = String(value ?? '').trim();
  if (!text) return null;
  return (
    <View style={s.fact}>
      <Text style={s.factLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={[s.factValue, mono && s.mono]} selectable maxFontSizeMultiplier={1.3}>{text}</Text>
    </View>
  );
}

/**
 * One scanned seat: the verdict banner, the name to check against the ID, the
 * registration details, and the one action that matters. "Allow entry" is only
 * offered for a valid seat nobody has let in yet.
 */
export function SeatResultCard({
  seat, outcome, busy, error, onAdmit, onNext, nextLabel = 'Scan next',
}: {
  seat: CheckinSeat | null;
  outcome: 'admitted' | 'already_checked_in' | null;
  busy?: boolean;
  error?: string;
  onAdmit?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  if (!seat) return null;
  const verdict = verdictOf(seat, outcome);
  const b = BANNER[verdict];
  const who = seat?.checkin?.admittedBy?.name || seat?.checkin?.admittedBy?.email || 'events staff';
  const at = seat?.checkin?.admittedAtLabel || '';
  const canAdmit = verdict === 'valid' && !!onAdmit;
  const ticket = [seat?.ticket?.category, seat?.ticket?.label].filter(Boolean).join(' · ');

  return (
    <FadeInUp distance={12}>
      <ConsoleCard padded={false} accent={b.fg}>
        <View style={[s.banner, { backgroundColor: b.bg }]} accessibilityLiveRegion="polite">
          <Icon name={b.icon} size={30} color={b.fg} />
          <View style={s.flexText}>
            <Text style={[s.bannerTitle, { color: b.fg }]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{b.title}</Text>
            {verdict === 'already' || verdict === 'admitted' ? (
              <Text style={[s.bannerSub, { color: b.fg }]} maxFontSizeMultiplier={1.3}>
                {at ? `${verdict === 'admitted' ? 'Checked in' : 'At'} ${at}` : 'Checked in'}{verdict === 'already' ? ` by ${who}` : ''}
              </Text>
            ) : verdict === 'refused' ? (
              <Text style={[s.bannerSub, { color: b.fg }]} maxFontSizeMultiplier={1.3}>
                {seat?.reason?.message || 'This pass cannot be used for entry.'}
              </Text>
            ) : (
              <Text style={[s.bannerSub, { color: b.fg }]} maxFontSizeMultiplier={1.3}>
                Check that the photo ID matches this name.
              </Text>
            )}
          </View>
        </View>

        <View style={s.body}>
          <Text style={s.name} numberOfLines={2} maxFontSizeMultiplier={1.25}>{seat?.attendee?.name || 'Attendee'}</Text>
          <View style={s.chips}>
            <ConsoleChip
              label={`Participant ${Number(seat?.participantNumber || 1)} of ${Number(seat?.seats || 1)}`}
              kind="info"
              icon="person"
            />
            <ConsoleChip
              label={seat?.payment?.label || 'Payment'}
              kind={seat?.payment?.status === 'paid' || seat?.payment?.status === 'not_required' ? 'approved' : 'rejected'}
            />
            {seat?.attendee?.phoneMasked ? <ConsoleChip label={seat.attendee.phoneMasked} kind="neutral" icon="phone" /> : null}
          </View>

          {!seat?.eventIsToday && verdict !== 'refused' ? (
            <View style={s.warn}>
              <Icon name="event-busy" size={16} color={PALETTE.amberDark} />
              <Text style={s.warnText} maxFontSizeMultiplier={1.3}>This event is not scheduled for today.</Text>
            </View>
          ) : null}

          <Fact label="Event" value={seat?.event?.title} />
          <Fact label="When" value={eventWhen(seat?.event?.startAt)} />
          <Fact label="Ticket" value={ticket} />
          <Fact label="Registration no." value={seat?.registrationNo} mono />
          <Fact label="Booking ID" value={seat?.bookingRef} mono />
          <Fact label="Booked by" value={seat?.bookedBy?.name} />

          {error ? (
            <View style={[s.warn, s.err]}>
              <Icon name="error-outline" size={16} color={PALETTE.redDark} />
              <Text style={[s.warnText, { color: PALETTE.redDark }]} maxFontSizeMultiplier={1.3}>{error}</Text>
            </View>
          ) : null}

          <View style={s.actions}>
            {canAdmit ? (
              <ConsoleButton kind="approve" icon="how-to-reg" label="Allow entry" onPress={onAdmit} loading={busy} />
            ) : null}
            {onNext ? (
              <ConsoleButton kind={canAdmit ? 'ghost' : 'primary'} icon="qr-code-scanner" label={nextLabel} onPress={onNext} disabled={busy} />
            ) : null}
          </View>
        </View>
      </ConsoleCard>
    </FadeInUp>
  );
}

const s = StyleSheet.create({
  flexText: { flex: 1, minWidth: 0 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
    borderTopRightRadius: RADIUS.lg,
  },
  bannerTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  bannerSub: { ...TYPE.label, marginTop: 2 },
  body: { padding: SPACE.lg, gap: SPACE.sm },
  name: { ...TYPE.title, fontSize: 22, lineHeight: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.xs },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: 2 },
  factLabel: { ...TYPE.caption, width: 112 },
  factValue: { ...TYPE.bodyStrong, flex: 1, minWidth: 0 },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
  warn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: PALETTE.amberSoft, borderRadius: RADIUS.md, padding: SPACE.sm,
  },
  err: { backgroundColor: PALETTE.redSoft },
  warnText: { ...TYPE.label, color: PALETTE.amberDark, flex: 1, minWidth: 0 },
  actions: { gap: SPACE.sm, marginTop: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;

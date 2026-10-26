import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React from 'react';
import { View, Text, StyleSheet, Switch, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, SIZE, shortDate,
  ConsoleCard, ConsoleChip, ConsolePill, CoverageRing, GradientAvatar, FadeInUp, ConsoleChipKind,
} from '../../../ui';
import { resolveMediaUrl } from '../../../config/api.config';

/**
 * ============================================================================
 * ONE MEMBER — the premium row shared by the tier Members tab and the Super
 * Admin's Members screen (website AdminMemberList).
 * ============================================================================
 *
 * Collapsed: gradient avatar, name, Member ID, the state chip and kind, the
 * validity line, and an EXPIRY RING — days left of the paid year, green while
 * in date, amber inside 30 days, red once lapsed, ∞ for life.
 * Expanded (tap): contact, region, plan, the reminders switch and the actions.
 *
 * Presentational only: every action is a callback the screen already owns,
 * and each one appears only when the screen says this admin may use it.
 */

export interface MemberLike {
  id: string;
  applicationId: string;
  applicationRef?: string;
  name: string;
  email: string;
  phone: string;
  photo: string;
  block: string;
  district: string;
  state: string;
  memberNumber: string;
  kind: string;
  kindLabel: string;
  platinum: boolean;
  lifetime: boolean;
  planName: string;
  expiresAt: string | null;
  daysLeft: number | null;
  status: 'active' | 'expired' | 'awaiting_payment';
  expiringSoon: boolean;
  blocked: boolean;
  reminders: boolean;
  lastReminderAt: string | null;
}

const daysLeftOf = (m: MemberLike): number | null => {
  if (typeof m?.daysLeft === 'number') return m.daysLeft;
  if (!m?.expiresAt) return null;
  const t = new Date(m.expiresAt).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
};

export function memberStateChip(m: MemberLike): { label: string; kind: ConsoleChipKind } {
  if (m?.status === 'expired') return { label: 'Expired', kind: 'rejected' };
  if (m?.status === 'awaiting_payment') return { label: 'Awaiting payment', kind: 'neutral' };
  if (m?.expiringSoon) {
    const d = daysLeftOf(m);
    return { label: d !== null && d <= 0 ? 'Expires today' : d !== null ? `Expires in ${d} day${d === 1 ? '' : 's'}` : 'Expiring', kind: 'pending' };
  }
  return { label: 'Active', kind: 'approved' };
}

/** Days left of the paid year, as a ring. */
function ExpiryRing({ m }: { m: MemberLike }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  if (m?.status === 'awaiting_payment') {
    return (
      <View style={s.ringBox} accessible accessibilityLabel="Awaiting payment">
        <View style={s.payDue}><Icon name="hourglass-top" size={20} color={PALETTE.textMuted} /></View>
        <Text style={s.ringCaption}>unpaid</Text>
      </View>
    );
  }
  if (m?.lifetime) {
    return <CoverageRing progress={1} size={54} stroke={5} accent="indigo" center="∞" caption="life" />;
  }
  const d = daysLeftOf(m);
  if (m?.status === 'expired') {
    return <CoverageRing progress={0} size={54} stroke={5} accent="red" center="0" caption="lapsed" />;
  }
  if (d === null) return <CoverageRing progress={0} size={54} stroke={5} accent="slate" center="—" caption="no end" />;
  const accent = m?.expiringSoon || d <= 30 ? 'amber' : 'green';
  return <CoverageRing progress={Math.min(1, Math.max(0, d / 365))} size={54} stroke={5} accent={accent} center={d > 999 ? '999+' : String(Math.max(0, d))} caption="days" />;
}

function Line({ icon, text }: { icon: string; text?: string }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={s.detail}>
      <View style={s.detailIcon}><Icon name={icon} size={15} color={PALETTE.indigo} /></View>
      <Text style={s.detailText} selectable numberOfLines={2}>{text || '—'}</Text>
    </View>
  );
}

export default function PremiumMemberCard({
  m, open, onToggle, canManage, canReminders, busy, onReminders, onRemindNow, onBlock, onDelete, onView, delay = 0,
}: {
  m: MemberLike;
  open: boolean;
  onToggle: () => void;
  /** Block / Unblock / Delete (State and Super only). */
  canManage: boolean;
  /** The reminders switch and "Remind now" (State and Super, when the server allows). */
  canReminders: boolean;
  busy: boolean;
  onReminders: (m: any, v: boolean) => void;
  onRemindNow: (m: any) => void;
  onBlock: (m: any) => void;
  onDelete: (m: any) => void;
  onView: (m: any) => void;
  delay?: number;
}) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const remindable = m?.status === 'expired' || (m?.status === 'active' && !!m?.expiringSoon);
  const lapsed = m?.status === 'expired';
  const photo = m?.photo ? resolveMediaUrl(m.photo) : '';
  const place = [m?.block, m?.district, m?.state].filter(Boolean).join(', ');
  const chip = memberStateChip(m);
  const stripe = lapsed ? PALETTE.red : m?.status === 'awaiting_payment' ? PALETTE.borderStrong : m?.expiringSoon ? PALETTE.amber : PALETTE.green;
  const validity = m?.status === 'awaiting_payment'
    ? 'Approved — payment not made yet'
    : m?.lifetime ? 'Valid for life'
      : m?.expiresAt ? `${lapsed ? 'Expired' : 'Valid until'} ${shortDate(m.expiresAt)}` : 'No end date recorded';
  const kindKind: ConsoleChipKind = m?.kind === 'aspirant' ? 'gold' : m?.kind === 'student' ? 'approved' : 'info';

  return (
    <FadeInUp delay={delay} style={s.wrap}>
      <ConsoleCard padded={false} accent={stripe}>
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.85}
          style={s.head}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${m?.name || 'Member'}, ${chip.label}`}
        >
          <GradientAvatar
            name={m?.name}
            uri={photo}
            size={50}
            tone="admin"
            status={m?.status === 'active' ? 'verified' : m?.status === 'awaiting_payment' ? 'pending' : undefined}
          />
          <View style={s.text}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>{m?.name || 'Unnamed member'}</Text>
              {m?.blocked ? <ConsoleChip label="Blocked" kind="dark" icon="block" /> : null}
            </View>
            <Text style={s.sub} numberOfLines={1}>{m?.memberNumber || m?.applicationRef || '—'}</Text>
            <View style={s.chips}>
              <ConsoleChip label={chip.label} kind={chip.kind} />
              {m?.platinum ? <ConsoleChip label="Lifetime" kind="dark" icon="workspace-premium" /> : (m?.kindLabel || m?.kind) ? <ConsoleChip label={m?.kindLabel || m?.kind} kind={kindKind} dot={false} /> : null}
            </View>
            <Text style={[s.validity, lapsed && { color: PALETTE.dangerText }]} numberOfLines={1}>{validity}</Text>
          </View>
          <View style={s.side}>
            <ExpiryRing m={m} />
            <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={PALETTE.textFaint} />
          </View>
        </TouchableOpacity>

        {open ? (
          <View style={s.body}>
            <Line icon="mail-outline" text={m?.email} />
            <Line icon="phone" text={m?.phone} />
            <Line icon="place" text={place} />
            {m?.planName ? <Line icon="workspace-premium" text={m.planName} /> : null}

            {canReminders && m?.status !== 'awaiting_payment' && !m?.lifetime ? (
              <View style={s.reminder}>
                <Icon name={m?.reminders ? 'notifications-active' : 'notifications-off'} size={20} color={m?.reminders ? PALETTE.indigo : PALETTE.textFaint} />
                <View style={s.text}>
                  <Text style={s.reminderTitle}>Renewal reminders</Text>
                  <Text style={s.reminderHint}>
                    {m?.reminders ? 'On — reminded on the 1st and 15th once expired' : 'Off — no renewal reminders'}
                    {m?.lastReminderAt ? ` · last sent ${shortDate(m.lastReminderAt)}` : ''}
                  </Text>
                </View>
                <Switch
                  value={!!m?.reminders}
                  disabled={busy}
                  onValueChange={(v) => onReminders(m, v)}
                  trackColor={{ false: PALETTE.borderStrong, true: PALETTE.indigo }}
                  thumbColor={Platform.OS === 'android' ? PALETTE.white : undefined}
                  ios_backgroundColor={PALETTE.borderStrong}
                  accessibilityLabel="Renewal reminders"
                />
              </View>
            ) : null}

            <View style={s.actions}>
              <ConsolePill icon="visibility" label="View application" onPress={() => onView(m)} disabled={busy || !m?.applicationId} />
              {canReminders && remindable ? <ConsolePill icon="send" label="Remind now" onPress={() => onRemindNow(m)} disabled={busy} /> : null}
              {canManage ? (
                <ConsolePill
                  icon={m?.blocked ? 'how-to-reg' : 'person-off'}
                  label={m?.blocked ? 'Unblock' : 'Block'}
                  color={m?.blocked ? PALETTE.green : PALETTE.amberDark}
                  onPress={() => onBlock(m)}
                  disabled={busy || !m?.applicationId}
                />
              ) : null}
              {canManage ? <ConsolePill icon="delete-outline" label="Delete" color={PALETTE.red} onPress={() => onDelete(m)} disabled={busy || !m?.applicationId} /> : null}
            </View>
            {busy ? <ActivityIndicator color={PALETTE.indigo} style={s.busy} /> : null}
          </View>
        ) : null}
      </ConsoleCard>
    </FadeInUp>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, minHeight: SIZE.row + SPACE.lg },
  text: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm - 2 },
  name: { ...TYPE.subheading, fontWeight: '800', flexShrink: 1 },
  sub: { ...TYPE.caption, fontWeight: '700', color: PALETTE.indigo, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.sm - 2 },
  validity: { ...TYPE.caption, fontSize: 11, marginTop: SPACE.sm - 2 },
  side: { alignItems: 'center', gap: 2 },
  ringBox: { width: 54, alignItems: 'center' },
  payDue: { width: 44, height: 44, borderRadius: 22, backgroundColor: PALETTE.divider, alignItems: 'center', justifyContent: 'center' },
  ringCaption: { fontSize: 9, lineHeight: 11, fontWeight: '700', color: PALETTE.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider, paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm, paddingBottom: SPACE.lg, backgroundColor: PALETTE.indigoTint,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  detail: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md - 2, paddingVertical: SPACE.xs + 1 },
  detailIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: PALETTE.white, alignItems: 'center', justifyContent: 'center' },
  detailText: { flex: 1, minWidth: 0, ...TYPE.label },
  reminder: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.sm, padding: SPACE.md,
    borderRadius: 16, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border,
  },
  reminderTitle: { ...TYPE.bodyStrong },
  reminderHint: { ...TYPE.caption, marginTop: SPACE.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  busy: { marginTop: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;

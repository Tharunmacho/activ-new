import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, SPACE, RADIUS, SIZE, TYPE, GRADIENTS, FadeInUp } from '../../../ui';
import { GradientPanel, OnGradientButton, onGradient } from './DashboardKit';

/**
 * The website's RenewalBanner: drawn ONLY when the server says the member can
 * renew (`renewal.canRenew`) — never a Renew button the order would refuse.
 * Headline, the website's `renewalMessage`, the button ("Renew membership" /
 * "Renew now") and "Ends/Ended <date>".
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const renewalDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const renewalMessage = (r: any): string => {
  if (!r) return '';
  const on = renewalDate(r.expiresAt);
  if (r.state === 'expired') {
    return on
      ? `Your membership ended on ${on}. Renew now to restore every member benefit.`
      : 'Your membership has ended. Renew now to restore every member benefit.';
  }
  if (r.canRenew && r.daysLeft !== null && r.daysLeft !== undefined) {
    const days = Math.max(0, Number(r.daysLeft));
    return `Your membership ends ${days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`}${on ? ` (${on})` : ''}. `
      + 'Renew now — the new year starts when this one ends, so you lose nothing.';
  }
  return '';
};

export default function RenewalBanner({ renewal, onRenew }: { renewal: any; onRenew: () => void }) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  if (!renewal || !renewal.canRenew) return null;
  const expired = renewal.state === 'expired';
  const days = renewal.daysLeft !== null && renewal.daysLeft !== undefined ? Math.max(0, Number(renewal.daysLeft)) : null;
  const title = expired
    ? 'Renew your membership'
    : days === 0 ? 'Your membership ends today' : `${days} ${days === 1 ? 'day' : 'days'} left on your membership`;
  const message = renewalMessage(renewal);
  const ends = renewalDate(renewal.expiresAt);
  // Expired reads as a warning (amber accents on navy); open renewal as the brand gradient.
  const accentFg = expired ? PALETTE.text : PALETTE.blueDark;
  return (
    <FadeInUp delay={120}>
    <GradientPanel
      colors={expired ? [PALETTE.blueDeep, PALETTE.blueDark] : GRADIENTS.member}
      padding={SPACE.lg}
      style={styles.wrap}
    >
      <View style={styles.row}>
        <View style={[styles.icon, expired && { backgroundColor: PALETTE.amber, borderColor: PALETTE.amber }]}>
          <Icon name={expired ? 'warning-amber' : 'event-repeat'} size={22} color={expired ? PALETTE.text : PALETTE.white} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={onGradient.eyebrow} numberOfLines={1}>{expired ? 'Membership expired' : 'Renewal open'}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      {message ? <Text style={[onGradient.body, { marginTop: SPACE.md }]}>{message}</Text> : null}
      <OnGradientButton
        label={expired ? 'Renew membership' : 'Renew now'}
        icon="autorenew"
        onPress={onRenew}
        color={accentFg}
        bg={expired ? PALETTE.amber : PALETTE.white}
        style={{ marginTop: SPACE.lg }}
      />
      {ends ? <Text style={[onGradient.caption, styles.ends]}>{expired ? 'Ended' : 'Ends'} {ends}</Text> : null}
    </GradientPanel>
    </FadeInUp>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACE.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  icon: { width: SIZE.touch, height: SIZE.touch, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPE.heading, fontSize: 17, lineHeight: 23, color: PALETTE.white, marginTop: SPACE.xxs },
  ends: { textAlign: 'center', marginTop: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_styles = styles;

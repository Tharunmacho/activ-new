import { useAppTheme, useThemeStyles } from '../../ui/AppTheme';
import type { AppTheme } from '../../ui/AppTheme';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Badge, SPACE, SIZE, GradientButton, LiftCard, VaultLock3D, FadeInUp } from '../../ui';
import { getMyProfile } from '../../services/memberApi';
import { isPaidProfile } from '../../services/session';

/**
 * THE BUSINESS AREA'S MEMBERSHIP GATE — the website's `getPaymentStatus()`
 * check on Discover, Analytics and Trust List.
 *
 * Paid = GET /members/my-profile says `membershipStatus` active/completed AND
 * `renewal.state` is not expired (`isPaidProfile`, the same rule as the
 * website). `null` while unknown; a failed read counts as UNPAID — showing a
 * paid-only listing to somebody who has not paid is the worse mistake.
 *
 * Re-read on every focus, so a member who pays and comes back is let in.
 */
export function useMembershipPaid(): boolean | null {
  const [paid, setPaid] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMyProfile()
        .then((profile) => { if (alive) setPaid(isPaidProfile(profile)); })
        .catch(() => { if (alive) setPaid(false); });
      return () => { alive = false; };
    }, []),
  );
  return paid;
}

export interface LockedPerk { icon: string; title: string; detail: string }

/**
 * What an unpaid member sees in place of a paid feature: original "vault"
 * art in a violet medallion, what is being kept (the reasons to join) and one
 * button. Like the website, the button goes to the member's own dashboard,
 * which knows whether their application is approved and offers payment only
 * once it is.
 */
export function MembershipLocked({ icon = 'lock-outline', title, message, perks = [], onJoin, footnote, style }: {
  icon?: string; title: string; message: string; perks?: LockedPerk[]; onJoin: () => void; footnote?: string; style?: ViewStyle;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  return (
    <FadeInUp distance={14} style={[s.wrap, style]}>
      <LiftCard tone="business" style={s.card}>
        <LinearGradient colors={p.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.medal, { shadowColor: p.shadow }]}>
          <View style={s.medalRing} />
          <VaultLock3D tone="business" size={96} />
          <View style={s.medalIcon}><Icon name={icon} size={14} color={p.accentDark} /></View>
        </LinearGradient>
        <Badge label="Members only" icon="workspace-premium" color={PALETTE.amberDark} bg={PALETTE.amberSoft} size="sm" style={s.pill} />
        <Text style={s.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={s.message} maxFontSizeMultiplier={1.3}>{message}</Text>
        {(perks || []).length > 0 ? (
          <View style={s.perks}>
            {(perks || []).map((perk) => (
              <View key={perk.title} style={s.perk}>
                <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perkIcon}>
                  <Icon name={perk.icon} size={SIZE.icon} color={PALETTE.white} />
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.perkTitle} maxFontSizeMultiplier={1.3}>{perk.title}</Text>
                  <Text style={s.perkDetail} maxFontSizeMultiplier={1.3}>{perk.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <GradientButton tone="business" label="Become a member" icon="workspace-premium" onPress={onJoin} style={s.cta} />
        {footnote ? <Text style={s.footnote} maxFontSizeMultiplier={1.3}>{footnote}</Text> : null}
      </LiftCard>
    </FadeInUp>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  wrap: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  card: { alignItems: 'center', padding: SPACE.xl },
  medal: {
    width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg,
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 8,
  },
  medalRing: { position: 'absolute', width: 118, height: 118, borderRadius: 59, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  medalIcon: { position: 'absolute', right: 6, bottom: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: PALETTE.card, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'center', marginBottom: SPACE.sm },
  title: { ...TYPE.title, textAlign: 'center' },
  message: { ...TYPE.body, textAlign: 'center', marginTop: SPACE.sm, maxWidth: 320 },
  perks: { alignSelf: 'stretch', marginTop: SPACE.xl, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.divider, gap: SPACE.lg },
  perk: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  perkIcon: { width: SIZE.iconChip, height: SIZE.iconChip, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { ...TYPE.bodyStrong },
  perkDetail: { ...TYPE.small, marginTop: SPACE.xxs },
  cta: { marginTop: SPACE.xl, alignSelf: 'stretch' },
  footnote: { ...TYPE.small, textAlign: 'center', marginTop: SPACE.md },
});

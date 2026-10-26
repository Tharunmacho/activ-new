import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  PremiumCard, GradientIconChip, GradientButton, FloatingIllustration, FadeInUp, LockedFeature3D,
} from '../../ui';

/**
 * A paid-only surface shown to an unpaid member — the website's
 * `PlanLockedCard` / `MembershipGate`: what it is, why it is shut, and the ONE
 * next step (`membershipCta`), optionally with what the membership covers.
 *
 * Premium: a floating padlock-and-star (original art, carries its own navy
 * disc so it reads on the white card), a gold "Members only" pill, benefits
 * with gradient chips (green "Open now" for what is already available) and a
 * gradient CTA. Same props as before — the screens using it are unchanged.
 */
export interface GateBenefitItem { icon: string; title: string; detail: string; open?: boolean }

export default function MemberLocked({
  feature, title, detail, action, actionDetail, onActivate, benefits,
}: {
  feature?: string;
  title?: string;
  detail?: string;
  action?: string;
  actionDetail?: string;
  onActivate: () => void;
  benefits?: GateBenefitItem[];
}) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const list = Array.isArray(benefits) ? benefits : [];
  return (
    <View style={styles.wrap}>
      <FadeInUp>
        <PremiumCard>
          <View style={styles.head}>
            <FadeInUp delay={80} scaleFrom={0.8} distance={6}>
              <FloatingIllustration size={104} halo={false} amplitude={5}>
                <LockedFeature3D size={104} />
              </FloatingIllustration>
            </FadeInUp>
            <LinearGradient colors={['#8A6A12', '#E7C766']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pill}>
              <Icon name="workspace-premium" size={13} color={PALETTE.white} />
              <Text style={styles.pillText} maxFontSizeMultiplier={1.2}>MEMBERS ONLY</Text>
            </LinearGradient>
            <Text style={styles.title} accessibilityRole="header">{title || `${feature || 'This'} is for active members`}</Text>
            <Text style={styles.detail}>{detail || 'Complete your membership to unlock it. It opens the moment your payment goes through.'}</Text>
          </View>
          {list.length ? (
            <View style={styles.benefits}>
              <Text style={styles.benefitsHead}>What your membership covers</Text>
              {list.map((b, i) => (
                <FadeInUp key={`${b?.title || ''}-${i}`} delay={140 + i * 50} distance={8} style={styles.benefit}>
                  <GradientIconChip icon={b?.open ? 'lock-open' : (b?.icon || 'check')} tone={b?.open ? 'green' : 'blue'} size={34} />
                  <View style={styles.bText}>
                    <View style={styles.bTitleRow}>
                      <Text style={styles.bTitle}>{b?.title || ''}</Text>
                      {b?.open ? <View style={styles.open}><Text style={styles.openText}>Open now</Text></View> : null}
                    </View>
                    <Text style={styles.bDetail}>{b?.detail || ''}</Text>
                  </View>
                </FadeInUp>
              ))}
            </View>
          ) : null}
          {actionDetail ? <Text style={[styles.detail, styles.actionDetail]}>{actionDetail}</Text> : null}
          <GradientButton label={action || 'Activate membership'} iconRight="arrow-forward" onPress={onActivate} style={{ marginTop: SPACE.lg }} />
        </PremiumCard>
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  head: { alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: SPACE.md, minHeight: 26,
    marginTop: SPACE.sm,
  },
  pillText: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', letterSpacing: 1, color: PALETTE.white },
  title: { ...TYPE.title, textAlign: 'center', marginTop: SPACE.md },
  detail: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.sm },
  actionDetail: { marginTop: SPACE.lg },
  benefits: { marginTop: SPACE.xl, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.divider, gap: SPACE.md },
  benefitsHead: { ...TYPE.eyebrow },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  bText: { flex: 1, minWidth: 0 },
  bTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm },
  bTitle: { ...TYPE.bodyStrong, flexShrink: 1 },
  bDetail: { ...TYPE.caption, fontWeight: '400', lineHeight: 17, marginTop: SPACE.xxs },
  open: { backgroundColor: PALETTE.successSoft, borderRadius: 999, paddingHorizontal: SPACE.sm, paddingVertical: 1 },
  openText: { fontSize: 10.5, fontWeight: '800', color: PALETTE.successText },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;

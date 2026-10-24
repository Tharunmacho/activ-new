import React from 'react';
import { Animated, Image, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, SPACE } from '../tokens';
import { BRAND } from './theme';
import { useLoop } from './motion';
import { GradientAvatar } from './controls';

/**
 * ============================================================================
 * MEMBERSHIP PASS — the member's card, drawn like a real one
 * ============================================================================
 *
 *   <MembershipPassCard name memberId planName validLabel status photoUri platinum />
 *
 * A navy→blue (or lifetime gold) card with a gold hairline, a gold chip, the
 * ACTIV mark on a white pill, the member's photo in a gradient ring, and a
 * holographic sheen that sweeps across it (native driver; off under reduce
 * motion). Everything printed on it is passed in — nothing is invented: an
 * unrecorded Member ID prints as a dash.
 */

const LOGO = require('../../assets/images/activlogo.png');

export function MembershipPassCard({
  name, memberId, planName, validLabel, validValue, status, photoUri, platinum, style,
}: {
  name: string;
  memberId?: string | null;
  planName?: string;
  /** "Valid till" / "Renewal". */
  validLabel?: string;
  validValue?: string;
  status?: string;
  photoUri?: string | null;
  platinum?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const cardW = Math.max(280, Math.min(Number(width || 360) - SPACE.lg * 2, 520));
  const sweep = useLoop({ duration: 5200, delay: 600 });
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-cardW, cardW * 1.4] });
  const colors = platinum ? ['#c8a04a', '#e9cb80', '#f8e6b2', '#e7c776', '#ccaa58'] : [BRAND.navyDeep, BRAND.navy, BRAND.blue900, BRAND.blue];
  const goldInk = platinum ? { color: '#3e2c0e' } : undefined;
  const goldMuted = platinum ? { color: '#674c1b' } : undefined;
  const statusText = String(status || '').trim();
  const active = statusText.toLowerCase() === 'active';
  return (
    <View style={[s.shadow, platinum && { backgroundColor: '#ccaa58', shadowColor: '#795617' }, style]} accessible accessibilityLabel={`${planName || 'Membership'} card for ${name}. Member ID ${memberId || 'not recorded'}.${validValue ? ` ${validLabel || 'Valid till'} ${validValue}.` : ''}`}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <View pointerEvents="none" style={s.orbA} />
        <View pointerEvents="none" style={[s.orbB, platinum && { backgroundColor: '#fff3cd33' }]} />
        <Animated.View pointerEvents="none" style={[s.sheen, { transform: [{ translateX }, { rotate: '18deg' }] }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={s.top}>
          <View style={s.logoPill}>
            <Image source={LOGO} style={s.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
          </View>
          <View style={s.tierPill}>
            <Icon name="workspace-premium" size={13} color={platinum ? '#674c1b' : '#FDE68A'} />
            <Text style={[s.tierText, goldInk]} numberOfLines={1} maxFontSizeMultiplier={1.15}>{platinum ? 'LIFETIME' : 'MEMBER'}</Text>
          </View>
        </View>

        <View style={s.mid}>
          <LinearGradient colors={['#FEF3C7', '#FBBF24', '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.chip}>
            <View style={s.chipLineH} />
            <View style={s.chipLineV} />
          </LinearGradient>
          <View style={s.flexMin}>
            <Text style={[s.plan, goldInk]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{platinum ? 'Lifetime Membership' : planName || 'ACTIV Membership'}</Text>
            {statusText ? (
              <View style={s.statusRow}>
                <View style={[s.statusDot, { backgroundColor: active ? (platinum ? '#25704c' : '#34D399') : '#966015' }]} />
                <Text style={[s.statusText, goldMuted]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{statusText.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.bottom}>
          <GradientAvatar name={name} uri={photoUri || undefined} size={48} status={active ? 'verified' : undefined} />
          <View style={s.flexMin}>
            <Text style={[s.name, goldInk]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{name || 'Member'}</Text>
            <Text style={[s.idLabel, goldMuted]} maxFontSizeMultiplier={1.2}>MEMBER ID</Text>
            <Text style={[s.id, goldInk]} numberOfLines={2} selectable maxFontSizeMultiplier={1.2}>{memberId || '—'}</Text>
          </View>
          {validValue ? (
            <View style={s.valid}>
              <Text style={[s.idLabel, goldMuted]} maxFontSizeMultiplier={1.2}>{String(validLabel || 'Valid till').toUpperCase()}</Text>
              <Text style={[s.validValue, goldInk]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{validValue}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },
  shadow: {
    borderRadius: 24,
    backgroundColor: BRAND.navy,
    shadowColor: BRAND.navyDeep,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 12,
  },
  card: { borderRadius: 24, padding: SPACE.lg + 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)', minHeight: 196 },
  orbA: { position: 'absolute', right: -70, top: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)' },
  orbB: { position: 'absolute', left: -60, bottom: -110, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(96,165,250,0.18)' },
  sheen: { position: 'absolute', top: -60, bottom: -60, width: 90 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  logoPill: { backgroundColor: PALETTE.white, borderRadius: 999, paddingHorizontal: 10, height: 30, justifyContent: 'center' },
  logo: { width: 70, height: 22 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  tierText: { color: PALETTE.white, fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 1.4 },
  mid: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg },
  chip: { width: 42, height: 32, borderRadius: 7, overflow: 'hidden' },
  chipLineH: { position: 'absolute', left: 0, right: 0, top: 15, height: 1, backgroundColor: 'rgba(146,64,14,0.45)' },
  chipLineV: { position: 'absolute', top: 0, bottom: 0, left: 20, width: 1, backgroundColor: 'rgba(146,64,14,0.45)' },
  plan: { color: PALETTE.white, fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: BRAND.onBrandSoft, fontSize: 10.5, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.md, marginTop: SPACE.lg },
  name: { color: PALETTE.white, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  idLabel: { color: BRAND.onBrandFaint, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },
  id: { color: PALETTE.white, fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: 1.4, fontVariant: ['tabular-nums'] },
  valid: { alignItems: 'flex-end', maxWidth: '38%' },
  validValue: { color: '#FDE68A', fontSize: 13, lineHeight: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
});

import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { AppearanceToggle } from '../../../ui/AppearanceToggle';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Platform, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, RADIUS, Skeleton,
  BRAND, PREMIUM_TYPE, BrandLogo, GlassIconButton, GlassIconBadgeButton, GradientAvatar, FloatingIllustration,
  FadeInUp, PressableScale, useLoop, prefersReducedMotion,
} from '../../../ui';
import { StageState } from './memberRules';

/**
 * ============================================================================
 * DASHBOARD — premium pieces shared by the unpaid and paid dashboards
 * ============================================================================
 *
 *   DashboardHeader      glass menu · logo · messages · bell, then the greeting
 *                        (avatar, time of day, date) beside floating art
 *   ApprovalJourneyCard  the unpaid member's application as a 3D card, the
 *                        Block → District → State → Payment track filling in
 *   MembershipCard3D     the paid member's card: chip, member ID, validity,
 *                        a light sweep across the gloss
 *   PremiumDashboardSkeleton  first-load placeholder for the body
 *
 * Visual only — every value arrives as a prop from the screen, which owns the
 * data calls exactly as before.
 */

const CAP = 1.3;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const greetingFor = (h: number) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
export const greetingEmoji = (h: number) => (h < 12 ? '☀️' : h < 17 ? '🌤️' : '🌙');
export const todayLabel = (d = new Date()) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/* ================================================================ header */

export function DashboardHeader({
  name, photo, eyebrow, title, subtitle, art, status, onMenu, onMessages, onBell, messages = 0, bell = 0, children,
}: {
  name: string;
  photo?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  art?: React.ReactNode;
  status?: 'online' | 'verified' | 'pending';
  onMenu: () => void;
  onMessages: () => void;
  onBell: () => void;
  messages?: number;
  bell?: number;
  children?: React.ReactNode;
}) {
  const h = useLegacyAppearance(legacyAppearance_h);
  return (
    <View>
      <View style={h.top}>
        <GlassIconButton icon="menu" onPress={onMenu} accessibilityLabel="Open menu" />
        <BrandLogo size="sm" style={h.logo} />
        <View style={{ flex: 1 }} />
        <GlassIconBadgeButton
          icon="chat-bubble-outline"
          badge={messages}
          onPress={onMessages}
          accessibilityLabel={messages > 0 ? `Messages, ${messages} unread` : 'Messages'}
        />
        <GlassIconBadgeButton
          icon="notifications-none"
          badge={bell}
          onPress={onBell}
          accessibilityLabel={bell > 0 ? `Notifications, ${bell} new` : 'Notifications'}
          style={{ marginLeft: SPACE.sm }}
        />
      </View>
      <View style={{ alignItems: 'flex-end', marginTop: SPACE.sm }}><AppearanceToggle glass /></View>
      <View style={h.hero}>
        <FadeInUp delay={40} style={h.heroText}>
          <View style={h.greetRow}>
            <GradientAvatar name={name || 'Member'} uri={photo || undefined} size={52} status={status} />
            <Text style={h.eyebrow} numberOfLines={2} maxFontSizeMultiplier={CAP}>{eyebrow}</Text>
          </View>
          <Text style={h.title} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={1.25}>{title}</Text>
          {subtitle ? <Text style={h.sub} numberOfLines={2} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
        </FadeInUp>
        {art ? (
          <FadeInUp delay={120} scaleFrom={0.85} distance={10}>
            <FloatingIllustration size={92}>{art}</FloatingIllustration>
          </FadeInUp>
        ) : null}
      </View>
      {children ? <FadeInUp delay={180} distance={8}>{children}</FadeInUp> : null}
    </View>
  );
}

/** A translucent chip on the header gradient ("Business applicant", "Under review"). */
export function GlassChip({ label, icon, dot, style }: { label: string; icon?: string; dot?: string; style?: StyleProp<ViewStyle> }) {
  const h = useLegacyAppearance(legacyAppearance_h);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={[h.chip, style]}>
      {dot ? <View style={[h.chipDot, { backgroundColor: dot }]} /> : null}
      {icon ? <Icon name={icon} size={13} color={PALETTE.white} /> : null}
      <Text style={h.chipText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
    </View>
  );
}

/* ================================================================ light sweep */

/** A slow diagonal gloss moving across a card — native driver, off under reduce-motion. */
function Sheen({ width }: { width: number }) {
  const p = useLegacyAppearance(legacyAppearance_p);
  const t = useLoop({ duration: 5200, delay: 800 });
  const w = Math.max(200, width || 320);
  const translateX = t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [-w * 0.6, w * 1.2, w * 1.2] });
  return (
    <Animated.View pointerEvents="none" style={[p.sheen, { transform: [{ translateX }, { rotate: '18deg' }] }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

/* ================================================================ approval journey */

export type JourneyNode = { key: string; label: string; state: StageState; at?: string };

const NODE = 34;

const NODE_UI: Record<StageState, { icon: string; bg: string; fg: string; ring: string; caption: string }> = {
  approved: { icon: 'check', bg: '#10B981', fg: PALETTE.white, ring: 'rgba(16,185,129,0.35)', caption: 'Approved' },
  in_progress: { icon: 'hourglass-top', bg: '#F59E0B', fg: PALETTE.white, ring: 'rgba(245,158,11,0.40)', caption: 'In review' },
  rejected: { icon: 'close', bg: '#EF4444', fg: PALETTE.white, ring: 'rgba(239,68,68,0.35)', caption: 'Returned' },
  pending: { icon: 'schedule', bg: 'rgba(255,255,255,0.14)', fg: 'rgba(255,255,255,0.8)', ring: 'transparent', caption: 'Waiting' },
};

export function JourneyTrack({ nodes }: { nodes: JourneyNode[] }) {
  const p = useLegacyAppearance(legacyAppearance_p);
  const NODE_UI = useLegacyAppearance(legacyAppearance_NODE_UI);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const list = nodes || [];
  const total = Math.max(1, list.length);
  // The rail fills up to the last approved node (and half-way into a node under review).
  const lastDone = list.reduce((acc, n, i) => (n.state === 'approved' ? i : acc), -1);
  const reviewing = list.findIndex((n) => n.state === 'in_progress');
  const target = total > 1
    ? Math.max(0, Math.min(1, (Math.max(lastDone, 0) + (reviewing > lastDone ? 0.5 : 0)) / (total - 1)))
    : 1;
  const [width, setWidth] = useState(0);
  const fill = useRef(new Animated.Value(prefersReducedMotion() ? target : 0)).current;
  const pulse = useLoop({ duration: 1800, enabled: reviewing >= 0 });

  useEffect(() => {
    const anim = Animated.timing(fill, {
      toValue: lastDone < 0 && reviewing < 0 ? 0 : target,
      duration: prefersReducedMotion() ? 0 : 1100,
      delay: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [fill, target, lastDone, reviewing]);

  const cell = width / total;
  const trackW = Math.max(0, width - cell);
  const translateX = fill.interpolate({ inputRange: [0, 1], outputRange: [-trackW, 0] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Number(e?.nativeEvent?.layout?.width || 0))} style={p.track}>
      {width > 0 ? (
        <View pointerEvents="none" style={[p.rail, { left: cell / 2, width: trackW }]}>
          <Animated.View style={[p.railFill, { width: trackW, transform: [{ translateX }] }]}>
            <LinearGradient colors={['#34D399', '#A7F3D0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      ) : null}
      {list.map((n, i) => {
        const ui = NODE_UI[n.state] || NODE_UI.pending;
        return (
          <View key={n.key} style={p.cell} accessibilityLabel={`${n.label}: ${ui.caption}`}>
            <View style={p.nodeWrap}>
              {n.state === 'in_progress' ? (
                <Animated.View style={[p.halo, { backgroundColor: ui.ring, opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
              ) : null}
              <FadeInUp delay={300 + i * 120} scaleFrom={0.6} distance={0}>
                <View style={[p.node, { backgroundColor: ui.bg }, n.state === 'pending' && p.nodePending]}>
                  <Icon name={ui.icon} size={17} color={ui.fg} />
                </View>
              </FadeInUp>
            </View>
            <Text style={p.nodeLabel} numberOfLines={1} maxFontSizeMultiplier={1.15}>{n.label}</Text>
            <Text style={[p.nodeCaption, n.state !== 'pending' && { color: PALETTE.white }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
              {n.at || ui.caption}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ApprovalJourneyCard({
  name, reference, memberType, statusLabel, statusDot, nodes, done, percent, headline, onPress, style,
}: {
  name: string;
  reference: string;
  memberType: string;
  statusLabel: string;
  statusDot: string;
  nodes: JourneyNode[];
  done: number;
  percent: number;
  headline: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useLegacyAppearance(legacyAppearance_p);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const [w, setW] = useState(0);
  return (
    <PressableScale
      onPress={onPress}
      style={style}
      scaleTo={0.985}
      contentStyle={p.cardShadow}
      accessibilityRole="button"
      accessibilityLabel={`Your application. ${statusLabel}. ${done} of ${nodes.length} stages complete. Open application status.`}
    >
      <LinearGradient
        colors={[BRAND.navyDeep, BRAND.navy, BRAND.blue900, '#1D4ED8']}
        locations={[0, 0.35, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={p.card}
        onLayout={(e: LayoutChangeEvent) => setW(Number(e?.nativeEvent?.layout?.width || 0))}
      >
        <View style={p.orbA} />
        <View style={p.orbB} />
        <Sheen width={w} />
        <View style={p.cardTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={p.eyebrow} numberOfLines={1} maxFontSizeMultiplier={CAP}>Membership application</Text>
            <Text style={p.name} numberOfLines={1} maxFontSizeMultiplier={CAP}>{name || 'ACTIV Member'}</Text>
          </View>
          <GlassChip label={statusLabel} dot={statusDot} />
        </View>
        <View style={p.refRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={p.refLabel} maxFontSizeMultiplier={1.2}>APPLICATION ID</Text>
            <Text style={p.ref} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} selectable maxFontSizeMultiplier={1.2}>{reference || 'Not submitted yet'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', maxWidth: '45%' }}>
            <Text style={p.refLabel} maxFontSizeMultiplier={1.2}>MEMBER TYPE</Text>
            <Text style={p.refSmall} numberOfLines={1} maxFontSizeMultiplier={1.2}>{memberType || '—'}</Text>
          </View>
        </View>
        <JourneyTrack nodes={nodes} />
        <View style={p.cardFoot}>
          <Text style={p.foot} numberOfLines={2} maxFontSizeMultiplier={CAP}>{headline}</Text>
          <View style={p.pct}>
            <Text style={p.pctText} maxFontSizeMultiplier={1.2}>{Math.round(percent)}%</Text>
            <Icon name="chevron-right" size={18} color={BRAND.navy} />
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

/* ================================================================ paid card */

export function MembershipCard3D({
  name, photo, planTitle, subtitle, memberId, since, validLabel, validValue, statusLabel, active, platinum, onPress,
}: {
  name: string;
  photo?: string;
  planTitle: string;
  subtitle: string;
  memberId: string;
  since: string;
  validLabel: string;
  validValue: string;
  statusLabel: string;
  active: boolean;
  platinum: boolean;
  onPress: () => void;
}) {
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const p = useLegacyAppearance(legacyAppearance_p);
  const [w, setW] = useState(0);
  const colors = platinum
    ? ['#111827', '#374151', '#6B7280', '#9CA3AF']
    : [BRAND.navyDeep, BRAND.navy, BRAND.blue900, BRAND.blue];
  // The member ID read like a card number: groups of four, never invented.
  const idText = String(memberId || '').trim();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      contentStyle={[p.cardShadow, platinum && { shadowColor: '#111827' }]}
      accessibilityRole="button"
      accessibilityLabel={`${planTitle}. Member ID ${idText || 'not assigned'}. ${validLabel} ${validValue}. Open plan details.`}
    >
      <LinearGradient
        colors={colors}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={p.card}
        onLayout={(e: LayoutChangeEvent) => setW(Number(e?.nativeEvent?.layout?.width || 0))}
      >
        <View style={p.orbA} />
        <View style={p.orbB} />
        <Sheen width={w} />
        <View style={p.cardTop}>
          <View style={p.chipRow}>
            <LinearGradient colors={['#FDE68A', '#F59E0B', '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.emv}>
              <View style={p.emvLineH} />
              <View style={p.emvLineV} />
            </LinearGradient>
            <Icon name="contactless" size={22} color="rgba(255,255,255,0.75)" style={{ transform: [{ rotate: '90deg' }] }} />
          </View>
          <BrandLogo size="sm" />
        </View>
        <View style={p.personRow}>
          <GradientAvatar name={name} uri={photo || undefined} size={54} status={active ? 'verified' : 'pending'} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={p.name} numberOfLines={1} maxFontSizeMultiplier={CAP}>{name}</Text>
            <Text style={p.plan} numberOfLines={1} maxFontSizeMultiplier={CAP}>{planTitle}</Text>
            <Text style={p.planSub} numberOfLines={1} maxFontSizeMultiplier={CAP}>{subtitle}</Text>
          </View>
        </View>
        <Text style={p.refLabel} maxFontSizeMultiplier={1.2}>MEMBER ID</Text>
        <Text
          style={[p.memberId, idText.length > 20 && { fontSize: 20, letterSpacing: 0.5 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          selectable
          maxFontSizeMultiplier={1.2}
        >
          {idText || '—'}
        </Text>
        <View style={p.validRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={p.refLabel} maxFontSizeMultiplier={1.2}>MEMBER SINCE</Text>
            <Text style={p.refSmall} numberOfLines={1} maxFontSizeMultiplier={1.2}>{since || '—'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={p.refLabel} maxFontSizeMultiplier={1.2}>{validLabel.toUpperCase()}</Text>
            <Text style={p.refSmall} numberOfLines={1} maxFontSizeMultiplier={1.2}>{validValue || '—'}</Text>
          </View>
        </View>
        <View style={p.membershipStatus}><GlassChip label={statusLabel} dot={active ? '#34D399' : '#FBBF24'} /></View>
      </LinearGradient>
    </PressableScale>
  );
}

/* ================================================================ skeleton */

export function PremiumDashboardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = useLegacyAppearance(legacyAppearance_p);
  const { width } = useWindowDimensions();
  const cardH = Math.round(Math.min(240, Math.max(200, (width || 360) * 0.58)));
  return (
    <View style={style} accessibilityLabel="Loading your dashboard" accessibilityRole="progressbar">
      <View style={[p.skCard, { height: cardH }]}>
        <Skeleton width="45%" height={12} />
        <Skeleton width="70%" height={22} style={{ marginTop: SPACE.sm }} />
        <Skeleton width="100%" height={40} radius={RADIUS.md} style={{ marginTop: SPACE.xl }} />
        <Skeleton width="60%" height={12} style={{ marginTop: SPACE.lg }} />
      </View>
      <View style={p.skRow}>
        {[0, 1, 2].map((i) => <Skeleton key={i} width="31%" height={96} radius={18} />)}
      </View>
      <View style={p.skGrid}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} width="48.5%" height={120} radius={20} style={{ marginBottom: SPACE.md }} />)}
      </View>
    </View>
  );
}

/* ================================================================ styles */

const h = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center' },
  logo: { marginLeft: SPACE.sm },
  hero: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.lg, gap: SPACE.sm },
  heroText: { flex: 1, minWidth: 0 },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  eyebrow: { ...PREMIUM_TYPE.eyebrow, color: BRAND.onBrandFaint, flex: 1, minWidth: 0 },
  title: { ...PREMIUM_TYPE.heroMd, color: PALETTE.white, marginTop: SPACE.md },
  sub: { ...PREMIUM_TYPE.lead, fontSize: 14, lineHeight: 20, color: BRAND.onBrandSoft, marginTop: SPACE.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', minHeight: 26, paddingHorizontal: SPACE.sm + 2,
    borderRadius: 999, backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: PALETTE.white, letterSpacing: 0.3, flexShrink: 1 },
});

const p = StyleSheet.create({
  cardShadow: {
    borderRadius: 26, backgroundColor: BRAND.navy, shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32, shadowRadius: 26, elevation: 12,
  },
  card: { borderRadius: 26, padding: SPACE.xl, overflow: 'hidden' },
  orbA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(96,165,250,0.18)', top: -110, right: -70 },
  orbB: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -80, left: -50 },
  sheen: { position: 'absolute', top: -60, bottom: -60, width: 90 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  eyebrow: { ...PREMIUM_TYPE.eyebrow, color: BRAND.onBrandFaint },
  name: { ...TYPE.title, color: PALETTE.white, marginTop: 2 },
  refRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.md, marginTop: SPACE.lg },
  refLabel: { fontSize: 9.5, lineHeight: 12, fontWeight: '800', letterSpacing: 1.2, color: BRAND.onBrandFaint },
  ref: {
    fontSize: 17, lineHeight: 22, fontWeight: '800', color: PALETTE.white, letterSpacing: 1.2, marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refSmall: { ...TYPE.bodyStrong, color: PALETTE.white, marginTop: 3 },

  track: { flexDirection: 'row', marginTop: SPACE.xl },
  rail: { position: 'absolute', top: NODE / 2 - 2, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  railFill: { height: 4 },
  cell: { flex: 1, minWidth: 0, alignItems: 'center' },
  nodeWrap: { width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: NODE, height: NODE, borderRadius: NODE / 2 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  nodePending: { borderColor: 'rgba(255,255,255,0.35)', borderStyle: 'dashed' },
  nodeLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: PALETTE.white, marginTop: SPACE.sm, textAlign: 'center' },
  nodeCaption: { fontSize: 10.5, lineHeight: 14, color: BRAND.onBrandFaint, marginTop: 1, textAlign: 'center' },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg, paddingTop: SPACE.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)',
  },
  foot: { ...TYPE.caption, color: BRAND.onBrandSoft, flex: 1, minWidth: 0, lineHeight: 17 },
  pct: { flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.white, borderRadius: 999, paddingLeft: SPACE.md, paddingRight: SPACE.xs, minHeight: 32 },
  pctText: { fontSize: 14, fontWeight: '800', color: BRAND.navy, fontVariant: ['tabular-nums'] },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  emv: { width: 38, height: 28, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  emvLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(120,53,15,0.45)' },
  emvLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(120,53,15,0.45)' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg },
  plan: { ...TYPE.label, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  planSub: { ...TYPE.caption, color: BRAND.onBrandFaint, marginTop: 1, textTransform: 'capitalize' },
  memberId: {
    fontSize: 22, lineHeight: 28, fontWeight: '800', color: PALETTE.white, letterSpacing: 2.5, marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: SPACE.lg,
  },
  validRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.md },
  membershipStatus: { alignItems: 'flex-end', marginTop: SPACE.md, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' },

  skCard: { marginHorizontal: SPACE.lg, borderRadius: 26, backgroundColor: PALETTE.white, padding: SPACE.xl, borderWidth: 1, borderColor: PALETTE.border },
  skRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  skGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: SPACE.lg, marginTop: SPACE.xl },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_h = h;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_p = p;
const legacyAppearance_NODE_UI = NODE_UI;
const legacyAppearance_BRAND = BRAND;

import { AppTheme, useAppTheme, useThemeStyles } from '../AppTheme';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SIZE, SPACE, Tone } from '../tokens';
import { PREMIUM_RADIUS } from './theme';
import { PressableScale, prefersReducedMotion } from './motion';

/**
 * ============================================================================
 * PREMIUM BLOCKS — the body pieces of a premium dashboard / detail screen
 * ============================================================================
 *
 *   GlassIconBadgeButton  round glass button on the header with a count badge
 *   PremiumCard           white 22px card, navy-tinted shadow, optional press
 *   PremiumSectionHeader  title · subtitle · "See all" on the canvas
 *   GradientIconChip      gradient square + white glyph (colour per meaning)
 *   AnimatedProgressBar   fills from 0 on mount (native driver: scaleX)
 *   ActionTile            quick-action tile — gradient chip, label, detail
 *   StatPill              a number and its label, for a stats row
 *   PremiumEmptyState     small art + title + text (+ action) inside a card
 *
 * Visual only; nothing here reads or writes data.
 */

const CAP = 1.3;

/** Gradient pairs by meaning — member side: blues, teal, green, amber, rose (never purple). */
export const CHIP_GRADIENTS: Record<string, string[]> = {
  blue: ['#1E3A8A', '#3B82F6'],
  sky: ['#0369A1', '#38BDF8'],
  teal: ['#0F766E', '#2DD4BF'],
  green: ['#047857', '#34D399'],
  amber: ['#B45309', '#FBBF24'],
  rose: ['#BE123C', '#FB7185'],
  navy: ['#0B1A45', '#1E3A8A'],
  slate: ['#334155', '#94A3B8'],
  indigo: ['#3B2DB0', '#6D5AE6'],
  gold: ['#8A6A12', '#E7C766'],
};

export type ChipTone = keyof typeof CHIP_GRADIENTS;

/* ------------------------------------------------------------ header button */

export function GlassIconBadgeButton({ icon, onPress, accessibilityLabel, badge, style }: {
  icon: string; onPress: () => void; accessibilityLabel: string; badge?: number; style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const count = Math.max(0, Number(badge || 0));
  return (
    <PressableScale
      onPress={onPress}
      style={style}
      scaleTo={0.92}
      contentStyle={s.glass}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
    >
      <Icon name={icon} size={22} color={PALETTE.white} />
      {count > 0 ? (
        <View style={s.badge}>
          <Text style={s.badgeText} maxFontSizeMultiplier={1}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

/* ------------------------------------------------------------ card */

export function PremiumCard({ children, style, onPress, tone = 'member', padded = true, accessibilityLabel, stretch = false }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: Tone; padded?: boolean;
  accessibilityLabel?: string;
  stretch?: boolean;
}) {
  const { premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const box = [s.card, padded && s.cardPad, { shadowColor: p.shadow }, stretch && { flex: 1 }];
  if (!onPress) return <View style={[box, style]}>{children}</View>;
  return (
    <PressableScale
      onPress={onPress}
      style={[stretch && { flex: 1 }, style]}
      scaleTo={0.985}
      contentStyle={box}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </PressableScale>
  );
}

export function PremiumSectionHeader({ title, subtitle, action, onAction, tone = 'member', style }: {
  title: string; subtitle?: string; action?: string; onAction?: () => void; tone?: Tone; style?: StyleProp<ViewStyle>;
}) {
  const { premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  return (
    <View style={[s.sh, style]}>
      <View style={s.shText}>
        <Text style={s.shTitle} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{title}</Text>
        {subtitle ? <Text style={s.shSub} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <PressableScale
          onPress={onAction}
          scaleTo={0.94}
          contentStyle={[s.shAction, { backgroundColor: p.accentSoft }]}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
          hitSlop={6}
        >
          <Text style={[s.shActionText, { color: p.accentDark }]} maxFontSizeMultiplier={CAP}>{action}</Text>
          <Icon name="chevron-right" size={16} color={p.accentDark} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ chip */

export function GradientIconChip({ icon, tone = 'blue', size = SIZE.iconChip, colors, style }: {
  icon: string; tone?: ChipTone; size?: number; colors?: string[]; style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const grad = colors && colors.length >= 2 ? colors : (CHIP_GRADIENTS[tone] || CHIP_GRADIENTS.blue);
  const box = Math.max(24, Number(size || 0));
  return (
    <View style={[s.chipShadow, { width: box, height: box, borderRadius: box * 0.32, shadowColor: grad[0] }, style]}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: box, height: box, borderRadius: box * 0.32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <View style={[s.chipSheen, { borderTopLeftRadius: box * 0.32, borderTopRightRadius: box * 0.32 }]} />
        <Icon name={icon} size={Math.round(box * 0.5)} color={PALETTE.white} />
      </LinearGradient>
    </View>
  );
}

/* ------------------------------------------------------------ progress */

export function AnimatedProgressBar({ percent, onDark = false, colors, height = 8, delay = 200, style }: {
  percent: number; onDark?: boolean; colors?: string[]; height?: number; delay?: number; style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE, brand: BRAND } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const pct = Math.max(0, Math.min(100, Number(percent || 0)));
  const [w, setW] = useState(0);
  const v = useRef(new Animated.Value(prefersReducedMotion() ? pct : 0)).current;
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: pct,
      duration: prefersReducedMotion() ? 0 : 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [pct, v, delay]);
  const translateX = v.interpolate({ inputRange: [0, 100], outputRange: [-w, 0], extrapolate: 'clamp' });
  const grad = colors && colors.length >= 2 ? colors : onDark ? ['#FFFFFF', '#DBEAFE'] : [BRAND.blue900, BRAND.blueLight];
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(Number(e?.nativeEvent?.layout?.width || 0))}
      style={[s.track, { height, borderRadius: height, backgroundColor: onDark ? 'rgba(255,255,255,0.22)' : PALETTE.field }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      {w > 0 ? (
        <Animated.View style={{ width: w, height, transform: [{ translateX }] }}>
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: height }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ tiles */

export function ActionTile({ icon, label, detail, tone = 'blue', onPress, badge, style }: {
  icon: string; label: string; detail?: string; tone?: ChipTone; onPress: () => void; badge?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      style={[s.tileCell, style]}
      contentStyle={s.tile}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
    >
      <View style={s.tileHead}>
        <GradientIconChip icon={icon} tone={tone} size={42} />
        {badge ? (
          <View style={s.tileBadge}><Text style={s.tileBadgeText} numberOfLines={1} maxFontSizeMultiplier={1.1}>{badge}</Text></View>
        ) : <Icon name="arrow-outward" size={16} color={PALETTE.textFaint} />}
      </View>
      <Text style={s.tileLabel} numberOfLines={2} maxFontSizeMultiplier={CAP}>{label}</Text>
      {detail ? <Text style={s.tileDetail} maxFontSizeMultiplier={CAP}>{detail}</Text> : null}
    </PressableScale>
  );
}

/** A 2-up grid on the gutter for ActionTiles. */
export function ActionGrid({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useThemeStyles(makeStyles);
  return <View style={[s.grid, style]}>{children}</View>;
}

export function StatPill({ value, label, icon, tone = 'blue', onPress }: {
  value: string | number; label: string; icon: string; tone?: ChipTone; onPress?: () => void;
}) {
  const s = useThemeStyles(makeStyles);
  const body = (
    <>
      <GradientIconChip icon={icon} tone={tone} size={30} />
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}>
        {String(value ?? '')}
      </Text>
      <Text style={s.statLabel} numberOfLines={2} maxFontSizeMultiplier={1.2}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={[s.stat, s.statFlex]} accessibilityLabel={`${value} ${label}`}>{body}</View>;
  return (
    <PressableScale
      onPress={onPress}
      style={s.statFlex}
      contentStyle={s.stat}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      {body}
    </PressableScale>
  );
}

export function StatRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useThemeStyles(makeStyles);
  return <View style={[s.statRow, style]}>{children}</View>;
}

/* ------------------------------------------------------------ empty */

export function PremiumEmptyState({ art, icon = 'inbox', title, text, action, onAction, tone = 'member' }: {
  art?: React.ReactNode; icon?: string; title: string; text?: string; action?: string; onAction?: () => void; tone?: Tone;
}) {
  const { premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  return (
    <View style={s.empty}>
      {art || (
        <View style={[s.emptyIcon, { backgroundColor: p.accentSoft }]}>
          <Icon name={icon} size={26} color={p.accent} />
        </View>
      )}
      <Text style={s.emptyTitle} maxFontSizeMultiplier={CAP}>{title}</Text>
      {text ? <Text style={s.emptyText} maxFontSizeMultiplier={CAP}>{text}</Text> : null}
      {action && onAction ? (
        <PressableScale onPress={onAction} scaleTo={0.95} contentStyle={[s.emptyBtn, { backgroundColor: p.accentSoft }]} accessibilityRole="button">
          <Text style={[s.emptyBtnText, { color: p.accentDark }]} maxFontSizeMultiplier={CAP}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE, brand: BRAND }: AppTheme) => StyleSheet.create({
  glass: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: PALETTE.red, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: BRAND.navy,
  },
  badgeText: { color: PALETTE.white, fontSize: 10, lineHeight: 12, fontWeight: '800' },

  card: {
    backgroundColor: PALETTE.card, borderRadius: PREMIUM_RADIUS.section - 2, borderWidth: 1, borderColor: PALETTE.border,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.09, shadowRadius: 20, elevation: 4,
  },
  cardPad: { padding: SPACE.lg + 2 },

  sh: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginHorizontal: SPACE.lg, marginTop: SPACE.xl + 4, marginBottom: SPACE.md },
  shText: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  shTitle: { ...TYPE.heading, fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3 },
  shSub: { ...TYPE.caption, fontWeight: '400', marginTop: 2 },
  shAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32, paddingLeft: SPACE.md, paddingRight: SPACE.sm, borderRadius: 999 },
  shActionText: { fontSize: 13, lineHeight: 17, fontWeight: '700', flexShrink: 1 },

  chipShadow: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 3 },
  chipSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '48%', backgroundColor: 'rgba(255,255,255,0.16)' },

  track: { overflow: 'hidden' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: SPACE.lg },
  tileCell: { width: '48.5%', marginBottom: SPACE.md },
  tile: {
    flex: 1, minHeight: 124, padding: SPACE.lg, backgroundColor: PALETTE.card, borderRadius: 20, borderWidth: 1,
    borderColor: PALETTE.border, shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 3,
  },
  tileHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACE.md },
  tileBadge: { backgroundColor: PALETTE.redSoft, borderRadius: 999, paddingHorizontal: SPACE.sm, paddingVertical: 2, maxWidth: '55%' },
  tileBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: PALETTE.redDark },
  tileLabel: { ...TYPE.bodyStrong, fontSize: 15 },
  tileDetail: { ...TYPE.caption, marginTop: 2 },

  statRow: { flexDirection: 'row', gap: SPACE.sm, marginHorizontal: SPACE.lg },
  statFlex: { flex: 1, minWidth: 0 },
  stat: {
    flexGrow: 1, alignItems: 'flex-start', padding: SPACE.md, backgroundColor: PALETTE.card, borderRadius: 18, borderWidth: 1,
    borderColor: PALETTE.border, shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 2, minHeight: 104,
  },
  statValue: { ...TYPE.number, fontSize: 22, lineHeight: 28, marginTop: SPACE.sm, alignSelf: 'stretch' },
  statLabel: { ...TYPE.caption, fontSize: 11, lineHeight: 14 },

  empty: { alignItems: 'center', paddingVertical: SPACE.xl, paddingHorizontal: SPACE.lg, gap: SPACE.xs },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.xs },
  emptyTitle: { ...TYPE.subheading, textAlign: 'center', marginTop: SPACE.xs },
  emptyText: { ...TYPE.caption, fontWeight: '400', textAlign: 'center', lineHeight: 17 },
  emptyBtn: { marginTop: SPACE.sm, minHeight: 36, paddingHorizontal: SPACE.lg, borderRadius: 999, justifyContent: 'center' },
  emptyBtnText: { fontSize: 13, fontWeight: '700' },
});

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Svg, { Path } from 'react-native-svg';
import { PALETTE, SIZE, SPACE, TYPE, Tone } from '../tokens';
import { Skeleton } from '../components';
import { BRAND, premiumTone } from './theme';
import { PressableScale, prefersReducedMotion } from './motion';
import { GradientButton } from './controls';
import { ArtBadge, CloudOff3D, EmptyBox3D } from './sceneArt';

/**
 * ============================================================================
 * MEMBER BLOCKS — body pieces for the premium inner screens
 * ============================================================================
 *
 *   SurfaceCard ...... white 22px card, navy-tinted shadow, spring press
 *   GradientGlyph .... gradient square with a white icon (colour by meaning)
 *   LinkRow .......... menu / navigation row with a glyph, chevron, badge
 *   GroupTitle ....... section heading on the canvas, with a count and action
 *   PillTabs ......... pick one of <= 4 — white track, gradient active pill, counts
 *   SearchPill ....... white search field for the gradient header
 *   DateTile ......... calendar block: month · day · weekday (TBC when undated)
 *   MeterBar ......... gradient fill that grows on mount (native driver)
 *   SeatMeter ........ "12 of 50 seats left" + a meter that warms as it fills
 *   StateView ........ empty / error state with original art and a gradient CTA
 *   CardSkeletons .... card-shaped loading placeholders (row | media | bubble)
 *   TornEdge ......... receipt zig-zag
 *   ReceiptLine ...... label …… value, for receipts and summaries
 *   untilLabel() ..... "Today", "Tomorrow", "In 3 days", "Ended"
 *
 * Visual only; nothing here reads or writes data.
 */

const CAP = 1.3;

/** Gradient pairs by meaning — member side: blues, teal, green, amber, rose. Never purple. */
export const GLYPH_COLORS: Record<string, string[]> = {
  blue: ['#1E3A8A', '#3B82F6'],
  sky: ['#0369A1', '#38BDF8'],
  teal: ['#0F766E', '#2DD4BF'],
  green: ['#047857', '#34D399'],
  amber: ['#B45309', '#FBBF24'],
  rose: ['#BE123C', '#FB7185'],
  red: ['#991B1B', '#EF4444'],
  navy: ['#0B1A45', '#1E3A8A'],
  slate: ['#334155', '#94A3B8'],
  gold: ['#8A6A12', '#E7C766'],
};
export type GlyphTone = keyof typeof GLYPH_COLORS;

/* ================================================================ surfaces */

/**
 * The premium card. Shadow on the outer view, clipping on the inner one (iOS
 * drops a shadow on a clipped view). `onPress` makes it spring.
 */
export function SurfaceCard({
  children, onPress, style, contentStyle, padded = true, accessibilityLabel, accent, disabled, stretch = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
  /** A coloured border (e.g. PALETTE.green for "you are registered"). */
  accent?: string;
  disabled?: boolean;
  /** Fill a horizontal carousel cell without fixing its text height. */
  stretch?: boolean;
}) {
  const inner = (
    <View style={[b.cardInner, padded && b.cardPad, accent ? { borderColor: accent, borderWidth: 1.5 } : null, stretch && { flex: 1 }, contentStyle]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        style={[b.cardShadow, stretch && { flex: 1 }, style]}
        contentStyle={stretch ? { flex: 1 } : undefined}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </PressableScale>
    );
  }
  return <View style={[b.cardShadow, stretch && { flex: 1 }, style]}>{inner}</View>;
}

/** Gradient square + white glyph. */
export function GradientGlyph({ icon, tone = 'blue', colors, size = 42, iconSize, radius, style }: {
  icon: string; tone?: GlyphTone; colors?: string[]; size?: number; iconSize?: number; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  const c = colors || GLYPH_COLORS[tone] || GLYPH_COLORS.blue;
  return (
    <LinearGradient
      colors={c}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: size, height: size, borderRadius: typeof radius === 'number' ? radius : Math.round(size * 0.32), alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <View pointerEvents="none" style={[b.glyphSheen, { borderTopLeftRadius: Math.round(size * 0.32), borderTopRightRadius: Math.round(size * 0.32) }]} />
      <Icon name={icon} size={iconSize || Math.round(size * 0.5)} color={PALETTE.white} />
    </LinearGradient>
  );
}

/** A navigation row: glyph, title/subtitle, optional badge or right node, chevron. */
export function LinkRow({
  icon, tone = 'blue', title, subtitle, right, onPress, last, danger, badge, disabled, leading,
}: {
  icon?: string;
  tone?: GlyphTone;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
  badge?: string | number;
  disabled?: boolean;
  leading?: React.ReactNode;
}) {
  const body = (
    <View style={[b.linkRow, !last && b.linkDivider, disabled && { opacity: 0.5 }]}>
      {leading || (icon ? <GradientGlyph icon={icon} tone={danger ? 'red' : tone} size={40} /> : null)}
      <View style={b.flexMin}>
        <Text style={[b.linkTitle, danger && { color: PALETTE.redDark }]} numberOfLines={2} maxFontSizeMultiplier={CAP}>{title}</Text>
        {subtitle ? <Text style={b.linkSub} numberOfLines={2} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
      </View>
      {badge !== undefined && badge !== null && badge !== '' && badge !== 0 ? (
        <View style={b.linkBadge}><Text style={b.linkBadgeText} maxFontSizeMultiplier={1.1}>{String(badge)}</Text></View>
      ) : null}
      {right || null}
      {onPress ? <Icon name="chevron-right" size={22} color={PALETTE.textFaint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: PALETTE.blueSoft }}
      style={({ pressed }) => [pressed && { backgroundColor: PALETTE.blueTint }]}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      {body}
    </Pressable>
  );
}

/** Section heading on the canvas: title, optional count pill, optional action link. */
export function GroupTitle({ title, subtitle, count, action, onAction, style }: {
  title: string; subtitle?: string; count?: number; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[b.groupRow, style]}>
      <View style={b.flexMin}>
        <View style={b.groupTitleRow}>
          <Text style={b.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={CAP} numberOfLines={1}>{title}</Text>
          {typeof count === 'number' ? (
            <View style={b.groupCount}><Text style={b.groupCountText} maxFontSizeMultiplier={1.1}>{count}</Text></View>
          ) : null}
        </View>
        {subtitle ? <Text style={b.groupSub} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} style={b.groupAction} accessibilityRole="button">
          <Text style={b.groupActionText} maxFontSizeMultiplier={CAP}>{action}</Text>
          <Icon name="arrow-forward" size={16} color={PALETTE.blue} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ================================================================ controls */

export type PillTabOption<T extends string> = { value: T; label: string; count?: number; icon?: string };

/**
 * Pick one of <= 4, equal widths so all fit side by side on 360dp (Rule 4.3).
 * White track on the canvas, the active tab a navy→blue pill.
 */
export function PillTabs<T extends string>({ options, value, onChange, style, tone = 'member' }: {
  options: PillTabOption<T>[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle>; tone?: Tone;
}) {
  const p = premiumTone(tone);
  return (
    <View style={[b.tabsTrack, { shadowColor: p.shadow }, style]} accessibilityRole="tablist">
      {(options || []).map((o) => {
        const on = o.value === value;
        const label = (
          <View style={b.tabInner}>
            {o.icon ? <Icon name={o.icon} size={15} color={on ? PALETTE.white : PALETTE.textMuted} /> : null}
            <Text
              style={[b.tabText, on && { color: PALETTE.white }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.15}
            >
              {o.label}
            </Text>
            {typeof o.count === 'number' ? (
              <View style={[b.tabCount, on && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={[b.tabCountText, on && { color: PALETTE.white }]} maxFontSizeMultiplier={1.1}>{o.count > 99 ? '99+' : o.count}</Text>
              </View>
            ) : null}
          </View>
        );
        return (
          <TouchableOpacity
            key={o.value}
            style={b.tab}
            activeOpacity={0.85}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={typeof o.count === 'number' ? `${o.label}, ${o.count}` : o.label}
          >
            {on ? (
              <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={b.tabActive}>{label}</LinearGradient>
            ) : <View style={b.tabIdle}>{label}</View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** A white search field for the gradient header (or the canvas). */
export function SearchPill({ value, onChangeText, placeholder = 'Search', onSubmitEditing, right, style, tone = 'member' }: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: Tone;
}) {
  const p = premiumTone(tone);
  return (
    <View style={[b.search, { shadowColor: p.shadow }, style]}>
      <Icon name="search" size={20} color={p.accent} />
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={PALETTE.textFaint}
        selectionColor={p.accent}
        style={b.searchInput}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8} style={b.searchClear} accessibilityRole="button" accessibilityLabel="Clear search">
          <Icon name="close" size={18} color={PALETTE.textMuted} />
        </TouchableOpacity>
      ) : null}
      {right || null}
    </View>
  );
}

/* ================================================================ time & meters */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const asDate = (v?: string | Date | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** A calendar block. Undated → "TBC" (an undated event has not happened). */
export function DateTile({ date, size = 60, muted, style }: {
  date?: string | Date | null; size?: number; muted?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const d = asDate(date);
  const colors = muted ? ['#94A3B8', '#64748B'] : ['#1E3A8A', '#2563EB'];
  return (
    <View style={[b.dateShadow, { width: size, borderRadius: 16 }, style]}>
      <View style={[b.dateTile, { width: size, borderRadius: 16 }]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={b.dateTop}>
          <Text style={b.dateMonth} maxFontSizeMultiplier={1.1}>{d ? MONTHS[d.getMonth()] : 'DATE'}</Text>
        </LinearGradient>
        <View style={b.dateBody}>
          <Text style={[b.dateDay, muted && { color: PALETTE.textSoft }, !d && { fontSize: 15 }]} maxFontSizeMultiplier={1.1}>{d ? d.getDate() : 'TBC'}</Text>
          {d ? <Text style={b.dateWeek} maxFontSizeMultiplier={1.1}>{DAYS[d.getDay()]}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/** "Today", "Tomorrow", "In 3 days", "In 2 weeks", "Ended" — '' when undated. */
export function untilLabel(date?: string | Date | null, endDate?: string | Date | null): string {
  const d = asDate(date);
  if (!d) return '';
  const now = new Date();
  const end = asDate(endDate);
  if (end && d.getTime() <= now.getTime() && end.getTime() >= now.getTime()) return 'Happening now';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (days < 0) return end && end.getTime() >= now.getTime() ? 'Happening now' : 'Ended';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/** A gradient bar that grows to `value` (0–1) on mount. */
export function MeterBar({ value, colors, height = 8, track = PALETTE.divider, style }: {
  value: number; colors?: string[]; height?: number; track?: string; style?: StyleProp<ViewStyle>;
}) {
  const v = Math.max(0, Math.min(1, Number(value || 0)));
  const grow = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) { grow.setValue(1); return undefined; }
    const anim = Animated.timing(grow, { toValue: 1, duration: 700, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start(({ finished }) => { if (!finished) grow.setValue(1); });
    return () => anim.stop();
  }, [grow]);
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <View style={{ width: `${v * 100}%`, height, overflow: 'hidden', borderRadius: height / 2 }}>
        <Animated.View style={{ flex: 1, transform: [{ scaleX: grow }], transformOrigin: 'left' as any }}>
          <LinearGradient colors={colors || ['#1E3A8A', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * Seats: taken of capacity. Green while roomy, amber past 75 %, red when
 * full. Renders nothing without a capacity (an unlimited event).
 */
export function SeatMeter({ taken, capacity, left, style, compact }: {
  taken?: number | null; capacity?: number | null; left?: number | null; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const cap = Number(capacity || 0);
  if (!cap || cap <= 0) return null;
  const remaining = typeof left === 'number' && Number.isFinite(left) ? Math.max(0, left) : Math.max(0, cap - Number(taken || 0));
  const used = Math.max(0, cap - remaining);
  const ratio = used / cap;
  const colors = remaining <= 0 ? GLYPH_COLORS.red : ratio >= 0.75 ? GLYPH_COLORS.amber : GLYPH_COLORS.green;
  const text = remaining <= 0 ? 'Fully booked' : remaining === 1 ? 'Last seat left' : `${remaining} of ${cap} seats left`;
  return (
    <View style={style}>
      <View style={b.seatRow}>
        <Icon name="event-seat" size={14} color={colors[0]} />
        <Text style={[b.seatText, { color: colors[0] }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{text}</Text>
        {!compact ? <Text style={b.seatPct} maxFontSizeMultiplier={CAP}>{Math.round(ratio * 100)}% booked</Text> : null}
      </View>
      <MeterBar value={Math.max(ratio, 0.04)} colors={colors} height={6} style={{ marginTop: 6 }} />
    </View>
  );
}

/* ================================================================ states */

/**
 * Empty / error with original art in a navy disc and a gradient action.
 * `kind="error"` defaults to the cloud art and a "Try again" action.
 */
export function StateView({
  kind = 'empty', art, title, message, action, onAction, actionIcon, secondary, onSecondary, compact, style,
}: {
  kind?: 'empty' | 'error';
  art?: React.ReactNode;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  actionIcon?: string;
  secondary?: string;
  onSecondary?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const artSize = compact ? 64 : 84;
  const piece = art || (kind === 'error' ? <CloudOff3D size={artSize} /> : <EmptyBox3D size={artSize} />);
  const actionLabel = action || (kind === 'error' && onAction ? 'Try again' : '');
  return (
    <View style={[b.state, compact && b.stateCompact, style]} accessibilityLiveRegion={kind === 'error' ? 'polite' : undefined}>
      <ArtBadge size={compact ? 88 : 112}>{piece}</ArtBadge>
      <Text style={b.stateTitle} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{title}</Text>
      {message ? <Text style={b.stateText} maxFontSizeMultiplier={CAP}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <GradientButton
          label={actionLabel}
          icon={actionIcon || (kind === 'error' ? 'refresh' : undefined)}
          onPress={onAction}
          variant={kind === 'error' ? 'outline' : 'primary'}
          style={b.stateBtn}
        />
      ) : null}
      {secondary && onSecondary ? (
        <TouchableOpacity onPress={onSecondary} style={b.stateSecondary} accessibilityRole="button">
          <Text style={b.stateSecondaryText} maxFontSizeMultiplier={CAP}>{secondary}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Card-shaped placeholders on the gutter. */
export function CardSkeletons({ rows = 3, variant = 'row', style }: {
  rows?: number; variant?: 'row' | 'media' | 'bubble'; style?: StyleProp<ViewStyle>;
}) {
  const n = Math.max(1, Math.min(Number(rows || 3), 8));
  return (
    <View style={[b.skelWrap, style]} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: n }).map((_, i) => {
        if (variant === 'bubble') {
          const mine = i % 2 === 1;
          return (
            <View key={i} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <Skeleton width={mine ? '58%' : '68%'} height={44} radius={18} />
            </View>
          );
        }
        return (
          <View key={i} style={b.skelCard}>
            {variant === 'media' ? <Skeleton height={120} radius={16} style={{ marginBottom: SPACE.md }} /> : null}
            <View style={b.skelRow}>
              <Skeleton width={48} height={48} radius={14} />
              <View style={{ flex: 1, gap: SPACE.sm }}>
                <Skeleton width="65%" height={14} />
                <Skeleton width="90%" height={11} />
                <Skeleton width="40%" height={11} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ================================================================ receipts */

/** A zig-zag tear along a receipt's top or bottom edge, in `color` (the paper). */
export function TornEdge({ color = PALETTE.white, flip, height = 10, teeth = 22, style }: {
  color?: string; flip?: boolean; height?: number; teeth?: number; style?: StyleProp<ViewStyle>;
}) {
  const n = Math.max(6, teeth);
  const w = 100;
  const step = w / n;
  let d = flip ? 'M0 0' : `M0 ${height}`;
  for (let i = 0; i < n; i += 1) {
    const x1 = i * step + step / 2;
    const x2 = (i + 1) * step;
    d += flip ? ` L${x1} ${height} L${x2} 0` : ` L${x1} 0 L${x2} ${height}`;
  }
  d += ' Z';
  return (
    <View style={[{ height }, style]} pointerEvents="none">
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}

/** label ………… value — a receipt or summary line. */
export function ReceiptLine({ label, value, strong, muted, selectable }: {
  label: string; value?: string | number | null; strong?: boolean; muted?: boolean; selectable?: boolean;
}) {
  const v = value === undefined || value === null || value === '' ? '—' : String(value);
  return (
    <View style={b.rLine}>
      <Text style={[b.rLabel, strong && b.rStrongLabel]} maxFontSizeMultiplier={CAP}>{label}</Text>
      <Text
        style={[b.rValue, strong && b.rStrongValue, muted && { color: PALETTE.textMuted }]}
        selectable={selectable}
        maxFontSizeMultiplier={CAP}
      >
        {v}
      </Text>
    </View>
  );
}

/* ================================================================ styles */

const b = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },

  cardShadow: {
    borderRadius: 22,
    backgroundColor: PALETTE.white,
    shadowColor: BRAND.shadowNavy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 4,
  },
  cardInner: { borderRadius: 22, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', overflow: 'hidden' },
  cardPad: { padding: SPACE.lg },

  glyphSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '48%', backgroundColor: 'rgba(255,255,255,0.14)' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: SIZE.row + 8, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg },
  linkDivider: { borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  linkTitle: { ...TYPE.subheading },
  linkSub: { ...TYPE.caption, marginTop: 2 },
  linkBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: PALETTE.red, alignItems: 'center', justifyContent: 'center' },
  linkBadgeText: { color: PALETTE.white, fontSize: 11, lineHeight: 14, fontWeight: '800' },

  groupRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.md, marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  groupTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 22, flexShrink: 1 },
  groupCount: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center' },
  groupCountText: { fontSize: 12, lineHeight: 15, fontWeight: '800', color: PALETTE.blueDark, fontVariant: ['tabular-nums'] },
  groupSub: { ...TYPE.caption, marginTop: 2 },
  groupAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: SIZE.touch },
  groupActionText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.blue },

  tabsTrack: {
    flexDirection: 'row', gap: 4, padding: 4, marginHorizontal: SPACE.lg, borderRadius: 999, backgroundColor: PALETTE.white,
    borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 5,
  },
  tab: { flex: 1, minWidth: 0 },
  tabActive: { minHeight: 40, borderRadius: 999, paddingHorizontal: 6, justifyContent: 'center' },
  tabIdle: { minHeight: 40, borderRadius: 999, paddingHorizontal: 6, justifyContent: 'center' },
  tabInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabText: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: PALETTE.textSoft, flexShrink: 1 },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center' },
  tabCountText: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: PALETTE.blueDark, fontVariant: ['tabular-nums'] },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 50, borderRadius: 999, paddingLeft: SPACE.lg, paddingRight: SPACE.xs,
    backgroundColor: PALETTE.white, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, color: PALETTE.text, paddingVertical: 10 },
  searchClear: { width: SIZE.touch, height: SIZE.touch, alignItems: 'center', justifyContent: 'center' },

  dateShadow: { backgroundColor: PALETTE.white, shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 4 },
  dateTile: { overflow: 'hidden', backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  dateTop: { paddingVertical: 3, alignItems: 'center' },
  dateMonth: { fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 1.2, color: PALETTE.white },
  dateBody: { alignItems: 'center', paddingTop: 2, paddingBottom: 5 },
  dateDay: { fontSize: 22, lineHeight: 26, fontWeight: '800', color: BRAND.navy, fontVariant: ['tabular-nums'] },
  dateWeek: { fontSize: 9, lineHeight: 11, fontWeight: '700', letterSpacing: 0.8, color: PALETTE.textMuted },

  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seatText: { fontSize: 12, lineHeight: 16, fontWeight: '700', flexShrink: 1 },
  seatPct: { ...TYPE.caption, marginLeft: 'auto' },

  state: { alignItems: 'center', paddingHorizontal: SPACE.xl, paddingVertical: SPACE.xxxl },
  stateCompact: { paddingVertical: SPACE.xl },
  stateTitle: { ...TYPE.heading, fontSize: 17, textAlign: 'center', marginTop: SPACE.lg },
  stateText: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.xs, maxWidth: 320 },
  stateBtn: { marginTop: SPACE.xl, minWidth: 180 },
  stateSecondary: { marginTop: SPACE.sm, minHeight: SIZE.touch, justifyContent: 'center', paddingHorizontal: SPACE.md },
  stateSecondaryText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: PALETTE.blue },

  skelWrap: { paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingTop: SPACE.xs },
  skelCard: { backgroundColor: PALETTE.white, borderRadius: 22, padding: SPACE.lg, borderWidth: 1, borderColor: PALETTE.border },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },

  rLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.md, paddingVertical: 7 },
  rLabel: { ...TYPE.body, color: PALETTE.textMuted, flexShrink: 1 },
  rValue: { ...TYPE.bodyStrong, textAlign: 'right', flexShrink: 1, minWidth: 0, maxWidth: '62%' },
  rStrongLabel: { ...TYPE.subheading, color: PALETTE.text },
  rStrongValue: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: BRAND.navy, fontVariant: ['tabular-nums'] },
});

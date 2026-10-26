import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Skeleton, PALETTE, SPACE, RADIUS, SHADOW, SIZE, TYPE, GRADIENTS, PressableScale } from '../../../ui';

/**
 * Local building blocks shared by the two member dashboards (unpaid + paid)
 * and the profile screen. Everything here is visual only and built on the kit
 * tokens; nothing reads or writes data.
 *
 *   GradientPanel     a gradient card whose shadow lives on a wrapper (kit rule 6)
 *   OnGradientButton  the white pill action that sits on a gradient panel
 *   ProgressBar       thin track + fill, on light or on gradient backgrounds
 *   QuickGrid/Tile    the 2-up quick-action grid, equal heights per row
 *   DashboardSkeleton first-load placeholder shaped like a dashboard
 */

/* ------------------------------------------------------------ GradientPanel */

export function GradientPanel({
  colors = GRADIENTS.member, children, style, lifted = false, padding = SPACE.xl, decorate = true,
}: {
  colors?: string[];
  children: React.ReactNode;
  /** Margins only — the panel owns its padding. */
  style?: StyleProp<ViewStyle>;
  lifted?: boolean;
  padding?: number;
  /** The two soft light blobs in the corners. */
  decorate?: boolean;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const grad = colors && colors.length >= 2 ? colors : GRADIENTS.member;
  return (
    // Shadow on the unclipped wrapper; the clipped gradient inside it (iOS drops a shadow on overflow:hidden).
    <View style={[k.panelWrap, lifted ? SHADOW.lifted : SHADOW.card, { backgroundColor: grad[0], shadowColor: grad[grad.length - 1] }, style]}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[k.panel, { padding }]}>
        {decorate ? <View style={k.blob1} /> : null}
        {decorate ? <View style={k.blob2} /> : null}
        {children}
      </LinearGradient>
    </View>
  );
}

/** Eyebrow / title / body text styles for content on a GradientPanel. */
export const onGradient = StyleSheet.create({
  eyebrow: { ...TYPE.eyebrow, color: 'rgba(255,255,255,0.72)' },
  title: { ...TYPE.title, color: PALETTE.white, marginTop: SPACE.xs },
  body: { ...TYPE.body, color: 'rgba(255,255,255,0.86)', marginTop: SPACE.sm },
  caption: { ...TYPE.caption, color: 'rgba(255,255,255,0.72)' },
});

/* ------------------------------------------------------------ OnGradientButton */

export function OnGradientButton({ label, icon = 'arrow-forward', onPress, color = PALETTE.blueDeep, style, bg = PALETTE.white }: {
  label: string; icon?: string; onPress?: () => void; color?: string; style?: StyleProp<ViewStyle>; bg?: string;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={style} contentStyle={[k.onBtn, { backgroundColor: bg }]}>
      <Text style={[k.onBtnText, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
      {icon ? <Icon name={icon} size={18} color={color} /> : null}
    </PressableScale>
  );
}

/* ------------------------------------------------------------ ProgressBar */

export function ProgressBar({ percent, onDark = false, color = PALETTE.blue, style }: {
  percent: number; onDark?: boolean; color?: string; style?: StyleProp<ViewStyle>;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const p = Math.max(0, Math.min(100, Number(percent || 0)));
  return (
    <View
      style={[k.track, { backgroundColor: onDark ? 'rgba(255,255,255,0.22)' : PALETTE.field }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: p }}
    >
      <View style={[k.fill, { width: `${p}%`, backgroundColor: onDark ? PALETTE.white : color }]} />
    </View>
  );
}

/* ------------------------------------------------------------ Quick actions */

export function QuickGrid({ children }: { children: React.ReactNode }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  return <View style={k.grid}>{children}</View>;
}

export function QuickTile({ icon, label, detail, color, bg, onPress }: {
  icon: string; label: string; detail?: string; color: string; bg: string; onPress: () => void;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={k.tileCell}>
      <Pressable onPress={onPress} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={detail ? `${label}, ${detail}` : label}>
        {({ pressed }) => (
          <View style={[k.tile, SHADOW.card, pressed && k.pressed]}>
            <View style={k.tileHead}>
              <View style={[k.tileIcon, { backgroundColor: bg }]}><Icon name={icon} size={SIZE.icon + 2} color={color} /></View>
              <Icon name="arrow-outward" size={16} color={PALETTE.textFaint} />
            </View>
            <Text style={k.tileLabel} numberOfLines={2} maxFontSizeMultiplier={1.3}>{label}</Text>
            {detail ? <Text style={k.tileDetail} numberOfLines={1} maxFontSizeMultiplier={1.3}>{detail}</Text> : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------ Icon chip */

export function IconChip({ icon, color = PALETTE.blue, bg = PALETTE.blueSoft, size = SIZE.iconChip }: {
  icon: string; color?: string; bg?: string; size?: number;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  return (
    <View style={[k.chip, { width: size, height: size, backgroundColor: bg }]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

/* ------------------------------------------------------------ Skeleton */

export function DashboardSkeleton() {
  const k = useLegacyAppearance(legacyAppearance_k);
  return (
    <View accessibilityLabel="Loading your dashboard" accessibilityRole="progressbar">
      <View style={k.skHeader}>
        <Skeleton width={SIZE.touch} height={SIZE.touch} radius={SIZE.touch / 2} />
        <View style={{ flex: 1, gap: SPACE.sm }}>
          <Skeleton width="40%" height={11} />
          <Skeleton width="70%" height={18} />
        </View>
        <Skeleton width={SIZE.touch} height={SIZE.touch} radius={SIZE.touch / 2} />
      </View>
      <View style={{ paddingHorizontal: SPACE.lg }}>
        <Skeleton width="100%" height={196} radius={RADIUS.xl} />
      </View>
      <View style={[k.grid, { marginTop: SPACE.xl }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={k.tileCell}>
            <Skeleton width="100%" height={116} radius={RADIUS.lg} />
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}>
        <Skeleton width="45%" height={16} />
        <Skeleton width="100%" height={72} radius={RADIUS.lg} />
        <Skeleton width="100%" height={72} radius={RADIUS.lg} />
      </View>
    </View>
  );
}

const k = StyleSheet.create({
  panelWrap: { marginHorizontal: SPACE.lg, borderRadius: RADIUS.xl },
  panel: { borderRadius: RADIUS.xl, overflow: 'hidden' },
  blob1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 },
  blob2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -60, left: -40 },

  onBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, minHeight: SIZE.control, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.xl },
  onBtnText: { fontSize: 15, lineHeight: 20, fontWeight: '700', flexShrink: 1 },

  track: { height: 8, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: RADIUS.pill },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', paddingHorizontal: SPACE.lg },
  tileCell: { width: '48.5%', marginBottom: SPACE.md },
  tile: { flex: 1, minHeight: 116, padding: SPACE.lg, backgroundColor: PALETTE.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: PALETTE.border },
  tileHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACE.md },
  tileIcon: { width: SIZE.iconChip + 4, height: SIZE.iconChip + 4, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { ...TYPE.bodyStrong },
  tileDetail: { ...TYPE.caption, marginTop: SPACE.xxs },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  chip: { borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },

  skHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, marginBottom: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_k = k;
const legacyAppearance_PALETTE = PALETTE;

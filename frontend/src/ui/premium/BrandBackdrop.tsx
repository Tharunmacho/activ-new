import { useLegacyAppearance } from '../legacyAppearance';
import { useAppTheme } from '../AppTheme';
import React, { memo, useMemo } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { PALETTE, Tone } from '../tokens';
import { useLoop } from './motion';

/**
 * ============================================================================
 * BRAND BACKDROP / WAVE HEADER
 * ============================================================================
 *
 * The deep navy→blue gradient that tops a premium screen: soft glow orbs, a
 * faint dot grid, and three layered SVG waves at the bottom edge that curve
 * into the light content area (the front wave is painted in `waveColor`, the
 * canvas colour below, so the join is seamless).
 *
 * Motion: the waves drift sideways and the top glow breathes — native-driver
 * transforms only, so nothing re-renders. Off under reduce-motion.
 *
 * The SVG is memoised per width, so a keystroke in a form below never
 * rebuilds a path.
 */

/**
 * A seamless wave, `cycles` whole periods per `period` px, drawn across three
 * periods so a -period translate loops without a seam.
 * Quadratic + smooth-continuation (`T`) segments reflect the control point,
 * so crests and troughs alternate by themselves.
 */
function wavePath(period: number, height: number, baseline: number, amp: number, cycles: number) {
  const half = period / cycles / 2;
  const total = period * 3;
  let d = `M0 ${baseline} Q ${half / 2} ${baseline - amp * 2} ${half} ${baseline}`;
  for (let x = half * 2; x <= total + 0.5; x += half) d += ` T ${x} ${baseline}`;
  d += ` V ${height} H 0 Z`;
  return d;
}

type Layer = { color: string; opacity: number; amp: number; baseline: number; cycles: number; duration: number; phase: number; reverse?: boolean };

const WaveLayer = memo(function WaveLayer({ width, height, layer, animated }: {
  width: number; height: number; layer: Layer; animated: boolean;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const t = useLoop({ duration: layer.duration, enabled: animated });
  const d = useMemo(
    () => wavePath(width, height, layer.baseline, layer.amp, layer.cycles),
    [width, height, layer.baseline, layer.amp, layer.cycles],
  );
  const start = -layer.phase * width;
  const translateX = t.interpolate({
    inputRange: [0, 1],
    outputRange: layer.reverse ? [start - width, start] : [start, start - width],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.layer, { width: width * 3, height, transform: [{ translateX }] }]}
    >
      <Svg width={width * 3} height={height}>
        <Path d={d} fill={layer.color} fillOpacity={layer.opacity} />
      </Svg>
    </Animated.View>
  );
});

/** The three waves along the bottom edge. `color` is the canvas they curve into. */
export const WaveBand = memo(function WaveBand({ height = 56, color = PALETTE.canvas, glow, animated = true }: {
  height?: number; color?: string; glow?: string; animated?: boolean;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const { width } = useWindowDimensions();
  const w = Math.max(320, Math.round(width || 360));
  const layers: Layer[] = useMemo(() => [
    { color: '#FFFFFF', opacity: 0.10, amp: 9, baseline: height * 0.34, cycles: 1, duration: 16000, phase: 0 },
    { color: glow || '#93C5FD', opacity: 0.22, amp: 7, baseline: height * 0.50, cycles: 2, duration: 12000, phase: 0.35, reverse: true },
    { color, opacity: 1, amp: 6, baseline: height * 0.72, cycles: 1, duration: 22000, phase: 0.6 },
  ], [height, color, glow]);
  return (
    <View pointerEvents="none" style={[s.band, { height }]}>
      {layers.map((layer, i) => (
        <WaveLayer key={i} width={w} height={height} layer={layer} animated={animated} />
      ))}
    </View>
  );
});

/** Glow orbs, dot grid and a hairline ring — the header's texture. Static except a slow breath. */
const BackdropDecor = memo(function BackdropDecor({ glow, animated }: { glow: string; animated: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const { width } = useWindowDimensions();
  const w = Math.max(320, Math.round(width || 360));
  const breath = useLoop({ duration: 7000, pingPong: true, enabled: animated });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Top-right orb (breathes) */}
      <Animated.View style={[s.orbTopRight, { left: w - 190, transform: [{ scale }], opacity }]}>
        <Svg width={320} height={320}>
          <Defs>
            <RadialGradient id="orbA" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.06} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={160} cy={160} r={160} fill="url(#orbA)" />
        </Svg>
      </Animated.View>

      {/* Bottom-left coloured orb + dot grid + ring (static) */}
      <Svg width={w} height={420} style={s.decorSvg}>
        <Defs>
          <RadialGradient id="orbB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={0.35} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
          <Pattern id="dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1.3" fill="#FFFFFF" />
          </Pattern>
        </Defs>
        <Circle cx={-10} cy={250} r={170} fill="url(#orbB)" />
        <Rect x={w * 0.58} y={0} width={w * 0.42} height={150} fill="url(#dots)" opacity={0.10} />
        <Circle cx={-30} cy={40} r={110} stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={1.5} fill="none" />
        <Circle cx={-30} cy={40} r={150} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={1} fill="none" />
      </Svg>
    </View>
  );
});

/**
 * The gradient header. Children are laid out inside it (pass your own
 * padding via `contentStyle`); the waves take `waveHeight` px at the bottom.
 */
export function BrandBackdrop({
  tone = 'member', children, minHeight, waveColor = PALETTE.canvas, waveHeight = 56,
  animated = true, decor = true, style, contentStyle,
}: {
  tone?: Tone;
  children?: React.ReactNode;
  minHeight?: number;
  /** The colour of the content area the front wave curves into. */
  waveColor?: string;
  waveHeight?: number;
  animated?: boolean;
  decor?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const { premiumTone: themedPremiumTone } = useAppTheme();
  const p = themedPremiumTone(tone);
  return (
    <View style={[s.wrap, { minHeight, paddingBottom: waveHeight }, style]}>
      <LinearGradient
        colors={p.header}
        locations={p.header.length === 4 ? [0, 0.38, 0.72, 1] : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {decor ? <BackdropDecor glow={p.glow} animated={animated} /> : null}
      <View style={contentStyle}>{children}</View>
      <WaveBand height={waveHeight} color={waveColor} glow={p.glow} animated={animated} />
    </View>
  );
}

/** Alias — the header use of the backdrop. */
export const WaveHeader = BrandBackdrop;

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', position: 'relative' },
  layer: { position: 'absolute', left: 0, top: 0 },
  decorSvg: { position: 'absolute', left: 0, top: 0 },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  orbTopRight: { position: 'absolute', top: -150, width: 320, height: 320 },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;

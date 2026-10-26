import { AppTheme, useAppTheme, useThemeStyles } from '../AppTheme';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SIZE, SPACE, Tone } from '../tokens';
import { PressableScale, prefersReducedMotion } from './motion';


/**
 * ============================================================================
 * PREMIUM LAYER — data visualisation
 * ============================================================================
 *
 *   CountUpText ........... a number that counts up to its value on mount / change
 *   MetricTile ....... stat tile: gradient icon chip + count-up figure + label
 *   MetricGrid ... two (or three) tiles a row, equal heights
 *   GrowBar ....... a horizontal bar that grows to its share (native driver)
 *   RingGauge ......... an SVG ring that sweeps to its share, centre label
 *
 * All motion is skipped under reduce-motion and Jest (values land instantly).
 * Numbers are tabular so columns line up.
 */

const CAP = 1.3;

const finite = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const formatIndianCount = (n: number) => {
  try {
    return Math.round(finite(n)).toLocaleString('en-IN');
  } catch {
    return String(Math.round(finite(n)));
  }
};

/** Counts from the previous value to `value` with an ease-out. */
export function CountUpText({ value, duration = 900, delay = 0, format = formatIndianCount, style, numberOfLines = 1 }: {
  value: number;
  duration?: number;
  delay?: number;
  /** Turns the running number into text (default: Indian grouping, rounded). */
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const target = finite(value);
  const [shown, setShown] = useState(prefersReducedMotion() ? target : 0);
  const fromRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target);
      fromRef.current = target;
      return undefined;
    }
    const from = fromRef.current;
    if (from === target) return undefined;
    let raf = 0;
    let start = 0;
    const ms = Math.max(200, Number(duration || 0));
    const timer = setTimeout(() => {
      const step = (t: number) => {
        if (!start) start = t;
        const k = Math.min(1, (t - start) / ms);
        const eased = 1 - Math.pow(1 - k, 3);
        const next = from + (target - from) * eased;
        setShown(next);
        fromRef.current = next;
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, Math.max(0, Number(delay || 0)));
    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      // Never leave a half-counted figure behind.
      fromRef.current = target;
    };
  }, [target, duration, delay]);

  let text = '';
  try { text = format(shown); } catch { text = String(Math.round(shown)); }
  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      maxFontSizeMultiplier={CAP}
      accessibilityLabel={(() => { try { return format(target); } catch { return String(target); } })()}
    >
      {text}
    </Text>
  );
}

/* ================================================================ stat tile */

const StatColumns = React.createContext<2 | 3>(2);

export function MetricGrid({ children, columns = 2, style }: {
  children: React.ReactNode; columns?: 2 | 3; style?: StyleProp<ViewStyle>;
}) {
  const s = useThemeStyles(makeStyles);
  return (
    <StatColumns.Provider value={columns}>
      <View style={[s.grid, style]}>{children}</View>
    </StatColumns.Provider>
  );
}

/**
 * White tile, gradient icon chip, a figure that counts up. `colors` tints the
 * chip (defaults to the tone's button gradient); `format` for money.
 */
export function MetricTile({
  icon, label, value, hint, onPress, colors, format, tone = 'member', delay = 0, text,
}: {
  icon: string;
  label: string;
  value?: number;
  /** A non-numeric figure (e.g. a status word) instead of `value`. */
  text?: string;
  hint?: string;
  onPress?: () => void;
  colors?: string[];
  format?: (n: number) => string;
  tone?: Tone;
  delay?: number;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const cols = React.useContext(StatColumns);
  const p = premiumTone(tone);
  const chip = colors && colors.length > 1 ? colors : p.button;
  const inner = (
    <View style={[s.stat, { shadowColor: p.shadow }]}>
      <View style={s.statHead}>
        <LinearGradient colors={chip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.statIcon}>
          <Icon name={icon} size={SIZE.icon} color={PALETTE.white} />
        </LinearGradient>
        {onPress ? <Icon name="arrow-outward" size={16} color={PALETTE.textFaint} /> : null}
      </View>
      {typeof text === 'string' ? (
        <Text style={[s.statValue, cols === 3 && s.statValueSm]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={CAP}>{text || '—'}</Text>
      ) : (
        <CountUpText value={finite(value)} delay={delay} format={format} style={[s.statValue, cols === 3 && s.statValueSm]} />
      )}
      <Text style={s.statLabel} numberOfLines={2} maxFontSizeMultiplier={CAP}>{label}</Text>
      {hint ? <Text style={s.statHint} numberOfLines={1} maxFontSizeMultiplier={CAP}>{hint}</Text> : null}
    </View>
  );
  const width = cols === 3 ? '31.5%' : '48.5%';
  return (
    <View style={[s.cell, { width }]}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          style={s.flex}
          contentStyle={s.flex}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${typeof text === 'string' ? text : formatIndianCount(finite(value))}`}
        >
          {inner}
        </PressableScale>
      ) : (
        <View style={s.flex} accessible accessibilityLabel={`${label}: ${typeof text === 'string' ? text : formatIndianCount(finite(value))}`}>{inner}</View>
      )}
    </View>
  );
}

/* ================================================================ bar */

/**
 * A rounded bar that grows from 0 to `progress` (0–1). The fill is a
 * gradient inside a clipped track, moved by translateX on the native driver.
 */
export function GrowBar({ progress, colors, trackColor, height = 8, delay = 0, style }: {
  progress: number;
  colors?: string[];
  trackColor?: string;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const target = Math.max(0, Math.min(1, finite(progress)));
  const [width, setWidth] = useState(0);
  const v = useRef(new Animated.Value(prefersReducedMotion() ? target : 0)).current;

  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: target,
      duration: prefersReducedMotion() ? 0 : 800,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [target, delay, v]);

  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  const fill = colors && colors.length > 1 ? colors : [PALETTE.blue, PALETTE.blueDark];
  return (
    <View
      style={[{ height, borderRadius: height / 2, backgroundColor: trackColor ?? PALETTE.divider, overflow: 'hidden' }, style]}
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e?.nativeEvent?.layout?.width || 0))}
    >
      {width > 0 ? (
        <Animated.View style={{ width, height, transform: [{ translateX }] }}>
          <LinearGradient colors={fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width, height, borderRadius: height / 2 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ================================================================ ring */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
let ringSeq = 0;

/**
 * An SVG ring that sweeps to `progress` (0–1) with a gradient stroke and a
 * centred label. The sweep animates strokeDashoffset once (JS driver, ~0.9s).
 */
export function RingGauge({ progress, size = 112, stroke = 12, colors, label, value, trackColor, delay = 0 }: {
  progress: number;
  size?: number;
  stroke?: number;
  colors?: string[];
  /** Small caption under the centre value. */
  label?: string;
  /** Centre text (defaults to the percentage). */
  value?: string;
  trackColor?: string;
  delay?: number;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const idRef = useRef(`ring${(ringSeq += 1)}`);
  const target = Math.max(0, Math.min(1, finite(progress)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useRef(new Animated.Value(prefersReducedMotion() ? target : 0)).current;

  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: target,
      duration: prefersReducedMotion() ? 0 : 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [target, delay, v]);

  const dashOffset = v.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });
  const stops = colors && colors.length > 1 ? colors : [PALETTE.blueDark, '#60A5FA'];
  const center = value ?? `${Math.round(target * 100)}%`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`${label || ''} ${center}`.trim()}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={idRef.current} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="1" stopColor={stops[stops.length - 1]} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? PALETTE.divider} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${idRef.current})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset as any}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={s.ringValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.2}>{center}</Text>
      {label ? <Text style={s.ringLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text> : null}
    </View>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', paddingHorizontal: SPACE.lg },
  cell: { marginBottom: SPACE.md },
  stat: {
    flex: 1,
    minHeight: 128,
    padding: SPACE.lg,
    borderRadius: 20,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  statHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACE.md },
  statIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statValue: { ...TYPE.number, fontSize: 26, lineHeight: 32 },
  statValueSm: { fontSize: 20, lineHeight: 26 },
  statLabel: { ...TYPE.label, color: PALETTE.textSoft, marginTop: 2 },
  statHint: { ...TYPE.caption, marginTop: 2 },
  ringValue: { ...TYPE.number, fontSize: 22, lineHeight: 28, maxWidth: '70%', textAlign: 'center' },
  ringLabel: { ...TYPE.caption, fontSize: 11, lineHeight: 14, maxWidth: '72%', textAlign: 'center' },
});

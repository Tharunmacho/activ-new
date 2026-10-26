import { useLegacyAppearance } from '../legacyAppearance';
import { useAppTheme } from '../AppTheme';
import { AppearanceToggle } from '../AppearanceToggle';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Svg, { Circle } from 'react-native-svg';
import { GRADIENTS, PALETTE, RADIUS, SIZE, SPACE, TYPE } from '../tokens';
import { BRAND, PREMIUM_TYPE, premiumTone } from './theme';
import { BrandBackdrop } from './BrandBackdrop';
import { FloatingIllustration } from './illustrations';
import { FadeInUp, PressableScale, prefersReducedMotion, useLoop, useReduceMotion } from './motion';
import { GlassIconButton, PremiumInput } from './controls';
import { AdminCloudOff3D, AdminEmptyTray3D } from './adminArt';

/**
 * ============================================================================
 * ADMIN CONSOLE — the premium admin layer (Block · District · State · Super)
 * ============================================================================
 *
 *   <ConsoleFrame footer={…}>                     status bar, scrim, canvas
 *     <FlatList                                   (or ScrollView)
 *       contentContainerStyle={CONSOLE_LIST}
 *       ListHeaderComponent={<>
 *         <ConsoleHeader eyebrow title subtitle art={<BlockVillage3D/>}
 *           left={<GlassIconButton…/>} right={<GradientAvatar…/>} badges={[…]} />
 *         <ConsoleGrid overlap>…<ConsoleStatTile/>…</ConsoleGrid>
 *       </>} />
 *   </ConsoleFrame>
 *
 * The header is the admin-indigo wave header of the sign-in screen, scrolling
 * with the content (it applies the top inset itself — never nest a
 * SafeAreaView, Rule 4). A scrim keeps anything from sliding under the clock.
 *
 * Everything here is presentational: no API calls, no payloads.
 */

const CAP = 1.3;
const ADMIN = premiumTone('admin');
export const CONSOLE_CANVAS = PALETTE.canvasAdmin;
/** Pull this much of the first body block up over the header's waves. */
export const CONSOLE_OVERLAP = 30;

/** contentContainerStyle for a console list — the canvas must paint the content. */
export const CONSOLE_LIST: ViewStyle = { flexGrow: 1, backgroundColor: CONSOLE_CANVAS, paddingBottom: SPACE.huge + SPACE.xl };

/* ===================================================================== frame */

/**
 * The page shell for a console screen whose own list/scroll view holds the
 * ConsoleHeader. Light status icons, the indigo painted behind an iOS
 * over-scroll, and a status-bar scrim once the header has scrolled away.
 */
export function ConsoleFrame({ children, footer, style, avoidKeyboard }: {
  children: React.ReactNode; footer?: React.ReactNode; style?: StyleProp<ViewStyle>;
  /** Lift content + footer above the keyboard on iOS (Android resizes natively). */
  avoidKeyboard?: boolean;
}) {
  const f = useLegacyAppearance(legacyAppearance_f);
  const { palette, premiumTone: themedPremiumTone } = useAppTheme();
  const CONSOLE_CANVAS = palette.canvasAdmin;
  const ADMIN = themedPremiumTone('admin');
  const insets = useSafeAreaInsets();
  const top = Number(insets?.top || 0);
  return (
    <View style={[f.flex, { backgroundColor: CONSOLE_CANVAS }, style]}>
      <StatusBar barStyle="light-content" />
      <View pointerEvents="none" style={[f.overscroll, { backgroundColor: ADMIN.top }]} />
      {avoidKeyboard && Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={f.flex} behavior="padding">
          <View style={f.flex}>{children}</View>
          {footer || null}
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={f.flex}>{children}</View>
          {footer || null}
        </>
      )}
      {top > 0 ? <View pointerEvents="none" style={[f.scrim, { height: top, backgroundColor: ADMIN.top }]} /> : null}
    </View>
  );
}

/** A console page that is one scroll view (dashboards, settings, forms). */
export function ConsoleScroll({ children, footer, refreshControl, keyboardShouldPersistTaps = 'handled', avoidKeyboard }: {
  children: React.ReactNode; footer?: React.ReactNode; refreshControl?: React.ReactElement<any>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled'; avoidKeyboard?: boolean;
}) {
  const f = useLegacyAppearance(legacyAppearance_f);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  return (
    <ConsoleFrame footer={footer} avoidKeyboard={avoidKeyboard}>
      <ScrollView
        style={f.flex}
        contentContainerStyle={[CONSOLE_LIST, footer ? { paddingBottom: SPACE.xl } : null]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </ConsoleFrame>
  );
}

/* ===================================================================== header */

/**
 * The indigo wave header. `left` / `right` sit in the top row (glass buttons,
 * an avatar); the heading and the floating art share the hero row; `badges`
 * are glass pills under the heading; `children` render last (search, tabs).
 */
export function ConsoleHeader({
  eyebrow, title, subtitle, left, right, art, badges, children, waveHeight = 58, compact, topCenter,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Original SVG art — floated beside the heading. */
  art?: React.ReactNode;
  badges?: { icon?: string; label: string }[];
  children?: React.ReactNode;
  waveHeight?: number;
  /** A shorter header for drill-down levels and forms. */
  compact?: boolean;
  /** Small caption between left and right in the top row (e.g. "Super Admin"). */
  topCenter?: string;
}) {
  const { palette } = useAppTheme();
  const CONSOLE_CANVAS = palette.canvasAdmin;
  const h = useLegacyAppearance(legacyAppearance_h);
  const f = useLegacyAppearance(legacyAppearance_f);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const insets = useSafeAreaInsets();
  const top = Number(insets?.top || 0);
  const artSize = compact ? 84 : 104;
  const pills = (badges || []).filter((b) => !!String(b?.label || '').trim());
  return (
    <BrandBackdrop
      tone="admin"
      waveColor={CONSOLE_CANVAS}
      waveHeight={waveHeight}
      contentStyle={{ paddingTop: top + SPACE.sm, paddingHorizontal: SPACE.lg }}
    >
      {left || right || topCenter ? (
        <FadeInUp distance={8} style={h.topRow}>
          <View style={h.side}>{left || null}</View>
          {topCenter ? <Text style={h.topCenter} maxFontSizeMultiplier={CAP}>{topCenter}</Text> : <View style={f.flex} />}
          <View style={[h.side, h.sideRight]}><AppearanceToggle glass />{right || null}</View>
        </FadeInUp>
      ) : null}
      <View style={[h.heroRow, compact && h.heroRowCompact]}>
        <FadeInUp delay={60} style={h.heroText}>
          {eyebrow ? <Text style={h.eyebrow} maxFontSizeMultiplier={CAP}>{eyebrow}</Text> : null}
          <Text
            style={[compact ? h.titleCompact : h.title]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.25}
          >
            {String(title || '')}
          </Text>
          {subtitle ? <Text style={h.subtitle} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
        </FadeInUp>
        {art ? (
          <FadeInUp delay={140} scaleFrom={0.85} distance={10}>
            <FloatingIllustration size={artSize}>{art}</FloatingIllustration>
          </FadeInUp>
        ) : null}
      </View>
      {pills.length ? (
        <FadeInUp delay={180} style={h.badges}>
          {pills.map((b, i) => (
            <View key={`${b.label}-${i}`} style={[h.badge, i === pills.length - 1 && h.badgeLast]}>
              {b.icon ? <Icon name={b.icon} size={14} color={PALETTE.white} /> : null}
              <Text style={h.badgeText} numberOfLines={1} maxFontSizeMultiplier={CAP}>{b.label}</Text>
            </View>
          ))}
        </FadeInUp>
      ) : null}
      {children ? <View style={h.children}>{children}</View> : null}
    </BrandBackdrop>
  );
}

/** A glass back/menu button for the header's top row. */
export function ConsoleGlassButton({ icon, onPress, label }: { icon: string; onPress: () => void; label: string }) {
  return <GlassIconButton icon={icon} onPress={onPress} accessibilityLabel={label} />;
}

/** "Good morning" / afternoon / evening, by the phone's clock. */
export const consoleGreeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ===================================================================== count-up */

/**
 * A number that counts up to `value` (ease-out, ~0.9 s). Plain text under
 * reduce-motion, and when the value is not a finite number ("…", "—").
 */
export function ConsoleCountUp({ value, style, duration = 900, format }: {
  value: number | string; style?: StyleProp<TextStyle>; duration?: number; format?: (n: number) => string;
}) {
  const target = typeof value === 'number' ? value : Number(value);
  const numeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(target));
  const [shown, setShown] = useState<number>(numeric && prefersReducedMotion() ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!numeric || !Number.isFinite(target)) return undefined;
    if (prefersReducedMotion()) { setShown(target); from.current = target; return undefined; }
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / Math.max(200, duration));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, numeric, duration]);
  const text = !numeric ? String(value ?? '') : format ? format(shown) : String(shown);
  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.2}>{text}</Text>;
}

/* ===================================================================== stat tiles */

export type ConsoleAccent = 'indigo' | 'amber' | 'green' | 'red' | 'sky' | 'slate' | 'gold';

export const CONSOLE_ACCENTS: Record<ConsoleAccent, { grad: string[]; fg: string; soft: string }> = {
  indigo: { grad: [BRAND.indigoDark, BRAND.indigo, '#7C6CF0'], fg: PALETTE.indigo, soft: PALETTE.indigoSoft },
  amber: { grad: ['#B45309', '#F59E0B', '#FBBF24'], fg: PALETTE.amberDark, soft: PALETTE.amberSoft },
  green: { grad: ['#047857', '#10B981', '#34D399'], fg: PALETTE.greenDark, soft: PALETTE.greenSoft },
  red: { grad: ['#B91C1C', '#EF4444', '#F87171'], fg: PALETTE.redDark, soft: PALETTE.redSoft },
  sky: { grad: ['#075985', '#0284C7', '#38BDF8'], fg: PALETTE.skyDark, soft: PALETTE.skySoft },
  slate: { grad: ['#334155', '#64748B', '#94A3B8'], fg: PALETTE.textSoft, soft: PALETTE.divider },
  gold: { grad: GRADIENTS.gold, fg: PALETTE.goldDark, soft: PALETTE.goldSoft },
};

/**
 * A stat tile: gradient icon chip, a counted-up figure, label and hint. When
 * `selected` it takes its accent as a border and wash (tiles that filter).
 */
export function ConsoleStatTile({ label, value, icon, accent = 'indigo', hint, onPress, selected, delay = 0 }: {
  label: string; value: number | string; icon: string; accent?: ConsoleAccent; hint?: string;
  onPress?: () => void; selected?: boolean; delay?: number;
}) {
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const t = useLegacyAppearance(legacyAppearance_t);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const f = useLegacyAppearance(legacyAppearance_f);
  const a = CONSOLE_ACCENTS[accent] || CONSOLE_ACCENTS.indigo;
  const body = (
    <View style={t.tileShadow}>
    <View style={[t.tile, selected && { borderColor: a.fg, backgroundColor: a.soft }]}>
      <View pointerEvents="none" style={[t.glow, { backgroundColor: a.soft }]} />
      <View style={t.head}>
        <LinearGradient colors={a.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={t.icon}>
          <Icon name={icon} size={20} color={PALETTE.white} />
        </LinearGradient>
        {selected ? <Icon name="check-circle" size={18} color={a.fg} /> : onPress ? <Icon name="north-east" size={16} color={PALETTE.textFaint} /> : null}
      </View>
      <ConsoleCountUp value={value} style={[t.value, { color: selected ? a.fg : PALETTE.text }]} />
      <Text style={t.label} numberOfLines={1} maxFontSizeMultiplier={CAP}>{label}</Text>
      {hint ? <Text style={t.hint} numberOfLines={2} maxFontSizeMultiplier={CAP}>{hint}</Text> : null}
    </View>
    </View>
  );
  return (
    <FadeInUp delay={delay} style={t.cell}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          style={f.flex}
          contentStyle={f.flex}
          accessibilityRole="button"
          accessibilityState={{ selected: !!selected }}
          accessibilityLabel={`${label}: ${String(value)}`}
        >
          {body}
        </PressableScale>
      ) : body}
    </FadeInUp>
  );
}

/** Two tiles per row on the gutter. `overlap` pulls the grid up over the waves. */
export function ConsoleGrid({ children, overlap, style }: { children: React.ReactNode; overlap?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useLegacyAppearance(legacyAppearance_t);
  return <View style={[t.grid, overlap && { marginTop: -CONSOLE_OVERLAP }, style]}>{children}</View>;
}

/* ===================================================================== surfaces */

/** The console card: white, 20 radius, soft indigo shadow. Pressable when given onPress. */
export function ConsoleCard({ children, style, onPress, padded = true, accessibilityLabel, accent }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean;
  accessibilityLabel?: string;
  /** A coloured stripe down the left edge (status). */
  accent?: string;
}) {
  const c = useLegacyAppearance(legacyAppearance_c);
  const inner = (
    <View style={[c.card, padded && c.padded, accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null]}>
      {children}
    </View>
  );
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <PressableScale onPress={onPress} style={style} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {inner}
    </PressableScale>
  );
}

/** Section heading on the gutter: optional gradient icon, subtitle and a text action. */
export function ConsoleSectionTitle({ title, subtitle, icon, action, onAction, style }: {
  title: string; subtitle?: string; icon?: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const c = useLegacyAppearance(legacyAppearance_c);
  const ADMIN = useLegacyAppearance(legacyAppearance_ADMIN);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={[c.sectionRow, style]}>
      {icon ? (
        <LinearGradient colors={ADMIN.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={c.sectionIcon}>
          <Icon name={icon} size={16} color={PALETTE.white} />
        </LinearGradient>
      ) : null}
      <View style={c.sectionText}>
        <Text style={c.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{title}</Text>
        {subtitle ? <Text style={c.sectionSub} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} style={c.sectionAction} accessibilityRole="button" hitSlop={8}>
          <Text style={c.sectionActionText} maxFontSizeMultiplier={CAP}>{action}</Text>
          <Icon name="chevron-right" size={18} color={PALETTE.indigo} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A soft note with an icon — an explanation, not an alert. */
export function ConsoleNote({ icon = 'info-outline', text, kind = 'indigo', style, action, onAction }: {
  icon?: string; text: string; kind?: ConsoleAccent; style?: StyleProp<ViewStyle>; action?: string; onAction?: () => void;
}) {
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const c = useLegacyAppearance(legacyAppearance_c);
  const f = useLegacyAppearance(legacyAppearance_f);
  const a = CONSOLE_ACCENTS[kind] || CONSOLE_ACCENTS.indigo;
  return (
    <View style={[c.note, { backgroundColor: a.soft }, style]}>
      <Icon name={icon} size={17} color={a.fg} style={c.noteIcon} />
      <View style={f.flexText}>
        <Text style={[c.noteText, { color: a.fg }]} maxFontSizeMultiplier={CAP}>{text}</Text>
        {action && onAction ? (
          <TouchableOpacity onPress={onAction} accessibilityRole="button" hitSlop={8} style={c.noteAction}>
            <Text style={[c.noteActionText, { color: a.fg }]} maxFontSizeMultiplier={CAP}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/* ===================================================================== chips & buttons */

export type ConsoleChipKind = 'pending' | 'approved' | 'rejected' | 'info' | 'neutral' | 'warning' | 'dark' | 'gold';

const CHIP: Record<ConsoleChipKind, { fg: string; bg: string }> = {
  pending: { fg: PALETTE.amberDark, bg: PALETTE.amberSoft },
  warning: { fg: PALETTE.amberDark, bg: PALETTE.amberSoft },
  approved: { fg: PALETTE.greenDark, bg: PALETTE.greenSoft },
  rejected: { fg: PALETTE.redDark, bg: PALETTE.redSoft },
  info: { fg: PALETTE.indigoDark, bg: PALETTE.indigoSoft },
  neutral: { fg: PALETTE.textSoft, bg: PALETTE.divider },
  dark: { fg: PALETTE.white, bg: PALETTE.text },
  gold: { fg: PALETTE.goldDark, bg: PALETTE.goldSoft },
};

/** A status chip: soft fill, bold text, a dot or an icon. */
export function ConsoleChip({ label, kind = 'neutral', icon, dot = !icon, style }: {
  label: string; kind?: ConsoleChipKind; icon?: string; dot?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const CHIP = useLegacyAppearance(legacyAppearance_CHIP);
  const c = useLegacyAppearance(legacyAppearance_c);
  const k = CHIP[kind] || CHIP.neutral;
  return (
    <View style={[c.chip, { backgroundColor: k.bg }, style]}>
      {dot ? <View style={[c.chipDot, { backgroundColor: k.fg }]} /> : null}
      {icon ? <Icon name={icon} size={12} color={k.fg} /> : null}
      <Text style={[c.chipText, { color: k.fg }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{String(label || '')}</Text>
    </View>
  );
}

/** pending / approved / rejected, from any spelling. */
export const consoleStageKind = (stage?: string | null): ConsoleChipKind => {
  const s = String(stage || '').toLowerCase();
  if (s.includes('reject') || s === 'expired') return 'rejected';
  if (s.includes('approved') && !s.includes('pending')) return 'approved';
  if (s === 'active') return 'approved';
  return 'pending';
};

export type ConsoleButtonKind = 'primary' | 'approve' | 'danger' | 'dangerSolid' | 'soft' | 'ghost';

/** The console's action button. `approve` is the green gradient, `danger` a red outline. */
export function ConsoleButton({ label, icon, onPress, kind = 'primary', loading, disabled, size = 'md', style, accessibilityLabel }: {
  label: string; icon?: string; onPress?: () => void; kind?: ConsoleButtonKind; loading?: boolean; disabled?: boolean;
  size?: 'sm' | 'md'; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const ADMIN = useLegacyAppearance(legacyAppearance_ADMIN);
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const c = useLegacyAppearance(legacyAppearance_c);
  const off = !!disabled || !!loading;
  const height = size === 'sm' ? SIZE.controlSm + 2 : SIZE.control;
  const gradient = kind === 'primary' ? ADMIN.button : kind === 'approve' ? CONSOLE_ACCENTS.green.grad.slice(0, 2) : kind === 'dangerSolid' ? GRADIENTS.danger : null;
  const fg = gradient ? PALETTE.white : kind === 'danger' ? PALETTE.redDark : PALETTE.indigoDark;
  const content = (
    <View style={c.btnInner}>
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={size === 'sm' ? 17 : 19} color={fg} /> : null}
      <Text style={[c.btnText, size === 'sm' && c.btnTextSm, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{label}</Text>
    </View>
  );
  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      style={[style, off && c.btnOff]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: off, busy: !!loading }}
    >
      {gradient ? (
        <View style={[c.btnShadow, { shadowColor: kind === 'approve' ? PALETTE.greenDark : kind === 'dangerSolid' ? PALETTE.redDark : ADMIN.shadow }]}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={[c.btn, { height }]}>
            <View pointerEvents="none" style={c.btnSheen} />
            {content}
          </LinearGradient>
        </View>
      ) : (
        <View
          style={[
            c.btn,
            { height },
            kind === 'danger' && { borderWidth: 1.5, borderColor: PALETTE.red, backgroundColor: PALETTE.card },
            kind === 'soft' && { backgroundColor: PALETTE.indigoSoft },
            kind === 'ghost' && { backgroundColor: 'transparent' },
          ]}
        >
          {content}
        </View>
      )}
    </PressableScale>
  );
}

/** A small outlined action pill inside a card ("Remind now", "Block"). */
export function ConsolePill({ icon, label, onPress, color: customColor, disabled }: {
  icon: string; label: string; onPress?: () => void; color?: string; disabled?: boolean;
}) {
  const c = useLegacyAppearance(legacyAppearance_c);
  const { palette } = useAppTheme();
  const color = customColor || palette.indigoDark;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.95}
      style={disabled ? c.btnOff : undefined}
      contentStyle={[c.pill, { borderColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Icon name={icon} size={16} color={color} />
      <Text style={[c.pillText, { color }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{label}</Text>
    </PressableScale>
  );
}

/* ===================================================================== tabs */

/**
 * Pick-one tabs, premium. Up to four options: an equal-width track whose items
 * are `flex: 1` with a 4px gap, so Pending / Approved / Rejected / All sit side
 * by side on a 360dp phone (Rule 4); the figure sits above its label. More
 * than four (or `scrollable`): horizontally scrolling pills.
 */
export function ConsoleTabs<T extends string>({ options, value, onChange, scrollable, style }: {
  options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void;
  scrollable?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const tb = useLegacyAppearance(legacyAppearance_tb);
  const ADMIN = useLegacyAppearance(legacyAppearance_ADMIN);
  const list = options || [];
  const scroll = scrollable ?? list.length > 4;
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={tb.scrollRow} accessibilityRole="radiogroup">
        {list.map((o) => {
          const on = o.value === value;
          return (
            <PressableScale
              key={String(o.value) || 'all'}
              onPress={() => onChange(o.value)}
              scaleTo={0.95}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              accessibilityLabel={typeof o.count === 'number' ? `${o.label}, ${o.count}` : o.label}
            >
              {on ? (
                <LinearGradient colors={ADMIN.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tb.pill}>
                  <Text style={[tb.pillText, tb.onText]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{o.label}</Text>
                  {typeof o.count === 'number' ? <View style={[tb.pillCount, tb.pillCountOn]}><Text style={[tb.pillCountText, tb.onText]} maxFontSizeMultiplier={1}>{o.count > 999 ? '999+' : o.count}</Text></View> : null}
                </LinearGradient>
              ) : (
                <View style={[tb.pill, tb.pillOff]}>
                  <Text style={tb.pillText} numberOfLines={1} maxFontSizeMultiplier={CAP}>{o.label}</Text>
                  {typeof o.count === 'number' ? <View style={tb.pillCount}><Text style={tb.pillCountText} maxFontSizeMultiplier={1}>{o.count > 999 ? '999+' : o.count}</Text></View> : null}
                </View>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    );
  }
  const counted = list.some((o) => typeof o.count === 'number');
  return (
    <View style={[tb.wrap, style]} accessibilityRole="radiogroup">
      <View style={tb.track}>
        {list.map((o) => {
          const on = o.value === value;
          const inner = (
            <>
              {counted ? (
                <Text style={[tb.segCount, on && tb.onText]} numberOfLines={1} maxFontSizeMultiplier={1}>
                  {typeof o.count === 'number' ? (o.count > 999 ? '999+' : o.count) : '·'}
                </Text>
              ) : null}
              <Text style={[counted ? tb.segLabelSm : tb.segLabel, on && tb.onText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={CAP}>
                {o.label}
              </Text>
            </>
          );
          return (
            <TouchableOpacity
              key={String(o.value) || 'all'}
              onPress={() => onChange(o.value)}
              style={tb.segCell}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              accessibilityLabel={typeof o.count === 'number' ? `${o.label}, ${o.count}` : o.label}
            >
              {on ? (
                <LinearGradient colors={ADMIN.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[tb.seg, counted && tb.segTall]}>
                  {inner}
                </LinearGradient>
              ) : (
                <View style={[tb.seg, counted && tb.segTall]}>{inner}</View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ===================================================================== search */

/** The console search field (PremiumInput, admin tone) with a clear button. */
export function ConsoleSearch({ value, onChangeText, placeholder, style, onSubmitEditing }: {
  value: string; onChangeText: (v: string) => void; placeholder: string; style?: StyleProp<ViewStyle>;
  onSubmitEditing?: () => void;
}) {
  const c = useLegacyAppearance(legacyAppearance_c);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={[{ paddingHorizontal: SPACE.lg }, style]}>
      <PremiumInput
        tone="admin"
        icon="search"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        style={c.searchFlush}
        right={value ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Icon name="close" size={18} color={PALETTE.textFaint} />
          </TouchableOpacity>
        ) : undefined}
      />
    </View>
  );
}

/* ===================================================================== progress rail */

type Verdict = 'approved' | 'rejected' | 'pending';
const TIERS3 = ['block', 'district', 'state'] as const;
const TIER_WORD: Record<string, string> = { block: 'Block', district: 'District', state: 'State' };

const asVerdict = (v?: string | null): Verdict => {
  const s = String(v || '').toLowerCase();
  if (s.includes('reject')) return 'rejected';
  if (s.includes('approv')) return 'approved';
  return 'pending';
};

/**
 * The three verdicts of an application, Block → District → State. Read from
 * the server's `tierReviews` (list rows) or `reviews` (GET /applications/:id);
 * an older payload falls back to the *ApprovedAt stamps and `rejectedBy`.
 */
export const tierTrail = (app: any): { tier: string; decision: Verdict; at?: string | null; reason?: string }[] => {
  const src = app?.tierReviews || app?.reviews || null;
  const rejectedTier = String(app?.rejectedBy?.adminType || '').toLowerCase();
  return TIERS3.map((tier) => {
    const r = src && typeof src === 'object' ? src[tier] : null;
    if (r && typeof r === 'object' && r.decision) {
      return { tier, decision: asVerdict(r.decision), at: r.decidedAt || null, reason: String(r.reason || '') };
    }
    const at = app?.[`${tier}ApprovedAt`] || null;
    if (at) return { tier, decision: 'approved' as Verdict, at };
    if (rejectedTier.startsWith(tier)) return { tier, decision: 'rejected' as Verdict, at: app?.rejectedBy?.rejectedAt || null };
    return { tier, decision: 'pending' as Verdict, at: null };
  });
};

const shortDay = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

/**
 * Block → District → State, as three nodes on a rail: green check, red cross,
 * or an amber ring still waiting. `you` rings the reader's own seat.
 */
export function TierProgressRail({ app, you, compact, style }: {
  app: any; you?: string; compact?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const r = useLegacyAppearance(legacyAppearance_r);
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const trail = tierTrail(app);
  const summary = trail.map((s) => `${TIER_WORD[s.tier]} ${s.decision}`).join(', ');
  return (
    <View style={[r.wrap, style]} accessible accessibilityLabel={`Review trail: ${summary}`}>
      {trail.map((step, i) => {
        const done = step.decision === 'approved';
        const bad = step.decision === 'rejected';
        const mine = !!you && you === step.tier;
        const nextDone = i < trail.length - 1 && done && trail[i + 1].decision === 'approved';
        return (
          <React.Fragment key={step.tier}>
            <View style={r.step}>
              <View style={[r.nodeRing, mine && r.nodeMine]}>
                {done || bad ? (
                  <LinearGradient
                    colors={done ? CONSOLE_ACCENTS.green.grad.slice(0, 2) : CONSOLE_ACCENTS.red.grad.slice(0, 2)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={r.node}
                  >
                    <Icon name={done ? 'check' : 'close'} size={13} color={PALETTE.white} />
                  </LinearGradient>
                ) : (
                  <View style={[r.node, r.nodeWait]}><View style={r.waitDot} /></View>
                )}
                {mine ? <View style={r.youTag}><Text style={r.youText} maxFontSizeMultiplier={1}>YOU</Text></View> : null}
              </View>
              <Text style={[r.label, mine && r.labelMine]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {TIER_WORD[step.tier]}
              </Text>
              {!compact ? (
                <Text style={[r.sub, bad && { color: PALETTE.redDark }, done && { color: PALETTE.greenDark }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {done ? (shortDay(step.at) || 'Approved') : bad ? (shortDay(step.at) || 'Rejected') : 'Waiting'}
                </Text>
              ) : null}
            </View>
            {i < trail.length - 1 ? (
              <View style={r.connectorWrap}>
                {nextDone ? (
                  <LinearGradient colors={CONSOLE_ACCENTS.green.grad.slice(0, 2)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={r.connector} />
                ) : (
                  <View style={[r.connector, r.connectorIdle, done && { backgroundColor: PALETTE.greenSoft }]} />
                )}
              </View>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/* ===================================================================== coverage ring */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A ring gauge (react-native-svg): `progress` 0..1 of the circle is drawn in
 * the accent; the centre carries a figure and caption. Animates in once.
 */
export function CoverageRing({ progress, size = 68, stroke = 7, accent = 'indigo', center, caption, light }: {
  progress: number; size?: number; stroke?: number; accent?: ConsoleAccent; center?: string; caption?: string;
  /** Drawn on a gradient (white track). */
  light?: boolean;
}) {
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const g = useLegacyAppearance(legacyAppearance_g);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const reduce = useReduceMotion();
  const a = CONSOLE_ACCENTS[accent] || CONSOLE_ACCENTS.indigo;
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const rad = (size - stroke) / 2;
  const circ = 2 * Math.PI * rad;
  const v = useRef(new Animated.Value(reduce ? p : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(p); return undefined; }
    const anim = Animated.timing(v, { toValue: p, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [p, reduce, v]);
  const offset = v.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`${Math.round(p * 100)} percent${caption ? `, ${caption}` : ''}`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke={light ? 'rgba(255,255,255,0.22)' : a.soft} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={rad}
          stroke={light ? PALETTE.white : a.fg}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset as any}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[g.center, light && { color: PALETTE.white }, size < 60 && { fontSize: 13 }]} numberOfLines={1} maxFontSizeMultiplier={1}>
        {center ?? `${Math.round(p * 100)}%`}
      </Text>
      {caption ? <Text style={[g.caption, light && { color: BRAND.onBrandSoft }]} numberOfLines={1} maxFontSizeMultiplier={1}>{caption}</Text> : null}
    </View>
  );
}

/* ===================================================================== states */

/** Empty / error with a small original illustration and an optional retry. */
export function ConsoleState({ kind = 'empty', title, message, action, onAction, style }: {
  kind?: 'empty' | 'error'; title: string; message?: string; action?: string; onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const st = useLegacyAppearance(legacyAppearance_st);
  return (
    <FadeInUp style={[st.wrap, style]}>
      <FloatingIllustration size={104} amplitude={5} halo={false}>
        {kind === 'error' ? <AdminCloudOff3D size={104} /> : <AdminEmptyTray3D size={104} />}
      </FloatingIllustration>
      <Text style={st.title} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{title}</Text>
      {message ? <Text style={st.message} maxFontSizeMultiplier={CAP}>{message}</Text> : null}
      {action && onAction ? (
        <ConsoleButton kind={kind === 'error' ? 'primary' : 'soft'} size="sm" icon={kind === 'error' ? 'refresh' : undefined} label={action} onPress={onAction} style={st.action} />
      ) : null}
    </FadeInUp>
  );
}

/** Shimmering placeholder cards while the first load is in flight. */
export function ConsoleSkeleton({ rows = 3, variant = 'card', style }: {
  rows?: number; variant?: 'card' | 'tiles'; style?: StyleProp<ViewStyle>;
}) {
  const t = useLegacyAppearance(legacyAppearance_t);
  const sk = useLegacyAppearance(legacyAppearance_sk);
  const c = useLegacyAppearance(legacyAppearance_c);
  const f = useLegacyAppearance(legacyAppearance_f);
  const pulse = useLoop({ duration: 1400, pingPong: true });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  if (variant === 'tiles') {
    return (
      <Animated.View style={[t.grid, { opacity }, style]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={t.cell}>
            <View style={[t.tile, sk.tile]}>
              <View style={[sk.block, { width: 40, height: 40, borderRadius: 14 }]} />
              <View style={[sk.block, { width: '50%', height: 22, marginTop: SPACE.md }]} />
              <View style={[sk.block, { width: '70%', height: 11, marginTop: SPACE.sm }]} />
            </View>
          </View>
        ))}
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[{ paddingHorizontal: SPACE.lg, gap: SPACE.md, opacity }, style]}>
      {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
        <View key={i} style={[c.card, c.padded]}>
          <View style={sk.row}>
            <View style={[sk.block, { width: 48, height: 48, borderRadius: 24 }]} />
            <View style={[f.flexText, { gap: SPACE.sm }]}>
              <View style={[sk.block, { width: '62%', height: 14 }]} />
              <View style={[sk.block, { width: '40%', height: 11 }]} />
            </View>
            <View style={[sk.block, { width: 64, height: 22, borderRadius: 11 }]} />
          </View>
          <View style={[sk.block, { width: '100%', height: 34, marginTop: SPACE.lg, borderRadius: 12 }]} />
        </View>
      ))}
    </Animated.View>
  );
}

/* ===================================================================== styles */

const f = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  overscroll: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});

const h = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: SIZE.touch },
  side: { minWidth: SIZE.touch, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  sideRight: { justifyContent: 'flex-end' },
  topCenter: { flex: 1, minWidth: 0, textAlign: 'center', ...PREMIUM_TYPE.eyebrow, color: BRAND.onBrandSoft },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm, marginTop: SPACE.md },
  heroRowCompact: { marginTop: SPACE.xs },
  heroText: { flex: 1, minWidth: 0, paddingBottom: SPACE.md },
  eyebrow: { ...PREMIUM_TYPE.eyebrow, color: BRAND.onBrandFaint, marginBottom: SPACE.xs + 2 },
  title: { ...PREMIUM_TYPE.heroMd, color: PALETTE.white },
  titleCompact: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4, color: PALETTE.white },
  subtitle: { fontSize: 14, lineHeight: 20, color: BRAND.onBrandSoft, marginTop: SPACE.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.pill,
    backgroundColor: BRAND.glassStrong, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  badgeLast: { flexShrink: 1 },
  badgeText: { ...PREMIUM_TYPE.eyebrow, letterSpacing: 0.8, color: PALETTE.white, flexShrink: 1 },
  children: { marginTop: SPACE.md },
});

const t = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: SPACE.lg },
  cell: { width: '48.4%', marginBottom: SPACE.md },
  // Shadow on the outer view, clipping on the inner one — iOS drops a shadow on a clipped view.
  tileShadow: {
    flex: 1, borderRadius: 22, backgroundColor: PALETTE.white,
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
  },
  tile: {
    flex: 1, minHeight: 132, backgroundColor: PALETTE.white, borderRadius: 22, padding: SPACE.md + 2,
    borderWidth: 1.5, borderColor: 'rgba(226,232,240,0.9)', overflow: 'hidden',
  },
  glow: { position: 'absolute', width: 110, height: 110, borderRadius: 55, top: -52, right: -40, opacity: 0.8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  value: { ...TYPE.number, fontSize: 28, lineHeight: 34, marginTop: SPACE.md },
  label: { ...TYPE.label, color: PALETTE.textSoft, marginTop: 2 },
  hint: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: 2 },
});

const c = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.white, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3,
  },
  padded: { padding: SPACE.lg },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.md, marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md },
  sectionText: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  sectionIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  sectionSub: { ...TYPE.caption, marginTop: 1 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.touch, paddingLeft: SPACE.sm, maxWidth: '100%' },
  sectionActionText: { ...TYPE.label, color: PALETTE.indigo, fontWeight: '700', flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm + 2, padding: SPACE.md, borderRadius: 16 },
  noteIcon: { marginTop: 1 },
  noteText: { ...TYPE.caption, lineHeight: 18, fontWeight: '600' },
  noteAction: { marginTop: SPACE.xs, alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center' },
  noteActionText: { ...TYPE.label, fontWeight: '800', textDecorationLine: 'underline' },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, maxWidth: '100%' },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.2, flexShrink: 1 },
  btn: { borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.lg, overflow: 'hidden' },
  btnShadow: { borderRadius: RADIUS.pill, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 },
  btnSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.10)' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm - 2 },
  btnText: { fontSize: 15, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  btnTextSm: { fontSize: 14 },
  btnOff: { opacity: 0.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, borderWidth: 1.5, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, minHeight: SIZE.controlSm, backgroundColor: PALETTE.white },
  pillText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  searchFlush: { marginBottom: 0 },
});

const tb = StyleSheet.create({
  wrap: { paddingHorizontal: SPACE.lg },
  track: {
    flexDirection: 'row', gap: 4, padding: 4, borderRadius: 18, backgroundColor: PALETTE.white,
    borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  segCell: { flex: 1, minWidth: 0 },
  seg: { minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segTall: { minHeight: 50, paddingVertical: 5 },
  segLabel: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: PALETTE.textMuted, textAlign: 'center' },
  segLabelSm: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: PALETTE.textMuted, textAlign: 'center' },
  segCount: { fontSize: 17, lineHeight: 21, fontWeight: '800', color: PALETTE.text, fontVariant: ['tabular-nums'] },
  onText: { color: PALETTE.white },
  scrollRow: { paddingHorizontal: SPACE.lg, gap: SPACE.sm, paddingVertical: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: SPACE.md + 2, borderRadius: RADIUS.pill },
  pillOff: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  pillText: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: PALETTE.textSoft },
  pillCount: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: PALETTE.divider, alignItems: 'center', justifyContent: 'center' },
  pillCountOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  pillCountText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: PALETTE.textSoft },
});

const r = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' },
  step: { alignItems: 'center', width: 76 },
  nodeRing: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  nodeMine: { borderColor: PALETTE.indigo },
  node: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nodeWait: { backgroundColor: PALETTE.white, borderWidth: 2, borderColor: PALETTE.amber },
  waitDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.amber },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: PALETTE.textSoft, marginTop: 4 },
  labelMine: { color: PALETTE.indigo },
  youTag: { position: 'absolute', top: -7, right: -16, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, backgroundColor: PALETTE.indigo },
  youText: { fontSize: 8, lineHeight: 10, fontWeight: '800', color: PALETTE.white, letterSpacing: 0.4 },
  sub: { fontSize: 10, lineHeight: 13, fontWeight: '600', color: PALETTE.textFaint, marginTop: 1 },
  connectorWrap: { flex: 1, minWidth: 8, height: 30, justifyContent: 'center', marginHorizontal: -22 },
  connector: { height: 3, borderRadius: 2 },
  connectorIdle: { backgroundColor: PALETTE.border },
});

const g = StyleSheet.create({
  center: { fontSize: 15, lineHeight: 18, fontWeight: '800', color: PALETTE.text, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 9, lineHeight: 11, fontWeight: '700', color: PALETTE.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
});

const st = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xl },
  title: { ...TYPE.heading, fontSize: 17, lineHeight: 23, marginTop: SPACE.md, textAlign: 'center' },
  message: { ...TYPE.body, color: PALETTE.textMuted, marginTop: SPACE.xs, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: SPACE.lg, minWidth: 140 },
});

const sk = StyleSheet.create({
  tile: { minHeight: 132 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  block: { backgroundColor: PALETTE.divider, borderRadius: 8 },
});


// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_f = f;
const legacyAppearance_CONSOLE_CANVAS = CONSOLE_CANVAS;
const legacyAppearance_ADMIN = ADMIN;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
const legacyAppearance_h = h;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_ACCENTS = CONSOLE_ACCENTS;
const legacyAppearance_t = t;
const legacyAppearance_c = c;
const legacyAppearance_CHIP = CHIP;
const legacyAppearance_tb = tb;
const legacyAppearance_r = r;
const legacyAppearance_g = g;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_st = st;
const legacyAppearance_sk = sk;

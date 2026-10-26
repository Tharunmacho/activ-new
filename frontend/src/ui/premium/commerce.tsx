import { AppTheme, useAppTheme, useThemeStyles } from '../AppTheme';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
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
import { SIZE, SPACE, Tone } from '../tokens';
import { GradientButton } from './controls';
import { PressableScale, prefersReducedMotion } from './motion';

import { CallMark, MailMark, WhatsAppMark } from './contactMarks';

/**
 * ============================================================================
 * PREMIUM LAYER — commerce building blocks (business area, reusable anywhere)
 * ============================================================================
 *
 *   CompanyLogoTile ........ a company's REAL logo in a gradient-ringed rounded tile
 *                     (initials when there is none or it fails to load)
 *   CompanyChip ..... switcher pill: logo + name, gradient when active
 *   LiftCard ..... the elevated white card (pressable with a spring)
 *   GlassFigure ....... a figure on the brand header (translucent tile)
 *   TrustStar ....... the trust toggle — a star that pops and bursts when set
 *   ContactAction ... Call / WhatsApp / Email tile with the real marks
 *   ActivityTimeline ........ gradient-dotted vertical activity list
 *   ArtEmptyState .... empty / error / locked state with an art medallion
 *   LiftSearchBar  the white search field that sits on the canvas
 */

const CAP = 1.3;

const initialsOf = (name?: string | null) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0] || '').slice(0, 2).toUpperCase();
  return `${(parts[0] || '').charAt(0)}${(parts[1] || '').charAt(0)}`.toUpperCase();
};

/* ================================================================ logo */

export function CompanyLogoTile({ uri, name, size = 56, tone = 'member', ring = true, style }: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  tone?: Tone;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const [failed, setFailed] = useState(false);
  const src = typeof uri === 'string' ? uri.trim() : '';
  useEffect(() => { setFailed(false); }, [src]);
  const outer = Math.max(28, Number(size || 0));
  const ringW = ring ? Math.max(2, Math.round(outer * 0.045)) : 0;
  const radius = Math.round(outer * 0.3);
  const inner = outer - ringW * 2;
  const initials = initialsOf(name);
  return (
    <View
      style={[{ width: outer, height: outer, borderRadius: radius, shadowColor: p.shadow }, s.logoShadow, style]}
      accessibilityRole="image"
      accessibilityLabel={name ? `${name} logo` : 'Company logo'}
    >
      <LinearGradient
        colors={ring ? [p.glow, p.accent, p.accentDark] : [PALETTE.white, PALETTE.white]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: outer, height: outer, borderRadius: radius, padding: ringW }}
      >
        <View style={{ width: inner, height: inner, borderRadius: radius - ringW, backgroundColor: PALETTE.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {src && !failed ? (
            <Image
              source={{ uri: src }}
              style={{ width: inner - 6, height: inner - 6 }}
              resizeMode="contain"
              onError={() => setFailed(true)}
              accessibilityIgnoresInvertColors
            />
          ) : initials ? (
            <LinearGradient colors={[p.accentSoft, p.accentSoft2]} style={[StyleSheet.absoluteFill, s.center]}>
              <Text style={{ color: p.accentDark, fontWeight: '800', fontSize: Math.round(inner * 0.34), letterSpacing: 0.3 }} maxFontSizeMultiplier={1}>{initials}</Text>
            </LinearGradient>
          ) : (
            <Icon name="storefront" size={Math.round(inner * 0.46)} color={p.accent} />
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

/* ================================================================ chips */

export function CompanyChip({ name, logo, active, onPress, tone = 'member' }: {
  name: string; logo?: string; active?: boolean; onPress: () => void; tone?: Tone;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const body = (
    <>
      <CompanyLogoTile uri={logo} name={name} size={30} ring={false} style={s.chipLogo} />
      <Text style={[s.chipText, active && { color: PALETTE.white }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{name || 'Company'}</Text>
      {active ? <Icon name="check-circle" size={16} color={PALETTE.white} /> : null}
    </>
  );
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={active ? `${name}, active company` : `Switch to ${name}`}
    >
      {active ? (
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.chip, s.chipOn]}>{body}</LinearGradient>
      ) : (
        <View style={[s.chip, s.chipOff]}>{body}</View>
      )}
    </PressableScale>
  );
}

/* ================================================================ surfaces */

export function LiftCard({ children, style, onPress, accessibilityLabel, tone = 'member', padded = true }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  tone?: Tone;
  padded?: boolean;
}) {
  const { premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const box = [s.card, padded && s.cardPad, { shadowColor: p.shadow }];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={style} contentStyle={box} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[...box, style]}>{children}</View>;
}

/** A figure on the gradient header — translucent, white type. */
export function GlassFigure({ icon, value, label, style }: {
  icon?: string; value: string; label: string; style?: StyleProp<ViewStyle>;
}) {
  const { brand: BRAND } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.glassStat, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      {icon ? <Icon name={icon} size={16} color={BRAND.onBrandSoft} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.glassValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>{value}</Text>
        <Text style={s.glassLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
      </View>
    </View>
  );
}

/* ================================================================ trust star */

/**
 * The trust toggle. Becoming trusted pops the star (spring) and sends a gold
 * ring outward; un-trusting just settles. Native driver throughout.
 */
export function TrustStar({ trusted, busy, disabled, onPress, size = SIZE.touch, accessibilityLabel }: {
  trusted: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const pop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const prev = useRef(trusted);

  useEffect(() => {
    const was = prev.current;
    prev.current = trusted;
    if (!trusted || was || prefersReducedMotion()) return;
    pop.setValue(0.6);
    burst.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [trusted, pop, burst]);

  const ringScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.7] });
  const ringOpacity = burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] });
  const off = !!disabled || !!busy;
  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      scaleTo={0.9}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: trusted, disabled: off, busy: !!busy }}
      accessibilityLabel={accessibilityLabel || (trusted ? 'On your trust list — remove' : 'Add to your trust list')}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}>
        <Animated.View pointerEvents="none" style={[s.burst, { width: size, height: size, borderRadius: size / 2, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        {trusted ? (
          <LinearGradient colors={['#FDE68A', '#F59E0B', '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator size="small" color={PALETTE.white} /> : (
              <Animated.View style={{ transform: [{ scale: pop }] }}><Icon name="star" size={Math.round(size * 0.52)} color={PALETTE.white} /></Animated.View>
            )}
          </LinearGradient>
        ) : (
          <View style={[s.starOff, { width: size, height: size, borderRadius: size / 2 }]}>
            {busy ? <ActivityIndicator size="small" color={PALETTE.amber} /> : <Icon name="star-border" size={Math.round(size * 0.52)} color={PALETTE.amberDark} />}
          </View>
        )}
      </View>
    </PressableScale>
  );
}

/* ================================================================ contact */

export type ContactKind = 'call' | 'whatsapp' | 'email';

const CONTACT_LABEL: Record<ContactKind, string> = { call: 'Call', whatsapp: 'WhatsApp', email: 'Email' };

export function ContactMark({ kind, size = 24 }: { kind: ContactKind; size?: number }) {
  if (kind === 'whatsapp') return <WhatsAppMark size={size} />;
  if (kind === 'email') return <MailMark size={size} />;
  return <CallMark size={size} />;
}

/** One contact shortcut — the real mark over its label. Three fit a 360dp row. */
export function ContactAction({ kind, onPress, label, detail, style }: {
  kind: ContactKind; onPress: () => void; label?: string; detail?: string; style?: StyleProp<ViewStyle>;
}) {
  const s = useThemeStyles(makeStyles);
  const text = label || CONTACT_LABEL[kind];
  return (
    <PressableScale
      onPress={onPress}
      style={[{ flex: 1, minWidth: 0 }, style]}
      contentStyle={s.contact}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${text} ${detail}` : text}
    >
      <View style={s.contactMark}><ContactMark kind={kind} size={30} /></View>
      <Text style={s.contactText} numberOfLines={1} maxFontSizeMultiplier={CAP}>{text}</Text>
      {detail ? <Text style={s.contactDetail} numberOfLines={1} maxFontSizeMultiplier={CAP}>{detail}</Text> : null}
    </PressableScale>
  );
}

/* ================================================================ timeline */

export interface ActivityItem { key: string; icon?: string; title: string; subtitle?: string; meta?: string }

export function ActivityTimeline({ items, tone = 'member' }: { items: ActivityItem[]; tone?: Tone }) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const list = (items || []).filter(Boolean);
  return (
    <View>
      {list.map((it, i) => {
        const last = i === list.length - 1;
        return (
          <View key={it.key || String(i)} style={s.tlRow}>
            <View style={s.tlRail}>
              <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tlDot}>
                <Icon name={it.icon || 'bolt'} size={14} color={PALETTE.white} />
              </LinearGradient>
              {!last ? <View style={[s.tlLine, { backgroundColor: p.accentSoft }]} /> : null}
            </View>
            <View style={[s.tlBody, !last && { paddingBottom: SPACE.lg }]}>
              <View style={s.tlHead}>
                <Text style={s.tlTitle} numberOfLines={2} maxFontSizeMultiplier={CAP}>{it.title}</Text>
                {it.meta ? <Text style={s.tlMeta} numberOfLines={1} maxFontSizeMultiplier={CAP}>{it.meta}</Text> : null}
              </View>
              {it.subtitle ? <Text style={s.tlSub} numberOfLines={2} maxFontSizeMultiplier={CAP}>{it.subtitle}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ================================================================ states */

/**
 * Empty / error / locked: original art inside a navy medallion (the art is
 * drawn for a dark ground), a title, a line, and at most one action.
 */
export function ArtEmptyState({ art, icon = 'inbox', title, message, action, actionIcon, onAction, secondary, onSecondary, tone = 'member', compact, style, children }: {
  art?: React.ReactNode;
  icon?: string;
  title: string;
  message?: string;
  action?: string;
  actionIcon?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  tone?: Tone;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const medal = compact ? 96 : 120;
  return (
    <View style={[s.empty, compact && { paddingVertical: SPACE.xl }, style]}>
      <LinearGradient colors={p.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.medal, { width: medal, height: medal, borderRadius: medal / 2, shadowColor: p.shadow }]}>
        <View style={[s.medalRing, { width: medal - 10, height: medal - 10, borderRadius: (medal - 10) / 2 }]} />
        {art || <Icon name={icon} size={Math.round(medal * 0.36)} color={PALETTE.white} />}
      </LinearGradient>
      <Text style={s.emptyTitle} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{title}</Text>
      {message ? <Text style={s.emptyText} maxFontSizeMultiplier={CAP}>{message}</Text> : null}
      {children}
      {action && onAction ? (
        <GradientButton label={action} icon={actionIcon} onPress={onAction} tone={tone} style={s.emptyBtn} />
      ) : null}
      {secondary && onSecondary ? (
        <GradientButton label={secondary} variant="outline" onPress={onSecondary} tone={tone} style={s.emptyBtn2} />
      ) : null}
    </View>
  );
}

/* ================================================================ search */

export function LiftSearchBar({ value, onChangeText, placeholder = 'Search', tone = 'member', style, autoFocus }: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}) {
  const { palette: PALETTE, premiumTone, isDark } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.search, { shadowColor: p.shadow, borderColor: focused ? p.accent : 'rgba(226,232,240,0.9)' }, style]}>
      <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.searchIcon}>
        <Icon name="search" size={18} color={PALETTE.white} />
      </LinearGradient>
      <TextInput
            keyboardAppearance={isDark ? 'dark' : 'light'}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={PALETTE.textFaint}
        selectionColor={p.accent}
        style={s.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} style={s.searchClear} accessibilityRole="button" accessibilityLabel="Clear search">
          <Icon name="cancel" size={18} color={PALETTE.textFaint} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE, brand: BRAND }: AppTheme) => StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  logoShadow: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4, backgroundColor: PALETTE.card },

  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, height: 44, paddingLeft: 6, paddingRight: SPACE.md, borderRadius: 999, maxWidth: 240 },
  chipOn: {},
  chipOff: { backgroundColor: PALETTE.card, borderWidth: 1, borderColor: PALETTE.border },
  chipLogo: { elevation: 0, shadowOpacity: 0 },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.textSoft, flexShrink: 1 },

  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 4,
  },
  cardPad: { padding: SPACE.lg },

  glassStat: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    borderRadius: 16,
    backgroundColor: BRAND.glass,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
  },
  glassValue: { color: PALETTE.white, fontSize: 17, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  glassLabel: { color: BRAND.onBrandFaint, fontSize: 11, lineHeight: 14, fontWeight: '600' },

  burst: { position: 'absolute', borderWidth: 2, borderColor: '#F59E0B' },
  starOff: { alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.amberSoft, borderWidth: 1, borderColor: '#FCE3A6' },

  contact: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 84,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.xs,
    borderRadius: 18,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: '#0B1A45',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  contactMark: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  contactText: { ...TYPE.label, color: PALETTE.text, fontWeight: '700' },
  contactDetail: { ...TYPE.caption, fontSize: 11, lineHeight: 14, maxWidth: '92%' },

  tlRow: { flexDirection: 'row', gap: SPACE.md },
  tlRail: { width: 28, alignItems: 'center' },
  tlDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tlLine: { flex: 1, width: 2, marginTop: 4, borderRadius: 1 },
  tlBody: { flex: 1, minWidth: 0, paddingTop: 3 },
  tlHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  tlTitle: { ...TYPE.bodyStrong, flex: 1, minWidth: 0 },
  tlMeta: { ...TYPE.caption, fontVariant: ['tabular-nums'] },
  tlSub: { ...TYPE.caption, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.xl },
  medal: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  medalRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  emptyTitle: { ...TYPE.title, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  emptyText: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.sm, maxWidth: 320 },
  emptyBtn: { marginTop: SPACE.xl, alignSelf: 'stretch' },
  emptyBtn2: { marginTop: SPACE.md, alignSelf: 'stretch' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 54,
    paddingLeft: 7,
    paddingRight: SPACE.xs,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: PALETTE.card,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  searchIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, color: PALETTE.text, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
  searchClear: { width: SIZE.touch, height: SIZE.touch, alignItems: 'center', justifyContent: 'center' },
});

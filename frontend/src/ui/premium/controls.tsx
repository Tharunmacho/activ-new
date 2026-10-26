import { AppTheme, useAppTheme, useThemeStyles } from '../AppTheme';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SIZE, SPACE, Tone } from '../tokens';
import { Avatar } from '../components';
import { PREMIUM_RADIUS, PREMIUM_TYPE } from './theme';
import { PressableScale, prefersReducedMotion } from './motion';

/**
 * ============================================================================
 * PREMIUM LAYER — controls
 * ============================================================================
 * Buttons, inputs, sheet, headings and brand marks for the premium screens.
 * Same prop shapes as the base kit where one exists (PremiumInput ≈ Field,
 * PremiumSelect ≈ formKit SelectField), so a screen migrates by renaming.
 */

const CAP = 1.3;

/* =================================================================== buttons */

export type GradientButtonVariant = 'primary' | 'outline' | 'glass';

/**
 * The main action: navy→blue gradient pill with a coloured shadow, spring
 * press. `outline` = secondary (white, accent border); `glass` = on the
 * brand header (translucent white).
 */
export function GradientButton({
  label, onPress, loading, disabled, tone = 'member', variant = 'primary', icon, iconRight,
  size = 'md', style, accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: Tone;
  variant?: GradientButtonVariant;
  icon?: string;
  iconRight?: string;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const off = !!disabled || !!loading;
  const height = size === 'lg' ? 56 : 52;
  const fg = variant === 'primary' || variant === 'glass' ? PALETTE.white : p.accentDark;
  const content = loading ? (
    <ActivityIndicator color={variant === 'outline' ? p.accent : PALETTE.white} />
  ) : (
    <View style={s.btnInner}>
      {icon ? <Icon name={icon} size={19} color={disabled ? PALETTE.textFaint : fg} /> : null}
      <Text
        style={[s.btnText, { color: disabled ? PALETTE.textFaint : fg }]}
        maxFontSizeMultiplier={CAP}
      >
        {String(label || '')}
      </Text>
      {iconRight ? <Icon name={iconRight} size={19} color={disabled ? PALETTE.textFaint : fg} /> : null}
    </View>
  );

  let body: React.ReactNode;
  if (disabled && !loading) {
    body = <View style={[s.btn, { minHeight: height, backgroundColor: PALETTE.disabled }]}>{content}</View>;
  } else if (variant === 'outline') {
    body = <View style={[s.btn, s.btnOutline, { minHeight: height, borderColor: p.accent }]}>{content}</View>;
  } else if (variant === 'glass') {
    body = <View style={[s.btn, s.btnGlass, { minHeight: height }]}>{content}</View>;
  } else {
    body = (
      <View style={[s.btnShadow, { shadowColor: p.accent, backgroundColor: p.button[p.button.length - 1] }]}>
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.btn, { minHeight: height }]}>
          <View pointerEvents="none" style={s.btnSheen} />
          {content}
        </LinearGradient>
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: off, busy: !!loading }}
    >
      {body}
    </PressableScale>
  );
}

/** Back + primary at the foot of a form step (premium FormFooter). */
export function PremiumFooter({
  primaryLabel, onPrimary, loading, disabled, secondaryLabel, onSecondary, primaryIcon = 'arrow-forward', tone = 'member',
}: {
  primaryLabel: string;
  onPrimary: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryIcon?: string;
  tone?: Tone;
}) {
  const s = useThemeStyles(makeStyles);
  const hasSecondary = !!(secondaryLabel && onSecondary);
  const label = String(primaryLabel || '');
  // On 360dp a long label beside "Back" only fits without its icon.
  const showIcon = !hasSecondary || label.length <= 16;
  return (
    <View style={s.footerRow}>
      {hasSecondary ? (
        <GradientButton
          tone={tone}
          variant="outline"
          label={String(secondaryLabel)}
          onPress={onSecondary}
          disabled={loading}
          style={s.footerSecondary}
        />
      ) : null}
      <GradientButton
        tone={tone}
        label={label}
        onPress={onPrimary}
        loading={loading}
        disabled={disabled}
        iconRight={showIcon ? primaryIcon : undefined}
        style={{ flex: 1 }}
      />
    </View>
  );
}

/**
 * Refined outlined pill for Google / LinkedIn / Facebook. Pass `mark` (a
 * vector brand mark, preferred) or `source` (an image). `compact` stacks for
 * three-across rows: mark and short label centred, tighter padding.
 */
export function SocialPill({ label, mark, source, onPress, disabled, style, accessibilityLabel, compact }: {
  label: string;
  mark?: React.ReactNode;
  source?: ImageSourcePropType;
  compact?: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const s = useThemeStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[style, disabled && s.dim]}
      contentStyle={[s.social, compact && s.socialCompact]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      {mark || (source ? <Image source={source} style={s.socialLogo} resizeMode="contain" /> : null)}
      <Text
        style={[s.socialText, compact && s.socialTextCompact]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={compact ? 1.1 : CAP}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * Full-width "Continue with ..." sign-in button, one per provider, stacked.
 *
 * Follows Google's light-theme button spec (white fill, 1px neutral stroke,
 * #1F1F1F label, full-colour mark), and uses the SAME neutral treatment for
 * LinkedIn and Facebook - both brands permit their full-colour mark on white,
 * and three matching buttons read as one set instead of a colour clash.
 *
 * Layout: 52px tall; the mark sits in a fixed 24px slot 16px from the left
 * edge, and the label is centred on the WHOLE button (a mirrored right slot
 * balances the mark), so the three labels line up however long each is.
 */
export function SocialButton({ label, mark, onPress, disabled, style, accessibilityLabel }: {
  label: string;
  mark?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const s = useThemeStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={{ color: 'rgba(15,23,42,0.06)' }}
      style={({ pressed }) => [s.socialBtn, pressed && s.socialBtnPressed, disabled && s.dim, style]}
    >
      <View style={s.socialBtnSlot}>{mark || null}</View>
      <Text
        style={s.socialBtnText}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
      <View style={s.socialBtnSlot} />
    </Pressable>
  );
}

/**
 * Bottom padding that keeps the last thing on a screen clear of the Android
 * navigation bar (3-button or gesture) and the iOS home indicator.
 *
 * `insets.bottom` is the answer when it is reported. On Android a window that
 * is drawn edge-to-edge (as Android 15+ enforces) but reports a zero bottom
 * inset is treated as carrying a 48dp button bar, because content under a
 * button bar cannot be tapped and extra space costs nothing.
 */
export function useBottomGuard(extra: number = SPACE.lg): number {
  const insets = useSafeAreaInsets();
  let bottom = Number(insets?.bottom || 0);
  if (!bottom) bottom = Number(initialWindowMetrics?.insets?.bottom || 0);
  if (!bottom && Platform.OS === 'android') {
    try {
      const screenH = Number(Dimensions.get('screen')?.height || 0);
      const windowH = Number(Dimensions.get('window')?.height || 0);
      if (screenH > 0 && windowH >= screenH - 1) bottom = 48;
    } catch {
      /* no metrics - the reported inset stands */
    }
  }
  return bottom + extra;
}

/**
 * "Are you an administrator? / Admin sign in ->": the switch between the
 * member and the admin sign-in, as a card row rather than a stray link.
 *
 * Gradient icon tile (shield for admin, person for member), a quiet question
 * above a bold accent action, a chevron in an accent disc. 64px tall and the
 * whole card is the touch target. `tone` picks indigo (admin) or ACTIV blue
 * (member). It pads itself below by the navigation-bar inset so it never sits
 * under the Android buttons.
 */
export function PortalSwitchCard({
  icon, question, action, tone = 'admin', onPress, disabled, accessibilityLabel, style,
}: {
  icon: string;
  question: string;
  action: string;
  tone?: 'admin' | 'member';
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const guard = useBottomGuard(SPACE.lg);
  const admin = tone === 'admin';
  const accent = admin ? PALETTE.indigo : PALETTE.blue;
  const accentDark = admin ? PALETTE.indigoDark : PALETTE.blueDark;
  const soft = admin ? PALETTE.indigoSoft : PALETTE.blueSoft;
  const tint = admin ? PALETTE.indigoTint : PALETTE.blueTint;
  const edge = PALETTE.border;
  const grad = admin ? ['#3B2DB0', '#6D5AE6'] : ['#1E3A8A', '#2563EB'];
  return (
    <View style={[{ paddingBottom: guard }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || `${question} ${action}`}
        accessibilityState={{ disabled: !!disabled }}
        android_ripple={{ color: soft }}
        style={({ pressed }) => [
          s.portalCard,
          { borderColor: edge },
          pressed && { backgroundColor: tint, borderColor: accent },
          disabled && s.dim,
        ]}
      >
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.portalTile}>
          <Icon name={icon} size={22} color={PALETTE.white} />
        </LinearGradient>
        <View style={s.portalBody}>
          <Text style={s.portalQuestion} numberOfLines={1} maxFontSizeMultiplier={1.25}>{question}</Text>
          <Text style={[s.portalAction, { color: accentDark }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{action}</Text>
        </View>
        <View style={[s.portalChevron, { backgroundColor: soft }]}>
          <Icon name="arrow-forward" size={18} color={accent} />
        </View>
      </Pressable>
    </View>
  );
}

/** Round translucent button for the brand header (back, close). */
export function GlassIconButton({ icon, onPress, accessibilityLabel, style, disabled = false }: {
  icon: string; onPress: () => void; accessibilityLabel: string; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      style={[disabled && { opacity: 0.65 }, style]}
      disabled={disabled}
      scaleTo={0.92}
      contentStyle={s.glassIcon}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={6}
    >
      <Icon name={icon} size={22} color={PALETTE.white} />
    </PressableScale>
  );
}

/* =================================================================== brand */

/** The ACTIV logo on a white pill (or disc) — legible on any gradient. */
export function BrandLogo({ size = 'md', variant = 'pill', style }: {
  size?: 'sm' | 'md'; variant?: 'pill' | 'disc'; style?: StyleProp<ViewStyle>;
}) {
  const s = useThemeStyles(makeStyles);
  const sm = size === 'sm';
  // Source art is ~3.25:1 — width drives the fit.
  const logoW = variant === 'disc' ? (sm ? 44 : 62) : sm ? 84 : 104;
  const logoH = Math.round(logoW / 3.25);
  const box: ViewStyle = variant === 'disc'
    ? { width: sm ? 56 : 76, height: sm ? 56 : 76, borderRadius: 40 }
    : { height: sm ? 36 : 44, paddingHorizontal: sm ? 12 : 16, borderRadius: 999 };
  return (
    <View style={[s.logoBox, box, style]}>
      <Image
        source={require('../../assets/images/activlogo.png')}
        style={{ width: logoW, height: logoH }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel="ACTIV"
      />
    </View>
  );
}

/** Translucent pill on the gradient — "ADMIN PORTAL", "STEP 2". */
export function GlassBadge({ label, icon, style }: { label: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.glassBadge, style]}>
      {icon ? <Icon name={icon} size={14} color={PALETTE.white} /> : null}
      <Text style={s.glassBadgeText} maxFontSizeMultiplier={CAP}>{label}</Text>
    </View>
  );
}

/** White heading block for the brand header. */
export function PremiumHeading({ eyebrow, title, subtitle, size = 'lg', align = 'left', style }: {
  eyebrow?: string; title: string; subtitle?: string; size?: 'lg' | 'md'; align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}) {
  const s = useThemeStyles(makeStyles);
  const textAlign = align;
  return (
    <View style={style}>
      {eyebrow ? (
        <Text style={[s.eyebrow, { textAlign }]} maxFontSizeMultiplier={CAP}>{eyebrow}</Text>
      ) : null}
      <Text
        style={[size === 'md' ? PREMIUM_TYPE.heroMd : PREMIUM_TYPE.hero, s.heroText, { textAlign }]}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.25}
      >
        {String(title || '')}
      </Text>
      {subtitle ? <Text style={[s.lead, { textAlign }]} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
    </View>
  );
}

/* =================================================================== surfaces */

/** The elevated white sheet that overlaps the header and holds the form. */
export function PremiumSheet({ children, style, tone = 'member' }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone;
}) {
  const { premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  return <View style={[s.sheet, { shadowColor: p.shadow }, style]}>{children}</View>;
}

/** A titled card inside a premium form: gradient icon chip + heading. */
export function PremiumSection({ icon, title, subtitle, children, style, tone = 'member' }: {
  icon: string; title: string; subtitle?: string; children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  return (
    <View style={[s.section, { shadowColor: p.shadow }, style]}>
      <View style={s.sectionHead}>
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sectionIcon}>
          <Icon name={icon} size={SIZE.icon} color={PALETTE.white} />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{title}</Text>
          {subtitle ? <Text style={s.sectionSub} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/** "— OR SIGN IN WITH —" */
export function PremiumDivider({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.dividerRow, style]}>
      <LinearGradient colors={['rgba(203,213,225,0)', PALETTE.borderStrong]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.dividerLine} />
      <Text style={s.dividerText} maxFontSizeMultiplier={CAP}>{label}</Text>
      <LinearGradient colors={[PALETTE.borderStrong, 'rgba(203,213,225,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.dividerLine} />
    </View>
  );
}

/* =================================================================== inputs */

function useFocusGlow(focused: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: focused ? 1 : 0,
      duration: prefersReducedMotion() ? 0 : 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [focused, v]);
  return v;
}

function useShake(trigger: string) {
  const v = useRef(new Animated.Value(0)).current;
  const prev = useRef('');
  useEffect(() => {
    const had = !!prev.current;
    prev.current = trigger || '';
    if (!trigger || had || prefersReducedMotion()) return;
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [trigger, v]);
  return v.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
}

/** Label with the required mark. */
export function PremiumLabel({ label, required }: { label: string; required?: boolean }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <Text style={s.label} maxFontSizeMultiplier={CAP}>
      {label}
      {required ? <Text style={{ color: PALETTE.dangerText }}> *</Text> : null}
    </Text>
  );
}

function Message({ error, hint }: { error?: string; hint?: string }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  if (error) {
    return (
      <View style={s.msgRow} accessibilityLiveRegion="polite">
        <Icon name="error-outline" size={14} color={PALETTE.red} />
        <Text style={s.error}>{error}</Text>
      </View>
    );
  }
  return hint ? <Text style={s.hint}>{hint}</Text> : null;
}

/**
 * 52px soft-filled input: icon left, clear label above, animated accent glow
 * on focus, red fill + shake on a new error. `prefix` renders a chip before
 * the text (a phone's "+91"). Same props as the kit Field.
 */
export function PremiumInput({
  label, error, hint, icon, right, prefix, style, inputStyle, required, tone = 'member', onFocus, onBlur, ...rest
}: TextInputProps & {
  label?: string; error?: string; hint?: string; icon?: string; right?: React.ReactNode; prefix?: string;
  inputStyle?: TextStyle; required?: boolean; tone?: Tone;
}) {
  const { palette: PALETTE, premiumTone, brand: BRAND, isDark } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const [focused, setFocused] = useState(false);
  const glow = useFocusGlow(focused && !error);
  const shakeX = useShake(error || '');
  const readOnly = rest.editable === false;
  const multi = !!rest.multiline;
  const borderColor = error ? PALETTE.red : focused ? p.accent : 'transparent';
  const bg = error ? BRAND.errorFill : focused ? PALETTE.card : readOnly ? PALETTE.field : p.inputFill;
  return (
    <View style={[s.fieldWrap, style as StyleProp<ViewStyle>]}>
      {label ? <PremiumLabel label={label} required={required} /> : null}
      <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
        <Animated.View pointerEvents="none" style={[s.glow, { backgroundColor: p.accentSoft, opacity: glow }]} />
        <View
          style={[
            s.input,
            { borderColor, backgroundColor: bg },
            multi && { minHeight: 112, alignItems: 'flex-start', paddingTop: SPACE.md },
          ]}
        >
          {icon ? (
            <Icon
              name={icon}
              size={SIZE.icon}
              color={error ? PALETTE.red : focused ? p.accent : PALETTE.textMuted}
              style={{ marginRight: SPACE.sm + 2, marginTop: multi ? 2 : 0 }}
            />
          ) : null}
          {prefix ? (
            <View style={[s.prefix, { backgroundColor: p.accentSoft }]}>
              <Text style={[s.prefixText, { color: p.accentDark }]} maxFontSizeMultiplier={1.2}>{prefix}</Text>
            </View>
          ) : null}
          <TextInput
            keyboardAppearance={isDark ? 'dark' : 'light'}
            placeholderTextColor={PALETTE.textFaint}
            selectionColor={p.accent}
            accessibilityLabel={label || rest.placeholder}
            style={[s.inputText, readOnly && { color: PALETTE.textMuted }, multi && { textAlignVertical: 'top' }, inputStyle]}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            {...rest}
          />
          {right}
        </View>
      </Animated.View>
      <Message error={error} hint={hint} />
    </View>
  );
}

/**
 * Pick one — the premium look of formKit's SelectField: same behaviour
 * (inline expandable list, search past 8 options, no native Modal — Rule 2).
 */
export function PremiumSelect({
  label, value, options, onChange, placeholder = 'Select', required, disabled, hint, error, icon, emptyText, tone = 'member',
  optionEmoji, iconBadge, strong = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: string;
  /** Leading icon (e.g. 'public', 'map'). */
  icon?: string;
  emptyText?: string;
  tone?: Tone;
  /**
   * A leading emoji per option (e.g. a country's flag) — shown in each row
   * and, for the chosen value, in place of `icon`. Return '' for none.
   */
  optionEmoji?: (option: string) => string;
  /** Draw `icon` white inside a small brand-gradient tile instead of as a bare glyph. */
  iconBadge?: boolean;
  /** Emphasised admin filters; normal form fields retain their usual weight. */
  strong?: boolean;
}) {
  const { palette: PALETTE, premiumTone, brand: BRAND, isDark } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const [open, setOpen] = useState(false);
  const emojiFor = (option: string) => {
    try { return optionEmoji ? String(optionEmoji(option) || '') : ''; } catch { return ''; }
  };
  const valueEmoji = value ? emojiFor(value) : '';
  const [query, setQuery] = useState('');
  const list = useMemo(() => (options || []).filter(Boolean), [options]);
  const searchable = list.length > 8;
  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return q ? list.filter((o) => String(o || '').toLowerCase().includes(q)) : list;
  }, [list, query]);

  const toggle = () => {
    if (disabled) return;
    setQuery('');
    setOpen((prev) => !prev);
  };

  const bg = error ? BRAND.errorFill : open ? PALETTE.card : disabled ? PALETTE.field : p.inputFill;
  const borderColor = error ? PALETTE.red : open ? p.accent : 'transparent';

  return (
    <View style={s.fieldWrap}>
      <PremiumLabel label={label} required={required} />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={toggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        style={[s.input, { backgroundColor: bg, borderColor }, strong && { borderColor: disabled ? PALETTE.divider : p.accentSoft, borderWidth: 1.5 }]}
      >
        {valueEmoji ? (
          <Text style={s.emoji} maxFontSizeMultiplier={1.2}>{valueEmoji}</Text>
        ) : icon && iconBadge ? (
          <LinearGradient
            colors={disabled ? [PALETTE.textFaint, PALETTE.textMuted] : [p.glow, p.accent, p.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.iconBadge, !disabled && { shadowColor: p.shadow }]}
          >
            <Icon name={icon} size={17} color={PALETTE.white} />
          </LinearGradient>
        ) : icon ? (
          <Icon name={icon} size={SIZE.icon} color={open ? p.accent : PALETTE.textMuted} style={{ marginRight: SPACE.sm + 2 }} />
        ) : null}
        <Text
          style={[s.selectText, !value && { color: PALETTE.textFaint }, disabled && !!value && { color: PALETTE.textMuted }, strong && { fontWeight: '700', color: disabled ? PALETTE.textMuted : PALETTE.text }]}
          numberOfLines={1}
          maxFontSizeMultiplier={CAP}
        >
          {value || placeholder}
        </Text>
        <View style={[s.chevron, open && { backgroundColor: p.accentSoft }]}>
          <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={open ? p.accent : disabled ? PALETTE.textFaint : PALETTE.textMuted} />
        </View>
      </TouchableOpacity>

      {open ? (
        <View style={[s.menu, { shadowColor: p.shadow }]}>
          {searchable ? (
            <View style={s.search}>
              <Icon name="search" size={18} color={PALETTE.textFaint} />
              <TextInput
            keyboardAppearance={isDark ? 'dark' : 'light'}
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${(label || '').toLowerCase()}`}
                placeholderTextColor={PALETTE.textFaint}
                selectionColor={p.accent}
                autoCorrect={false}
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} style={s.searchClear} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Icon name="close" size={18} color={PALETTE.textFaint} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 264 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filtered.length === 0 ? (
              <View style={s.menuEmptyWrap}>
                <Icon name={list.length === 0 ? 'inbox' : 'search-off'} size={22} color={PALETTE.textFaint} />
                <Text style={s.menuEmpty}>{list.length === 0 ? (emptyText || 'Nothing to choose yet') : 'No matches'}</Text>
              </View>
            ) : (
              filtered.map((option, i) => {
                const on = option === value;
                const emoji = emojiFor(option);
                return (
                  <TouchableOpacity
                    key={`${option}-${i}`}
                    style={[s.menuItem, i === filtered.length - 1 && { borderBottomWidth: 0 }, on && { backgroundColor: p.accentSoft }]}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      onChange(option);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {emoji ? <Text style={s.emojiRow} maxFontSizeMultiplier={1.2}>{emoji}</Text> : null}
                    <Text style={[s.menuText, on && { color: p.accentDark, fontWeight: '700' }]}>{option}</Text>
                    {on ? <Icon name="check-circle" size={18} color={p.accent} /> : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}

      <Message error={error} hint={hint} />
    </View>
  );
}

/* =================================================================== avatar */

/**
 * A person: brand-gradient ring around a photo or initials, with an optional
 * status dot. Wraps the kit Avatar (photo → initials fallback on error).
 */
export function GradientAvatar({ name, uri, size = 56, tone = 'member', ring = true, status, style }: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  tone?: Tone;
  ring?: boolean;
  /** Small dot at the bottom-right. */
  status?: 'online' | 'verified' | 'pending';
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone(tone);
  const outer = Math.max(24, Number(size || 0));
  const ringW = ring ? Math.max(2, Math.round(outer * 0.05)) : 0;
  const gap = ring ? 2 : 0;
  const inner = outer - (ringW + gap) * 2;
  const dot = Math.max(10, Math.round(outer * 0.26));
  const dotColor = status === 'online' ? PALETTE.green : status === 'pending' ? PALETTE.amber : p.accent;
  return (
    <View style={[{ width: outer, height: outer }, style]}>
      <LinearGradient
        colors={ring ? [p.glow, p.accent, p.accentDark] : ['transparent', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: outer, height: outer, borderRadius: outer / 2, padding: ringW, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ padding: gap, borderRadius: outer / 2, backgroundColor: PALETTE.card }}>
          <Avatar name={name} uri={uri} size={inner} color={p.accentDark} bg={p.accentSoft} />
        </View>
      </LinearGradient>
      {status ? (
        <View style={[s.avatarDot, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: dotColor }]}>
          {status === 'verified' ? <Icon name="check" size={Math.round(dot * 0.7)} color={PALETTE.white} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/* =================================================================== styles */

const makeStyles = ({ palette: PALETTE, type: TYPE, brand: BRAND }: AppTheme) => StyleSheet.create({
  btn: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, overflow: 'hidden' },
  btnShadow: {
    borderRadius: 999,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  btnSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.10)' },
  btnOutline: { borderWidth: 1.5, backgroundColor: PALETTE.card },
  btnGlass: { borderWidth: 1, borderColor: BRAND.glassBorder, backgroundColor: BRAND.glass },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  btnText: { fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: 0.2, flexShrink: 1, textAlign: 'center' },

  footerRow: { flex: 1, flexDirection: 'row', gap: SPACE.md },
  footerSecondary: { minWidth: 96 },

  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm + 2,
    height: 50,
    paddingHorizontal: SPACE.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  socialCompact: { paddingHorizontal: SPACE.sm, gap: 6 },
  socialLogo: { width: 20, height: 20 },
  socialTextCompact: { fontSize: 13, flexShrink: 1 },
  dim: { opacity: 0.5 },
  socialText: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: PALETTE.text, flexShrink: 1 },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: SPACE.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.borderStrong,
    backgroundColor: PALETTE.card,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  socialBtnPressed: { backgroundColor: PALETTE.field, borderColor: PALETTE.borderStrong },
  socialBtnSlot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  socialBtnText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: PALETTE.text,
    paddingHorizontal: SPACE.sm,
  },

  portalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    gap: SPACE.md,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: PALETTE.card,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  portalTile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  portalBody: { flex: 1, minWidth: 0 },
  portalQuestion: { fontSize: 12.5, lineHeight: 16, fontWeight: '500', color: PALETTE.textMuted },
  portalAction: { fontSize: 15.5, lineHeight: 20, fontWeight: '700', marginTop: 2 },
  portalChevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  glassIcon: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.glass,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
  },

  logoBox: {
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },

  glassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: SPACE.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: BRAND.glassStrong,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
  },
  glassBadgeText: { ...PREMIUM_TYPE.eyebrow, color: PALETTE.white },

  eyebrow: { ...PREMIUM_TYPE.eyebrow, color: BRAND.onBrandFaint, marginBottom: SPACE.sm },
  heroText: { color: PALETTE.white },
  lead: { ...PREMIUM_TYPE.lead, color: BRAND.onBrandSoft, marginTop: SPACE.sm },

  sheet: {
    backgroundColor: PALETTE.card,
    borderRadius: PREMIUM_RADIUS.sheet,
    marginHorizontal: SPACE.lg,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xl + 4,
    paddingBottom: SPACE.xl,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
  },

  section: {
    backgroundColor: PALETTE.card,
    borderRadius: PREMIUM_RADIUS.section,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.lg,
    padding: SPACE.lg + 2,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 22,
    elevation: 5,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg + 2 },
  sectionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 22 },
  sectionSub: { ...TYPE.caption, marginTop: 2 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: SPACE.lg },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { ...TYPE.eyebrow, color: PALETTE.textFaint },

  fieldWrap: { marginBottom: SPACE.lg },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft, marginBottom: SPACE.sm, marginLeft: 2 },
  glow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: PREMIUM_RADIUS.input + 4 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: PREMIUM_RADIUS.input,
    borderWidth: 1.5,
    paddingHorizontal: SPACE.lg - 2,
  },
  inputText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: PALETTE.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  prefix: { borderRadius: 8, paddingHorizontal: SPACE.sm, paddingVertical: 4, marginRight: SPACE.sm + 2 },
  prefixText: { fontSize: 14, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: 6, marginLeft: 2 },
  error: { flex: 1, color: PALETTE.redDark, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  hint: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 16, marginTop: 6, marginLeft: 2 },

  emoji: { fontSize: 20, lineHeight: 26, marginRight: SPACE.sm + 2 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACE.sm + 4,
    marginLeft: -4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  emojiRow: { fontSize: 20, lineHeight: 26 },
  selectText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, color: PALETTE.text },
  chevron: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  menu: {
    marginTop: SPACE.sm,
    borderRadius: PREMIUM_RADIUS.input,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingLeft: SPACE.md, minHeight: SIZE.touch,
    borderBottomWidth: 1, borderBottomColor: PALETTE.divider,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: PALETTE.text, paddingVertical: SPACE.sm + 2 },
  searchClear: { width: SIZE.touch, height: SIZE.touch, alignItems: 'center', justifyContent: 'center' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm,
    paddingHorizontal: SPACE.lg - 2, paddingVertical: SPACE.sm + 2, minHeight: SIZE.touch + 4,
    borderBottomWidth: 1, borderBottomColor: PALETTE.divider,
  },
  menuText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, color: PALETTE.textSoft },
  menuEmptyWrap: { alignItems: 'center', gap: SPACE.xs, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.lg },
  menuEmpty: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center' },

  avatarDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

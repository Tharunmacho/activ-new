import { AppTheme, useAppTheme, useThemeStyles } from './AppTheme';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  StatusBar,
  ViewStyle,
  StyleProp,
  TextStyle,
  TextInputProps,
  ScrollView,
  RefreshControl,
  Image,
  Switch,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RADIUS, SPACE, SHADOW, SIZE, Tone, GRADIENTS } from './tokens';

/**
 * ============================================================================
 * THE ACTIV MOBILE DESIGN KIT — components
 * ============================================================================
 *
 * Build every screen from these. Module-level components only (a component
 * declared inside another remounts its inputs on every keystroke).
 * See the style guide at the top of `src/ui/index.ts` for composition rules.
 *
 * RULES OF USE (CLAUDE.md applies):
 *   - Inside a tab navigator that already applies the safe area, use
 *     <Screen edges={[]} …> — never double-wrap the top inset.
 *   - Lists: FlatList with keyExtractor + initialNumToRender={10} +
 *     maxToRenderPerBatch={10}; wrap the list in <Screen scroll={false}>.
 *   - Every data screen shows <Loading/>, <ErrorState onRetry/> or
 *     <EmptyState/> — never a blank screen or a spinner forever.
 */

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };
/** Caps OS font scaling on compact controls so a label can't burst its pill. */
const CAP = 1.3;

/* ------------------------------------------------------------------ Screen */

export function Screen({
  children, tone = 'member', edges = ['top'], scroll = true, refreshing, onRefresh, style, contentStyle,
  statusBar, footer, avoidKeyboard = false,
}: {
  children: React.ReactNode;
  tone?: Tone;
  /** Safe-area edges. Default ['top']. Use [] inside a navigator/dashboard that already pads the top. */
  edges?: Edge[];
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  statusBar?: 'dark-content' | 'light-content';
  /** Pinned below the scroll area — pass a <BottomActionBar>. */
  footer?: React.ReactNode;
  /** Lift the content above the keyboard on iOS (forms). Android resizes natively. */
  avoidKeyboard?: boolean;
}) {
  const { toneOf, isDark } = useAppTheme();
  const t = toneOf(tone);
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingBottom: footer ? SPACE.xl : SPACE.huge + SPACE.sm }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[t.accent]} tintColor={t.accent} />
      ) : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: t.canvas }, style]} edges={edges}>
      <StatusBar barStyle={statusBar ?? (isDark ? 'light-content' : 'dark-content')} />
      {avoidKeyboard && Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {body}
          {footer || null}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {footer || null}
        </>
      )}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ Header */

export function AppHeader({
  title, subtitle, onBack, right, tone = 'member', onMenu, eyebrow, border = false, style,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  /** Right-side actions — one or two <IconButton>s. */
  right?: React.ReactNode;
  tone?: Tone;
  /** Tiny uppercase line above the title (e.g. "BLOCK ADMIN"). */
  eyebrow?: string;
  /** Hairline under the bar — use when content scrolls directly beneath it. */
  border?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  const lead = onMenu
    ? <IconButton icon="menu" onPress={onMenu} accessibilityLabel="Open menu" />
    : onBack
      ? <IconButton icon={Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back'} onPress={onBack} accessibilityLabel="Go back" size={Platform.OS === 'ios' ? 18 : 22} />
      : null;
  return (
    <View style={[s.header, border && s.headerBorder, style]}>
      {lead}
      <View style={[s.headerText, !lead && { marginLeft: 0 }]}>
        {eyebrow ? <Text style={[s.headerEyebrow, { color: t.accentDark }]} maxFontSizeMultiplier={CAP}>{eyebrow}</Text> : null}
        <Text style={s.headerTitle} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{String(title ?? '')}</Text>
        {subtitle ? <Text style={s.headerSub} maxFontSizeMultiplier={CAP}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={s.headerRight}>{right}</View> : null}
    </View>
  );
}

export function IconButton({
  icon, onPress, accessibilityLabel, color, badge, style, variant = 'surface', size = 22, disabled,
}: {
  icon: string;
  onPress?: () => void;
  accessibilityLabel: string;
  color?: string;
  badge?: number;
  style?: StyleProp<ViewStyle>;
  /** surface = white circle with border (default) · ghost = no chrome · tinted = soft accent fill. */
  variant?: 'surface' | 'ghost' | 'tinted';
  size?: number;
  disabled?: boolean;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const count = Number(badge || 0);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.iconBtn, variant === 'ghost' && s.iconBtnGhost, variant === 'tinted' && s.iconBtnTinted, disabled && { opacity: 0.45 }, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      activeOpacity={0.65}
      hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
    >
      <Icon name={icon} size={size} color={color ?? PALETTE.textSoft} />
      {count > 0 ? (
        <View style={s.iconBadge}><Text style={s.iconBadgeText} maxFontSizeMultiplier={1}>{count > 99 ? '99+' : String(count)}</Text></View>
      ) : null}
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ Hero */

/** The gradient hero card at the top of a dashboard or detail screen. */
export function Hero({
  eyebrow, title, subtitle, children, tone = 'member', colors, icon, style, right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  tone?: Tone;
  colors?: string[];
  icon?: string;
  /** Margins only — the hero owns its padding. */
  style?: StyleProp<ViewStyle>;
  /** Replaces the icon tile (e.g. an <Avatar>). */
  right?: React.ReactNode;
}) {
  const { palette: PALETTE, toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const grad = (colors && colors.length >= 2) ? colors : toneOf(tone).gradient;
  return (
    // Shadow lives on the wrapper: a shadow on the clipped gradient is invisible on iOS.
    <View style={[s.heroWrap, SHADOW.lifted, { shadowColor: grad[grad.length - 1] || PALETTE.text, backgroundColor: grad[0] }, style]}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroBlob1} />
        <View style={s.heroBlob2} />
        <View style={s.heroTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {eyebrow ? <Text style={s.heroEyebrow} numberOfLines={1} maxFontSizeMultiplier={CAP}>{eyebrow}</Text> : null}
            <Text style={s.heroTitle} numberOfLines={2} accessibilityRole="header" maxFontSizeMultiplier={CAP}>{String(title ?? '')}</Text>
            {subtitle ? <Text style={s.heroSub} numberOfLines={3}>{subtitle}</Text> : null}
          </View>
          {right ? <View style={{ marginLeft: SPACE.md }}>{right}</View>
            : icon ? <View style={s.heroIcon}><Icon name={icon} size={24} color="#FFFFFF" /></View> : null}
        </View>
        {children ? <View style={{ marginTop: SPACE.lg }}>{children}</View> : null}
      </LinearGradient>
    </View>
  );
}

/* ------------------------------------------------------------------ Cards, sections */

export function Card({ children, style, onPress, padded = true, accessibilityLabel, variant = 'elevated' }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
  /** elevated = border + soft shadow (default) · outlined = border only · tinted = accent-soft fill, no shadow. */
  variant?: 'elevated' | 'outlined' | 'tinted';
}) {
  const s = useThemeStyles(makeStyles);
  const look = variant === 'outlined' ? s.cardOutlined : variant === 'tinted' ? s.cardTinted : SHADOW.card;
  if (!onPress) {
    return <View style={[s.card, look, padded && s.cardPad, style]}>{children}</View>;
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {({ pressed }) => (
        <View style={[s.card, look, padded && s.cardPad, style, pressed && s.cardPressed]}>{children}</View>
      )}
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction, style, subtitle, tone = 'member' }: {
  title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>; subtitle?: string; tone?: Tone;
}) {
  const { toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  return (
    <View style={[s.sectionRow, style]}>
      <View style={s.sectionText}>
        <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={HIT} style={s.sectionActionBtn} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={[s.sectionAction, { color: t.accentDark }]} maxFontSizeMultiplier={CAP}>{action}</Text>
          <Icon name="chevron-right" size={18} color={t.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** SectionTitle + a block of content on the screen gutter. */
export function Section({ title, subtitle, action, onAction, tone, children, style, first }: {
  title?: string; subtitle?: string; action?: string; onAction?: () => void; tone?: Tone;
  children: React.ReactNode; style?: StyleProp<ViewStyle>;
  /** The first section under a header: smaller top gap. */
  first?: boolean;
}) {
  return (
    <View style={[{ marginTop: first ? SPACE.sm : 0 }, style]}>
      {title ? <SectionTitle title={title} subtitle={subtitle} action={action} onAction={onAction} tone={tone} style={first ? { marginTop: SPACE.md } : undefined} /> : null}
      <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ Stats */

const StatColumns = createContext<2 | 3>(2);

/** A small stat tile — two (or three) per row inside <StatGrid>. Equal heights per row. */
export function StatTile({ label, value, icon, color, soft, hint, onPress }: {
  label: string; value: string | number; icon: string; color?: string; soft?: string; hint?: string; onPress?: () => void;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const cols = useContext(StatColumns);
  const shown = value === null || value === undefined || value === '' ? '—' : String(value);
  const inner = (
    <>
      <View style={s.statHead}>
        <View style={[s.statIcon, { backgroundColor: soft ?? PALETTE.blueSoft }]}><Icon name={icon} size={SIZE.icon} color={color ?? PALETTE.blueDark} /></View>
        {onPress ? <Icon name="arrow-outward" size={16} color={PALETTE.textFaint} /> : null}
      </View>
      <Text style={[s.statValue, cols === 3 && { fontSize: 20, lineHeight: 26 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={CAP}>{shown}</Text>
      <Text style={s.statLabel} numberOfLines={2} maxFontSizeMultiplier={CAP}>{label}</Text>
      {hint ? <Text style={s.statHint} numberOfLines={1} maxFontSizeMultiplier={CAP}>{hint}</Text> : null}
    </>
  );
  return (
    <View style={[s.statCell, { width: cols === 3 ? '31.5%' : '48.5%' }]}>
      {onPress ? (
        <Pressable onPress={onPress} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`}>
          {({ pressed }) => <View style={[s.card, SHADOW.card, s.stat, pressed && s.cardPressed]}>{inner}</View>}
        </Pressable>
      ) : (
        <View style={[s.card, SHADOW.card, s.stat]} accessible accessibilityLabel={`${label}: ${shown}`}>{inner}</View>
      )}
    </View>
  );
}

export function StatGrid({ children, columns = 2, style }: { children: React.ReactNode; columns?: 2 | 3; style?: StyleProp<ViewStyle> }) {
  const s = useThemeStyles(makeStyles);
  return (
    <StatColumns.Provider value={columns}>
      <View style={[s.statGrid, style]}>{children}</View>
    </StatColumns.Provider>
  );
}

/* ------------------------------------------------------------------ Rows */

/** A tappable row: icon, title, subtitle, trailing text/chevron. Use inside a Card. */
export function ListRow({ icon, iconColor, iconBg, title, subtitle, meta, right, onPress, danger, last, disabled, leading }: {
  icon?: string; iconColor?: string; iconBg?: string; title: string; subtitle?: string; meta?: string;
  right?: React.ReactNode; onPress?: () => void; danger?: boolean; last?: boolean; disabled?: boolean;
  /** Replaces the icon chip (e.g. an <Avatar size={40}>). */
  leading?: React.ReactNode;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const hasLead = !!leading || !!icon;
  const content = (pressed = false) => (
    <View style={[s.row, pressed && { opacity: 0.6 }, disabled && { opacity: 0.45 }]}>
      {leading ? <View style={s.rowLead}>{leading}</View>
        : icon ? <View style={[s.rowIcon, { backgroundColor: danger ? PALETTE.redSoft : (iconBg ?? PALETTE.blueSoft) }]}><Icon name={icon} size={SIZE.icon} color={danger ? PALETTE.red : (iconColor ?? PALETTE.blueDark)} /></View> : null}
      <View style={s.rowText}>
        <Text style={[s.rowTitle, danger && { color: PALETTE.dangerText }]} numberOfLines={2}>{String(title ?? '')}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={s.rowMeta} numberOfLines={1} maxFontSizeMultiplier={CAP}>{meta}</Text> : null}
      {right !== undefined ? right : onPress ? <Icon name="chevron-right" size={22} color={PALETTE.textFaint} /> : null}
      {!last ? <View style={[s.rowDividerLine, { left: hasLead ? SIZE.iconChip + SPACE.md : 0 }]} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} accessibilityState={{ disabled: !!disabled }}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  ) : content(false);
}

/** Label / value pairs inside a card. Long values wrap; nothing is truncated. */
export function InfoRow({ label, value, last, inline = false, icon }: {
  label: string; value?: string | number | null; last?: boolean;
  /** Label left, value right on one line (short values: dates, amounts, ids). Default stacked. */
  inline?: boolean;
  icon?: string;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const shown = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <View style={[inline ? s.infoInline : s.info, !last && s.rowDivider]}>
      <View style={[s.infoLabelRow, inline && s.infoLabelInline]}>
        {icon ? <Icon name={icon} size={SIZE.iconSm} color={PALETTE.textFaint} style={{ marginRight: 6 }} /> : null}
        <Text style={[s.infoLabel, inline && s.infoLabelTextInline]}>{label}</Text>
      </View>
      <Text style={[s.infoValue, inline && s.infoValueInline, shown === '—' && { color: PALETTE.textFaint }]} selectable>{shown}</Text>
    </View>
  );
}

/** A 2-column grid of label/value cells — compact summaries (amount, date, id, plan). */
export function KeyValueGrid({ items, columns = 2, style }: {
  items: { label: string; value?: string | number | null; icon?: string }[];
  columns?: 2 | 3;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const list = Array.isArray(items) ? items : [];
  return (
    <View style={[s.kvGrid, style]}>
      {list.map((it, i) => {
        const v = it?.value;
        const shown = v === null || v === undefined || v === '' ? '—' : String(v);
        return (
          <View key={`${it?.label || ''}-${i}`} style={[s.kvCell, { width: columns === 3 ? '33.33%' : '50%' }]}>
            <View style={s.kvLabelRow}>
              {it?.icon ? <Icon name={it.icon} size={14} color={PALETTE.textFaint} style={{ marginRight: 4 }} /> : null}
              <Text style={s.kvLabel} numberOfLines={1}>{String(it?.label || '')}</Text>
            </View>
            <Text style={s.kvValue} selectable>{shown}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A setting row with a switch. */
export function ToggleRow({ title, subtitle, value, onValueChange, icon, disabled, last, tone = 'member' }: {
  title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void;
  icon?: string; disabled?: boolean; last?: boolean; tone?: Tone;
}) {
  const { palette: PALETTE, toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  return (
    <View style={[s.row, disabled && { opacity: 0.5 }]}>
      {icon ? <View style={[s.rowIcon, { backgroundColor: t.accentSoft }]}><Icon name={icon} size={SIZE.icon} color={t.accent} /></View> : null}
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={s.rowSub} numberOfLines={3}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={(v) => { try { onValueChange?.(v); } catch (err) { console.warn('ToggleRow handler failed:', err); } }}
        disabled={disabled}
        trackColor={{ false: PALETTE.borderStrong, true: t.accent }}
        thumbColor={Platform.OS === 'android' ? PALETTE.white : undefined}
        ios_backgroundColor={PALETTE.borderStrong}
        accessibilityLabel={title}
      />
      {!last ? <View style={[s.rowDividerLine, { left: icon ? SIZE.iconChip + SPACE.md : 0 }]} /> : null}
    </View>
  );
}

export function Divider({ inset = 0, spacing = 0, style }: {
  /** Left indent in px (e.g. 52 to align under row text). */
  inset?: number;
  /** Vertical margin above and below. */
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: PALETTE.divider, marginLeft: inset, marginVertical: spacing }, style]} />;
}

export function Spacer({ size = SPACE.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

/* ------------------------------------------------------------------ Badges, chips, tabs */

export function Badge({ label, status, color, bg, style, icon, size = 'md', dot }: {
  label: string; status?: string; color?: string; bg?: string; style?: StyleProp<ViewStyle>;
  icon?: string; size?: 'sm' | 'md';
  /** Leading coloured dot (live / status). */
  dot?: boolean;
}) {
  const { statusTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = statusTone(status || label);
  const fg = color || t.fg;
  return (
    <View style={[s.badge, size === 'sm' && s.badgeSm, { backgroundColor: bg || t.bg }, style]}>
      {dot ? <View style={[s.badgeDot, { backgroundColor: fg }]} /> : null}
      {icon ? <Icon name={icon} size={size === 'sm' ? 11 : 13} color={fg} /> : null}
      <Text style={[s.badgeText, size === 'sm' && { fontSize: 10 }, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{String(label ?? '')}</Text>
    </View>
  );
}

/** One pill. selected → filled. Use for filters, tags, quick picks. */
export function Chip({ label, selected = false, onPress, icon, count, tone = 'member', disabled, style }: {
  label: string; selected?: boolean; onPress?: () => void; icon?: string; count?: number;
  tone?: Tone; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE, toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  const fg = selected ? t.accentDark : PALETTE.textSoft;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.75}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[s.chip, selected && { backgroundColor: t.accentSoft, borderColor: t.accent }, disabled && { opacity: 0.45 }, style]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected, disabled: !!disabled }}
    >
      {selected ? <Icon name="check" size={15} color={fg} /> : icon ? <Icon name={icon} size={15} color={fg} /> : null}
      <Text style={[s.chipText, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{String(label ?? '')}</Text>
      {typeof count === 'number' ? <Text style={[s.chipCount, { color: selected ? t.accentDark : PALETTE.textMuted }]} maxFontSizeMultiplier={CAP}>{count}</Text> : null}
    </TouchableOpacity>
  );
}

/** Alias: a Chip used as a toggleable filter. */
export const FilterChip = Chip;

/** A horizontally scrolling row of pick-one chips (5+ options, or long labels). */
export function FilterChips<T extends string>({ options, value, onChange, tone = 'member', style }: {
  options: { value: T; label: string; count?: number; icon?: string }[];
  value: T; onChange: (v: T) => void; tone?: Tone; style?: StyleProp<ViewStyle>;
}) {
  const s = useThemeStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={s.chipRow} accessibilityRole="radiogroup">
      {(options || []).map((o) => (
        <Chip key={String(o?.value)} label={o?.label} icon={o?.icon} count={o?.count} tone={tone}
          selected={o?.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

/**
 * Pick-one tabs (radio semantics).
 * <= 4 options: an equal-width segmented track that fits 360dp without scrolling.
 * 5+ options (or scrollable): horizontally scrolling pills.
 */
export function SegmentedTabs<T extends string>({ options, value, onChange, tone = 'member', scrollable, style }: {
  options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; tone?: Tone;
  scrollable?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  const list = options || [];
  const scroll = scrollable ?? list.length > 4;
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={s.tabs} accessibilityRole="radiogroup">
        {list.map((o) => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[s.tab, on ? { backgroundColor: t.accent, borderColor: t.accent } : null]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, on && { color: '#FFFFFF' }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{o.label}</Text>
              {typeof o.count === 'number' ? (
                <View style={[s.tabCount, on && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                  <Text style={[s.tabCountText, on && { color: '#FFFFFF' }]} maxFontSizeMultiplier={1}>{o.count > 999 ? '999+' : o.count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }
  return (
    <View style={[s.segWrap, style]} accessibilityRole="radiogroup">
      <View style={s.segTrack}>
        {list.map((o) => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[s.seg, on && s.segOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              accessibilityLabel={typeof o.count === 'number' ? `${o.label}, ${o.count}` : o.label}
              activeOpacity={0.8}
            >
              <Text style={[s.segText, on && { color: t.accentDark }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={CAP}>
                {o.label}
              </Text>
              {typeof o.count === 'number' ? (
                <Text style={[s.segCount, on && { color: t.accentDark }]} numberOfLines={1} maxFontSizeMultiplier={1}>{o.count > 999 ? '999+' : o.count}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ Buttons */

export type ButtonVariant = 'solid' | 'outline' | 'danger' | 'gold' | 'secondary' | 'ghost' | 'dangerOutline';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string; onPress?: () => void; loading?: boolean; disabled?: boolean; icon?: string; tone?: Tone;
  style?: StyleProp<ViewStyle>; size?: ButtonSize; iconRight?: string; accessibilityLabel?: string;
};

export function PrimaryButton({ label, onPress, loading, disabled, icon, tone = 'member', variant = 'solid', style, size = 'md', iconRight, accessibilityLabel }: ButtonProps & {
  variant?: ButtonVariant;
}) {
  const { palette: PALETTE, toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  const off = !!disabled || !!loading;
  const height = size === 'sm' ? SIZE.controlSm : size === 'lg' ? SIZE.controlLg : SIZE.control;
  const fontSize = size === 'sm' ? 14 : 15;
  const gradient = variant === 'solid' || variant === 'danger' || variant === 'gold';
  const fg = gradient ? '#FFFFFF'
    : variant === 'dangerOutline' ? PALETTE.dangerText
    : t.accentDark;
  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: accessibilityLabel || label,
    accessibilityState: { disabled: off, busy: !!loading },
  };
  const inner = (color: string) => (loading ? <ActivityIndicator color={color} /> : (
    <View style={s.btnInner}>
      {icon ? <Icon name={icon} size={18} color={color} /> : null}
      <Text style={[s.btnText, { color, fontSize }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{label}</Text>
      {iconRight ? <Icon name={iconRight} size={18} color={color} /> : null}
    </View>
  ));

  // Disabled (not loading): flat neutral fill — reads as unavailable, not as a faded brand button.
  if (disabled && !loading && variant !== 'ghost') {
    return (
      <View style={[s.btn, { minHeight: height, backgroundColor: PALETTE.disabled }, style]} {...a11y}>
        {inner(PALETTE.textFaint)}
      </View>
    );
  }

  if (!gradient) {
    const look: ViewStyle = variant === 'outline' ? { borderWidth: 1.5, borderColor: t.accent, backgroundColor: PALETTE.card }
      : variant === 'dangerOutline' ? { borderWidth: 1.5, borderColor: PALETTE.red, backgroundColor: PALETTE.card }
      : variant === 'secondary' ? { backgroundColor: t.accentSoft }
      : { backgroundColor: 'transparent' };
    return (
      <Pressable onPress={onPress} disabled={off} style={style} {...a11y}>
        {({ pressed }) => (
          <View style={[s.btn, { minHeight: height }, look, pressed && { opacity: 0.7 }, disabled && { opacity: 0.45 }]}>
            {inner(fg)}
          </View>
        )}
      </Pressable>
    );
  }

  const colors = variant === 'danger' ? GRADIENTS.danger : variant === 'gold' ? GRADIENTS.gold : t.button;
  const glow = variant === 'danger' ? PALETTE.red : variant === 'gold' ? PALETTE.gold : t.accent;
  return (
    <Pressable onPress={onPress} disabled={off} style={style} {...a11y}>
      {({ pressed }) => (
        <View style={[s.btnShadow, { shadowColor: glow, backgroundColor: colors[colors.length - 1] }, (pressed || loading) && { opacity: 0.88 }]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btn, { minHeight: height }]}>
            {inner('#FFFFFF')}
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

/** Soft accent fill — the second action beside a PrimaryButton. */
export function SecondaryButton(props: ButtonProps) {
  return <PrimaryButton {...props} variant="secondary" />;
}

/** Text-only button — tertiary actions ("Skip", "View all"). */
export function GhostButton(props: ButtonProps) {
  return <PrimaryButton {...props} variant="ghost" />;
}

/** Destructive action. `outline` for a less final one (e.g. "Remove"). */
export function DangerButton({ outline, ...props }: ButtonProps & { outline?: boolean }) {
  return <PrimaryButton {...props} variant={outline ? 'dangerOutline' : 'danger'} />;
}

/** Sticky footer holding the screen's main action(s). Pass as <Screen footer={…}>. */
export function BottomActionBar({ children, safeBottom = true, style, note }: {
  children: React.ReactNode;
  /** Pad for the home indicator. Set false inside a bottom-tab screen (the tab bar already does). */
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Small line above the buttons (e.g. "You will be charged ₹5,000"). */
  note?: string;
}) {
  const s = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const bottom = safeBottom ? Math.max(Number(insets?.bottom || 0), SPACE.md) : SPACE.md;
  return (
    <View style={[s.bar, SHADOW.top, { paddingBottom: bottom }, style]}>
      {note ? <Text style={s.barNote} numberOfLines={2}>{note}</Text> : null}
      <View style={s.barRow}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ Field */

export function Field({ label, error, hint, icon, right, style, inputStyle, required, tone = 'member', onFocus, onBlur, ...rest }: TextInputProps & {
  label?: string; error?: string; hint?: string; icon?: string; right?: React.ReactNode; inputStyle?: TextStyle;
  required?: boolean; tone?: Tone;
}) {
  const { palette: PALETTE, toneOf, isDark } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  const [focused, setFocused] = useState(false);
  const readOnly = rest.editable === false;
  const multi = !!rest.multiline;
  const borderColor = error ? PALETTE.red : focused ? t.accent : PALETTE.border;
  return (
    <View style={[{ marginBottom: SPACE.md }, style as StyleProp<ViewStyle>]}>
      {label ? (
        <Text style={s.fieldLabel} maxFontSizeMultiplier={CAP}>
          {label}{required ? <Text style={{ color: PALETTE.dangerText }}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          s.field,
          { borderColor },
          focused && !error && { backgroundColor: PALETTE.card, ...s.fieldFocus, shadowColor: t.accent },
          readOnly && { backgroundColor: PALETTE.field },
          multi && { minHeight: 104, alignItems: 'flex-start', paddingTop: SPACE.sm + 2 },
        ]}
      >
        {icon ? <Icon name={icon} size={SIZE.icon} color={focused ? t.accent : PALETTE.textFaint} style={{ marginRight: SPACE.sm, marginTop: multi ? 2 : 0 }} /> : null}
        <TextInput
            keyboardAppearance={isDark ? 'dark' : 'light'}
          placeholderTextColor={PALETTE.textFaint}
          selectionColor={t.accent}
          accessibilityLabel={label || rest.placeholder}
          style={[s.fieldInput, readOnly && { color: PALETTE.textMuted }, multi && { textAlignVertical: 'top' }, inputStyle]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <View style={s.fieldMsgRow}>
          <Icon name="error-outline" size={14} color={PALETTE.red} />
          <Text style={s.fieldError}>{error}</Text>
        </View>
      ) : hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ States */

export function Loading({ label = 'Loading…', tone = 'member', compact }: { label?: string; tone?: Tone; compact?: boolean }) {
  const { toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.state, compact && { paddingVertical: SPACE.xl }]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size={compact ? 'small' : 'large'} color={toneOf(tone).accent} />
      {label ? <Text style={s.stateText}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = 'inbox', title, message, action, onAction, tone = 'member', compact, actionIcon }: {
  icon?: string; title: string; message?: string; action?: string; onAction?: () => void; tone?: Tone;
  /** Less vertical space — inside a card or under filters. */
  compact?: boolean;
  actionIcon?: string;
}) {
  const { toneOf } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const t = toneOf(tone);
  return (
    <View style={[s.state, compact && { paddingVertical: SPACE.xxl }]}>
      <View style={[s.stateHalo, { backgroundColor: t.accentTint }]}>
        <View style={[s.stateIcon, { backgroundColor: t.accentSoft }]}><Icon name={icon} size={30} color={t.accent} /></View>
      </View>
      <Text style={s.stateTitle}>{title}</Text>
      {message ? <Text style={s.stateText}>{message}</Text> : null}
      {action && onAction ? <PrimaryButton label={action} icon={actionIcon} onPress={onAction} tone={tone} style={{ marginTop: SPACE.xl, minWidth: 180 }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry, tone = 'member', title = 'Could not load this' }: {
  message?: string; onRetry?: () => void; tone?: Tone; title?: string;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={s.state}>
      <View style={[s.stateHalo, { backgroundColor: PALETTE.dangerSoft }]}>
        <View style={[s.stateIcon, { backgroundColor: PALETTE.redSoft }]}><Icon name="cloud-off" size={30} color={PALETTE.red} /></View>
      </View>
      <Text style={s.stateTitle}>{title}</Text>
      <Text style={s.stateText}>{message || 'Check your connection and try again.'}</Text>
      {onRetry ? <PrimaryButton label="Try again" icon="refresh" onPress={onRetry} tone={tone} variant="outline" style={{ marginTop: SPACE.xl, minWidth: 160 }} /> : null}
    </View>
  );
}

/** A soft note/banner inside a screen (info, warning, success, danger). */
export function Notice({ text, kind = 'info', icon, action, onAction, title, style }: {
  text: string; kind?: 'info' | 'warning' | 'success' | 'danger'; icon?: string; action?: string; onAction?: () => void;
  title?: string; style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const map = {
    info: { fg: PALETTE.blueDark, bg: PALETTE.blueSoft, line: PALETTE.border, i: 'info-outline' },
    warning: { fg: PALETTE.warningText, bg: PALETTE.warningSoft, line: PALETTE.border, i: 'warning-amber' },
    success: { fg: PALETTE.successText, bg: PALETTE.successSoft, line: PALETTE.border, i: 'check-circle-outline' },
    danger: { fg: PALETTE.dangerText, bg: PALETTE.dangerSoft, line: PALETTE.border, i: 'error-outline' },
  }[kind] || { fg: PALETTE.blueDark, bg: PALETTE.blueSoft, line: PALETTE.border, i: 'info-outline' };
  return (
    <View style={[s.notice, { backgroundColor: map.bg, borderColor: map.line }, style]} accessibilityRole={kind === 'danger' ? 'alert' : undefined}>
      <Icon name={icon || map.i} size={20} color={map.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? <Text style={[s.noticeTitle, { color: map.fg }]}>{title}</Text> : null}
        <Text style={[s.noticeText, { color: map.fg }]}>{text}</Text>
        {action && onAction ? (
          <TouchableOpacity onPress={onAction} hitSlop={HIT} style={{ marginTop: SPACE.sm, alignSelf: 'flex-start' }} accessibilityRole="button">
            <Text style={[s.noticeAction, { color: map.fg }]}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ Skeleton */

/** A pulsing placeholder block. Compose several to mimic the content that is loading. */
export function Skeleton({ width = '100%', height = 14, radius = RADIUS.sm, style }: {
  width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: PALETTE.disabled, opacity: pulse }, style]} />;
}

/** A ready-made loading list: `rows` card-shaped skeletons on the screen gutter. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  const s = useThemeStyles(makeStyles);
  const n = Math.max(1, Math.min(Number(rows || 4), 12));
  return (
    <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingTop: SPACE.md }} accessibilityLabel="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={[s.card, s.cardPad, { flexDirection: 'row', alignItems: 'center', gap: SPACE.md }]}>
          <Skeleton width={SIZE.iconChip} height={SIZE.iconChip} radius={RADIUS.md} />
          <View style={{ flex: 1, gap: SPACE.sm }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="85%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({ name, size = 44, color, bg, uri, style, ring }: {
  name?: string | null; size?: number; color?: string; bg?: string;
  /** Photo URL. Falls back to initials when missing or when it fails to load. */
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  /** White ring — for avatars sitting on a gradient or overlapping a photo. */
  ring?: boolean;
}) {
  const { palette: PALETTE } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const src = typeof uri === 'string' ? uri.trim() : '';
  useEffect(() => { setFailed(false); }, [src]);
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length === 0 ? '?' : parts.length === 1
    ? (parts[0] || '').charAt(0).toUpperCase()
    : `${(parts[0] || '').charAt(0)}${(parts[parts.length - 1] || '').charAt(0)}`.toUpperCase();
  const box: ViewStyle = {
    width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? PALETTE.blueSoft,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...(ring ? { borderWidth: 2, borderColor: PALETTE.white } : null),
  };
  return (
    <View style={[box, style]} accessibilityRole="image" accessibilityLabel={name ? `${name}` : 'Avatar'}>
      {src && !failed ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Text style={{ color: color ?? PALETTE.blueDark, fontWeight: '700', fontSize: Math.round(size * 0.36), letterSpacing: 0.2 }} maxFontSizeMultiplier={1}>{initials}</Text>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, minHeight: SIZE.header + SPACE.sm },
  headerBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: PALETTE.borderStrong },
  headerText: { flex: 1, minWidth: 0, marginHorizontal: SPACE.md, justifyContent: 'center' },
  headerEyebrow: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, marginBottom: 1 },
  headerTitle: { ...TYPE.title },
  headerSub: { ...TYPE.caption, fontSize: 13, lineHeight: 18, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  iconBtn: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, backgroundColor: PALETTE.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PALETTE.border },
  iconBtnGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  iconBtnTinted: { backgroundColor: PALETTE.blueSoft, borderColor: 'transparent' },
  iconBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: PALETTE.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: PALETTE.card },
  iconBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  heroWrap: { marginHorizontal: SPACE.lg, borderRadius: RADIUS.xl },
  hero: { borderRadius: RADIUS.xl, padding: SPACE.xl, overflow: 'hidden' },
  heroBlob1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 },
  heroBlob2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -60, left: -40 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACE.sm - 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 20, marginTop: SPACE.sm - 2 },
  heroIcon: { width: 48, height: 48, borderRadius: RADIUS.md + 2, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginLeft: SPACE.md },

  card: { backgroundColor: PALETTE.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: PALETTE.border },
  cardPad: { padding: SPACE.lg },
  cardOutlined: {},
  cardTinted: { backgroundColor: PALETTE.blueTint, borderColor: PALETTE.blueSoft },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: SPACE.sm, marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md, minHeight: 24 },
  sectionText: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  sectionTitle: { ...TYPE.heading, fontWeight: '800' },
  sectionSub: { ...TYPE.caption, marginTop: 2 },
  sectionActionBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: SPACE.md, minHeight: 32, maxWidth: '100%' },
  sectionAction: { fontWeight: '600', fontSize: 13, flexShrink: 1 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', paddingHorizontal: SPACE.lg },
  statCell: { marginBottom: SPACE.md },
  stat: { flex: 1, minHeight: 124, padding: SPACE.lg },
  statHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACE.md },
  statIcon: { width: SIZE.iconChip, height: SIZE.iconChip, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { ...TYPE.number },
  statLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft, marginTop: 2 },
  statHint: { fontSize: 11, lineHeight: 15, color: PALETTE.textMuted, marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md, minHeight: SIZE.row, gap: SPACE.sm },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  rowDividerLine: { position: 'absolute', right: 0, bottom: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: PALETTE.divider },
  rowIcon: { width: SIZE.iconChip, height: SIZE.iconChip, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.xs },
  rowLead: { marginRight: SPACE.xs },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: PALETTE.text },
  rowSub: { fontSize: 13, lineHeight: 18, color: PALETTE.textMuted, marginTop: 1 },
  rowMeta: { fontSize: 12, lineHeight: 16, color: PALETTE.textMuted, maxWidth: '35%' },

  info: { paddingVertical: SPACE.md },
  infoInline: { paddingVertical: SPACE.md, flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: PALETTE.textMuted, letterSpacing: 0.3, flexShrink: 1 },
  infoLabelInline: { flexShrink: 0, maxWidth: '42%', minHeight: 20 },
  infoLabelTextInline: { fontSize: 13, lineHeight: 20, letterSpacing: 0 },
  infoValue: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: PALETTE.text, marginTop: 3 },
  infoValueInline: { flex: 1, minWidth: 0, textAlign: 'right', fontSize: 14, lineHeight: 20, marginTop: 0 },

  kvGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -SPACE.sm, rowGap: SPACE.md },
  kvCell: { paddingHorizontal: SPACE.sm },
  kvLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  kvLabel: { ...TYPE.caption, flexShrink: 1 },
  kvValue: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: PALETTE.text },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, alignSelf: 'flex-start', maxWidth: '100%' },
  badgeSm: { paddingHorizontal: 8, paddingVertical: 2 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.2, textTransform: 'capitalize', flexShrink: 1 },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.card },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  chipCount: { fontSize: 12, fontWeight: '700' },
  chipRow: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs, gap: SPACE.sm },

  tabs: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs, gap: SPACE.sm },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, minHeight: 40, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.card, justifyContent: 'center' },
  tabText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft },
  tabCount: { minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: PALETTE.field, alignItems: 'center', justifyContent: 'center' },
  tabCountText: { fontSize: 11, fontWeight: '700', color: PALETTE.textMuted },

  segWrap: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs },
  segTrack: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: RADIUS.md + 2, backgroundColor: PALETTE.field },
  seg: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: RADIUS.md - 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  segOn: { backgroundColor: PALETTE.card, ...SHADOW.xs, shadowOpacity: 0.1 },
  segText: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: PALETTE.textMuted, textAlign: 'center' },
  segCount: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: PALETTE.textFaint, marginTop: 1 },

  btn: { borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  btnShadow: { borderRadius: RADIUS.pill, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 3 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  btnText: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: 0.1, flexShrink: 1 },

  bar: { backgroundColor: PALETTE.card, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PALETTE.borderStrong },
  barNote: { ...TYPE.caption, textAlign: 'center', marginBottom: SPACE.sm },
  barRow: { flexDirection: 'row', gap: SPACE.md },

  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.control, borderRadius: RADIUS.md, borderWidth: 1.5, backgroundColor: PALETTE.fieldBg, paddingHorizontal: 14 },
  fieldFocus: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 0 },
  fieldInput: { flex: 1, minWidth: 0, fontSize: 15, color: PALETTE.text, paddingVertical: 10 },
  fieldMsgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  fieldError: { flex: 1, color: PALETTE.redDark, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  fieldHint: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 16, marginTop: 6 },

  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.huge, paddingHorizontal: SPACE.xxl },
  stateHalo: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg },
  stateIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 23, textAlign: 'center' },
  stateText: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: 6, maxWidth: 320 },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: SPACE.lg, marginTop: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md, borderWidth: 1 },
  noticeTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 2 },
  noticeText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  noticeAction: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});

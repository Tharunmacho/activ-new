import React from 'react';
import {
  FlatList,
  FlatListProps,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PALETTE, SPACE, Tone, toneOf } from '../tokens';
import { BrandBackdrop } from './BrandBackdrop';
import { BRAND, PREMIUM_TYPE, premiumTone } from './theme';
import { FadeInUp, PressableScale } from './motion';
import { FloatingIllustration } from './illustrations';
import { GlassIconButton, PremiumHeading } from './controls';

/**
 * ============================================================================
 * PREMIUM PAGE — the inner-screen shells
 * ============================================================================
 *
 * PremiumScreen is the full-height brand header of sign-in and registration.
 * Inner screens (events, messages, certificates, payment …) want the same
 * look in a shorter header, plus the things those screens need that a form
 * does not: pull-to-refresh, and a FlatList body.
 *
 *   <PremiumPage header={<PremiumPageHeader title onBack art={<EventTicket3D/>}/>}
 *                refreshing onRefresh footer={<BottomActionBar>…</BottomActionBar>}>
 *     <FadeInUp style={{ marginTop: -PREMIUM_OVERLAP }}>…first block…</FadeInUp>
 *   </PremiumPage>
 *
 *   <PremiumListPage header={…} listHeader={<PremiumTabs …/>} data renderItem …/>
 *
 *   <PremiumTopBar title subtitle onBack leading={<GradientAvatar/>} />   ← fixed bar
 *                                  (chat threads, a checkout web view)
 *
 * All three paint the gradient under the status bar and keep a status-bar
 * scrim, so scrolled content never slides under the clock (Rule 4 — never
 * wrap them in a SafeAreaView). Keyboard: Android resizes natively
 * (adjustResize); iOS lifts through a KeyboardAvoidingView.
 */

export const PAGE_WAVE = 52;

/* ================================================================ header */

/**
 * The inner-screen header content: glass back button, right-side glass
 * actions, a heading beside a floating piece of art, and optional children
 * (live stats, a search bar, tabs) under it.
 */
export function PremiumPageHeader({
  title, eyebrow, subtitle, onBack, backIcon, right, art, artSize = 88, children, artLabel, onArtPress,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Defaults to the platform back arrow; pass 'close' for a modal-like flow. */
  backIcon?: string;
  right?: React.ReactNode;
  /** An original illustration (e.g. <EventTicket3D size={88}/>). */
  art?: React.ReactNode;
  artSize?: number;
  artLabel?: string;
  onArtPress?: () => void;
  children?: React.ReactNode;
}) {
  const hasTop = !!onBack || !!right;
  return (
    <View>
      {hasTop ? (
        <View style={s.topRow}>
          {onBack ? (
            <GlassIconButton
              icon={backIcon || (Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back')}
              onPress={onBack}
              accessibilityLabel={backIcon === 'close' ? 'Close' : 'Go back'}
            />
          ) : <View />}
          {right ? <View style={s.topRight}>{right}</View> : null}
        </View>
      ) : null}
      <View style={[s.heroRow, !hasTop && { marginTop: 0 }]}>
        <FadeInUp delay={40} style={s.heroText}>
          <PremiumHeading size="md" eyebrow={eyebrow} title={title} subtitle={subtitle} />
        </FadeInUp>
        {art ? (
          <FadeInUp delay={120} scaleFrom={0.85} distance={10}>
            {onArtPress ? <PressableScale onPress={onArtPress} accessibilityRole="button" accessibilityLabel={artLabel || 'Open image'}>
              <FloatingIllustration size={artSize}>{art}</FloatingIllustration>
            </PressableScale> : <FloatingIllustration size={artSize} accessibilityLabel={artLabel}>{art}</FloatingIllustration>}
          </FadeInUp>
        ) : null}
      </View>
      {children ? <FadeInUp delay={160} distance={10} style={s.headerChildren}>{children}</FadeInUp> : null}
    </View>
  );
}

/** A glass icon button with a count bubble — the bell, unread messages. */
export function GlassCountButton({ icon, count = 0, onPress, accessibilityLabel }: {
  icon: string; count?: number; onPress: () => void; accessibilityLabel: string;
}) {
  const n = Math.max(0, Number(count || 0));
  return (
    <View>
      <GlassIconButton icon={icon} onPress={onPress} accessibilityLabel={n ? `${accessibilityLabel}, ${n} new` : accessibilityLabel} />
      {n > 0 ? (
        <View pointerEvents="none" style={s.countBubble}>
          <Text style={s.countText} maxFontSizeMultiplier={1.1}>{n > 99 ? '99+' : String(n)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ================================================================ chrome */

function Chrome({ tone, children, safeBottom = false }: { tone: Tone; children: React.ReactNode; safeBottom?: boolean }) {
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const top = Number(insets?.top || 0);
  const canvas = toneOf(tone).canvas;
  return (
    <View style={[s.flex, { backgroundColor: canvas, paddingBottom: safeBottom ? Number(insets?.bottom || 0) : 0 }]}>
      <StatusBar barStyle="light-content" />
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={s.flex} behavior="padding">{children}</KeyboardAvoidingView>
      ) : children}
      {top > 0 ? <View pointerEvents="none" style={[s.scrim, { height: top, backgroundColor: p.top }]} /> : null}
    </View>
  );
}

function HeaderBand({ tone, header, waveHeight }: { tone: Tone; header: React.ReactNode; waveHeight: number }) {
  const insets = useSafeAreaInsets();
  const top = Number(insets?.top || 0);
  return (
    <BrandBackdrop
      tone={tone}
      waveColor={toneOf(tone).canvas}
      waveHeight={waveHeight}
      contentStyle={{ paddingTop: top + SPACE.sm, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm }}
    >
      {header}
    </BrandBackdrop>
  );
}

/* ================================================================ page */

/** A scrolling inner page under a short brand header. */
export function PremiumPage({
  tone = 'member', header, children, footer, refreshing, onRefresh, waveHeight = PAGE_WAVE, contentStyle, scrollRef, safeBottom = false,
}: {
  tone?: Tone;
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  waveHeight?: number;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.Ref<ScrollView>;
  /** Standalone screens can keep their viewport above Android's system buttons. */
  safeBottom?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const canvas = toneOf(tone).canvas;
  const top = Number(insets?.top || 0);
  const bottom = Number(insets?.bottom || 0);
  return (
    <Chrome tone={tone} safeBottom={safeBottom}>
      <ScrollView
        ref={scrollRef}
        style={s.flex}
        contentContainerStyle={[{ flexGrow: 1, backgroundColor: canvas, paddingBottom: footer ? SPACE.xl : Math.max(bottom, SPACE.lg) + SPACE.xxl }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            colors={[p.accent]}
            tintColor={PALETTE.white}
            progressViewOffset={top + SPACE.sm}
          />
        ) : undefined}
      >
        <HeaderBand tone={tone} header={header} waveHeight={waveHeight} />
        {children}
      </ScrollView>
      {footer || null}
    </Chrome>
  );
}

/* ================================================================ list page */

type ListPageProps<T> = Omit<FlatListProps<T>, 'ListHeaderComponent' | 'renderItem' | 'contentContainerStyle' | 'refreshControl'> & {
  tone?: Tone;
  header: React.ReactNode;
  /** Rendered under the waves, above the rows (tabs, filters, a summary card). */
  listHeader?: React.ReactNode;
  renderItem: (info: ListRenderItemInfo<T>) => React.ReactElement | null;
  /** Wrap each row on the screen gutter with a gap below (default true). */
  gutter?: boolean;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  waveHeight?: number;
  listRef?: React.Ref<FlatList<T>>;
};

/**
 * A FlatList inner page: the brand header scrolls away as the list's header,
 * rows sit on the gutter. Carries the Rule 3 list defaults.
 */
export function PremiumListPage<T>({
  tone = 'member', header, listHeader, renderItem, gutter = true, footer, refreshing, onRefresh,
  waveHeight = PAGE_WAVE, listRef, ...list
}: ListPageProps<T>) {
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const canvas = toneOf(tone).canvas;
  const top = Number(insets?.top || 0);
  const bottom = Number(insets?.bottom || 0);
  const renderRow = (info: ListRenderItemInfo<T>) => {
    const node = renderItem(info);
    if (!node) return null;
    return gutter ? <View style={s.row}>{node}</View> : node;
  };
  return (
    <Chrome tone={tone}>
      <FlatList<T>
        ref={listRef}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...list}
        style={s.flex}
        renderItem={renderRow}
        ListHeaderComponent={(
          <View>
            <HeaderBand tone={tone} header={header} waveHeight={waveHeight} />
            {listHeader || null}
          </View>
        )}
        contentContainerStyle={{ flexGrow: 1, backgroundColor: canvas, paddingBottom: footer ? SPACE.xl : Math.max(bottom, SPACE.lg) + SPACE.xxl }}
        refreshControl={onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            colors={[p.accent]}
            tintColor={PALETTE.white}
            progressViewOffset={top + SPACE.sm}
          />
        ) : undefined}
      />
      {footer || null}
    </Chrome>
  );
}

/* ================================================================ fixed bar */

/**
 * A fixed gradient bar with rounded lower corners — for screens whose body
 * must own the whole height (a chat thread with its composer, a payment web
 * view). Paints under the status bar itself.
 */
export function PremiumTopBar({
  title, subtitle, onBack, backIcon, leading, right, tone = 'member', children, onTitlePress,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: string;
  leading?: React.ReactNode;
  right?: React.ReactNode;
  tone?: Tone;
  /** Extra content under the title row (e.g. a status strip). */
  children?: React.ReactNode;
  onTitlePress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const top = Number(insets?.top || 0);
  const titleBlock = (
    <View style={s.barTitleRow}>
      {leading || null}
      <View style={s.barTitleText}>
        <Text style={s.barTitle} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={1.25}>{String(title || '')}</Text>
        {subtitle ? <Text style={s.barSub} numberOfLines={1} maxFontSizeMultiplier={1.25}>{subtitle}</Text> : null}
      </View>
    </View>
  );
  return (
    <View style={[s.barWrap, { shadowColor: p.shadow }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={p.header}
        locations={p.header.length === 4 ? [0, 0.38, 0.72, 1] : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.bar, { paddingTop: top + SPACE.sm }]}
      >
        <View pointerEvents="none" style={s.barOrb} />
        <View style={s.barRow}>
          {onBack ? (
            <GlassIconButton
              icon={backIcon || (Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back')}
              onPress={onBack}
              accessibilityLabel={backIcon === 'close' ? 'Close' : 'Go back'}
            />
          ) : null}
          {onTitlePress ? (
            <PressableScale onPress={onTitlePress} style={s.flexMin} accessibilityRole="button" accessibilityLabel={`${title}. Open details`}>
              {titleBlock}
            </PressableScale>
          ) : <View style={s.flexMin}>{titleBlock}</View>}
          {right ? <View style={s.topRight}>{right}</View> : null}
        </View>
        {children || null}
      </LinearGradient>
    </View>
  );
}

/** A small uppercase line + white value, in glass — a live figure on the header. */
export function HeaderStat({ value, label, icon, style }: { value: string | number; label: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.glassStat, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={s.glassStatTop}>
        {icon ? <Icon name={icon} size={14} color={BRAND.onBrandSoft} /> : null}
        <Text style={s.glassStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>{String(value)}</Text>
      </View>
      <Text style={s.glassStatLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
    </View>
  );
}

/** A row of HeaderStat, equal widths. */
export function HeaderStatRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.glassRow, style]}>{children}</View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  flexMin: { flex: 1, minWidth: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  row: { paddingHorizontal: SPACE.lg, marginBottom: SPACE.md },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.md },
  heroText: { flex: 1, minWidth: 0 },
  headerChildren: { marginTop: SPACE.lg },

  countBubble: {
    position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: PALETTE.red, borderWidth: 2, borderColor: BRAND.navy, alignItems: 'center', justifyContent: 'center',
  },
  countText: { color: PALETTE.white, fontSize: 10, lineHeight: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },

  barWrap: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: BRAND.navy,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8, zIndex: 2,
  },
  bar: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md, overflow: 'hidden' },
  barOrb: { position: 'absolute', right: -60, top: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  barTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  barTitleText: { flex: 1, minWidth: 0 },
  barTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: PALETTE.white, letterSpacing: -0.2 },
  barSub: { fontSize: 12, lineHeight: 16, color: BRAND.onBrandSoft, marginTop: 1 },

  glassRow: { flexDirection: 'row', gap: SPACE.sm },
  glassStat: {
    flex: 1, minWidth: 0, paddingVertical: SPACE.sm + 2, paddingHorizontal: SPACE.md, borderRadius: 16,
    backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  glassStatTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  glassStatValue: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: PALETTE.white, fontVariant: ['tabular-nums'], flexShrink: 1 },
  glassStatLabel: { ...PREMIUM_TYPE.eyebrow, fontSize: 10, letterSpacing: 0.8, color: BRAND.onBrandFaint, marginTop: 2 },
});

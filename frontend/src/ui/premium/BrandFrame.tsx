import { AppTheme, useAppTheme, useThemeStyles } from '../AppTheme';
import { AppearanceToggle } from '../AppearanceToggle';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACE, Tone } from '../tokens';
import { BrandBackdrop } from './BrandBackdrop';
import { GlassIconButton, PremiumHeading } from './controls';
import { FloatingIllustration } from './illustrations';
import { FadeInUp } from './motion';


/**
 * ============================================================================
 * BRAND FRAME — brand-header shells for app screens (business area first)
 * ============================================================================
 *
 *   BrandScrollPage ... gradient header + scrolling body; pull-to-refresh;
 *                       a scroll ref (a stepped form scrolls back to the top)
 *   BrandFrame ........ status bar, canvas, scrim, keyboard, footer
 *                       around ANY body — put a FlatList inside (Rule 3)
 *   BrandHeaderBlock .. the gradient block with the status-bar inset applied —
 *                       a FlatList's ListHeaderComponent
 *   BrandTopBar ....... glass back · compact title · glass actions
 *   BrandHero ......... heading left, original art floating right
 *
 * Keyboard: iOS lifts through a KeyboardAvoidingView. On Android the window
 * is expected to resize (adjustResize), but an edge-to-edge window (enforced
 * from API 35 with targetSdk 36) may not — so the frame measures how far the
 * keyboard really overlaps it and pads by exactly that. Where the window did
 * resize, the overlap is 0 and nothing changes.
 */

/** How far the keyboard covers the frame on Android (0 when the window resized). */
function useAndroidKeyboardOverlap() {
  const ref = useRef<View>(null);
  const [kbTop, setKbTop] = useState<number | null>(null);
  const [bottom, setBottom] = useState(0);

  const measure = useCallback(() => {
    try {
      ref.current?.measureInWindow?.((_x, y, _w, h) => {
        const b = Number(y || 0) + Number(h || 0);
        if (Number.isFinite(b) && b > 0) setBottom(b);
      });
    } catch {
      /* measuring is best-effort */
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const top = Number(e?.endCoordinates?.screenY || 0);
      setKbTop(top > 0 ? top : null);
      measure();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbTop(null));
    return () => { show.remove(); hide.remove(); };
  }, [measure]);

  const overlap = kbTop === null ? 0 : Math.max(0, Math.round(bottom - kbTop));
  return { ref, onLayout: measure, overlap };
}

export function BrandFrame({ tone = 'member', children, footer, style, safeBottom = false }: {
  tone?: Tone;
  children: React.ReactNode;
  /** Pinned below the body (tab bar / BottomActionBar). */
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  safeBottom?: boolean;
}) {
  const { toneOf, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const canvas = toneOf(tone).canvas;
  const top = Number(insets?.top || 0);
  const kb = useAndroidKeyboardOverlap();

  const body = (
    <>
      <View style={s.flex}>{children}</View>
      {footer || null}
    </>
  );

  return (
    <View ref={kb.ref} onLayout={kb.onLayout} style={[s.flex, { backgroundColor: canvas, paddingBottom: safeBottom ? Number(insets?.bottom || 0) : 0 }, style]}>
      <StatusBar barStyle="light-content" />
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={s.flex} behavior="padding">{body}</KeyboardAvoidingView>
      ) : (
        <View style={[s.flex, { paddingBottom: kb.overlap }]}>{body}</View>
      )}
      {top > 0 ? <View pointerEvents="none" style={[s.scrim, { height: top, backgroundColor: p.top }]} /> : null}
    </View>
  );
}

export function BrandHeaderBlock({ tone = 'member', children, waveHeight = 64, minHeight, contentStyle }: {
  tone?: Tone;
  children?: React.ReactNode;
  waveHeight?: number;
  minHeight?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { toneOf } = useAppTheme();
  const insets = useSafeAreaInsets();
  const top = Number(insets?.top || 0);
  return (
    <BrandBackdrop
      tone={tone}
      waveColor={toneOf(tone).canvas}
      waveHeight={waveHeight}
      minHeight={typeof minHeight === 'number' ? minHeight + top : undefined}
      contentStyle={[{ paddingTop: top + SPACE.md, paddingHorizontal: SPACE.lg }, contentStyle]}
    >
      {children}
    </BrandBackdrop>
  );
}

export function BrandScrollPage({
  tone = 'member', header, children, footer, scrollRef, refreshing, onRefresh, waveHeight = 64,
  minHeaderHeight, contentStyle, headerContentStyle,
}: {
  tone?: Tone;
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  scrollRef?: React.RefObject<ScrollView | null>;
  refreshing?: boolean;
  onRefresh?: () => void;
  waveHeight?: number;
  minHeaderHeight?: number;
  contentStyle?: StyleProp<ViewStyle>;
  headerContentStyle?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE, toneOf, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const canvas = toneOf(tone).canvas;
  const bottom = Number(insets?.bottom || 0);
  return (
    <BrandFrame tone={tone} footer={footer}>
      <ScrollView
        ref={scrollRef as any}
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
            progressBackgroundColor={PALETTE.white}
          />
        ) : undefined}
      >
        <BrandHeaderBlock tone={tone} waveHeight={waveHeight} minHeight={minHeaderHeight} contentStyle={headerContentStyle}>
          {header}
        </BrandHeaderBlock>
        {children}
      </ScrollView>
    </BrandFrame>
  );
}

export function BrandTopBar({ onBack, title, right }: {
  onBack?: () => void;
  title?: string;
  right?: React.ReactNode;
}) {
  const s = useThemeStyles(makeStyles);
  return (
    <View style={s.topBar}>
      {onBack ? (
        <GlassIconButton
          icon={Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back'}
          onPress={onBack}
          accessibilityLabel="Go back"
        />
      ) : <View style={s.topSpacer} />}
      <Text style={s.topTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>{title || ''}</Text>
      <View style={s.topRight}><AppearanceToggle glass />{right || null}</View>
    </View>
  );
}

export function BrandHero({ eyebrow, title, subtitle, art, artSize = 96, children, style }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** An illustration element, e.g. <Storefront3D size={96} />. */
  art?: React.ReactNode;
  artSize?: number;
  /** Under the heading row (chips, figures, a stepper). */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.hero, style]}>
      <View style={s.heroRow}>
        <FadeInUp delay={60} style={s.heroText}>
          <PremiumHeading size="md" eyebrow={eyebrow} title={title} subtitle={subtitle} />
        </FadeInUp>
        {art ? (
          <FadeInUp delay={140} scaleFrom={0.85} distance={10}>
            <FloatingIllustration size={artSize}>{art}</FloatingIllustration>
          </FadeInUp>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const makeStyles = ({ palette: PALETTE }: AppTheme) => StyleSheet.create({
  flex: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 44 },
  topSpacer: { width: 44, height: 44 },
  topTitle: { flex: 1, minWidth: 0, textAlign: 'center', color: PALETTE.white, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  hero: { marginTop: SPACE.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  heroText: { flex: 1, minWidth: 0 },
});

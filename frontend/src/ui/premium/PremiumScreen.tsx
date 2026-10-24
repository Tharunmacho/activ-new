import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACE, Tone, toneOf } from '../tokens';
import { BrandBackdrop } from './BrandBackdrop';
import { premiumTone } from './theme';

/**
 * ============================================================================
 * PREMIUM SCREEN — the brand-header page shell
 * ============================================================================
 *
 *   <PremiumScreen
 *     tone="member"
 *     header={<>logo · heading · illustration · stepper</>}
 *     footer={<BottomActionBar><PremiumFooter …/></BottomActionBar>}   (optional)
 *   >
 *     <FadeInUp style={{ marginTop: -OVERLAP }}><PremiumSheet>…form…</PremiumSheet></FadeInUp>
 *   </PremiumScreen>
 *
 * - The gradient runs under the status bar (it applies the top inset itself,
 *   so never wrap it in another SafeAreaView — Rule 4). Light status icons.
 * - Header and body scroll together, so on a short phone or with the keyboard
 *   up nothing is pinned over the form. Android resizes natively
 *   (adjustResize); iOS lifts through a KeyboardAvoidingView.
 * - The first body block should overlap the waves: `marginTop: -PREMIUM_OVERLAP`.
 * - Behind the scroll view the top half is painted in the header colour, so an
 *   iOS over-scroll at the top shows navy, not a white gap.
 */

export const PREMIUM_OVERLAP = 24;

export function PremiumScreen({
  tone = 'member', header, children, footer, minHeaderHeight, waveHeight = 76, headerContentStyle, contentStyle,
}: {
  tone?: Tone;
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Minimum height of the gradient (without the status bar inset). */
  minHeaderHeight?: number;
  waveHeight?: number;
  headerContentStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const canvas = toneOf(tone).canvas;
  const top = Number(insets?.top || 0);
  const bottom = Number(insets?.bottom || 0);

  const body = (
    <>
      <ScrollView
        style={s.flex}
        contentContainerStyle={[{ flexGrow: 1, backgroundColor: canvas, paddingBottom: footer ? SPACE.xl : Math.max(bottom, SPACE.lg) + SPACE.xxl }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandBackdrop
          tone={tone}
          waveColor={canvas}
          waveHeight={waveHeight}
          minHeight={typeof minHeaderHeight === 'number' ? minHeaderHeight + top : undefined}
          contentStyle={[{ paddingTop: top + SPACE.md, paddingHorizontal: SPACE.lg }, headerContentStyle]}
        >
          {header}
        </BrandBackdrop>
        {/* Direct children of the content container (no wrapper), so a block that
            overlaps the waves upward stays inside a touchable parent on Android. */}
        {children}
      </ScrollView>
      {footer || null}
    </>
  );

  return (
    <View style={[s.flex, { backgroundColor: canvas }]}>
      <StatusBar barStyle="light-content" />
      <View pointerEvents="none" style={[s.overscroll, { backgroundColor: p.top }]} />
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={s.flex} behavior="padding">{body}</KeyboardAvoidingView>
      ) : body}
      {/* Status-bar scrim: the header scrolls away, and without this the form
          slid under the clock and battery icons. */}
      {top > 0 ? <View pointerEvents="none" style={[s.scrim, { height: top, backgroundColor: p.top }]} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  overscroll: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});

import React, { forwardRef } from 'react';
import {
  KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StatusBar, StyleProp, StyleSheet, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACE, Tone, toneOf } from '../tokens';
import { BrandBackdrop } from './BrandBackdrop';
import { premiumTone } from './theme';

/**
 * ============================================================================
 * PREMIUM SCROLL SCREEN — PremiumScreen + pull-to-refresh + a scroll ref
 * ============================================================================
 *
 * The same brand-header shell as `PremiumScreen` (gradient under the status
 * bar, waves, status-bar scrim, iOS keyboard lift, body overlapping the waves
 * via `marginTop: -PREMIUM_OVERLAP`), for screens that also need
 *
 *   refreshing / onRefresh   pull-to-refresh (dashboards, status screens)
 *   ref                      the ScrollView, for "scroll to this section"
 *
 * A separate component rather than new props on PremiumScreen, so the screens
 * already on PremiumScreen are untouched.
 *
 * The refresh spinner is white-on-navy: it appears over the header.
 */

export const PremiumScrollScreen = forwardRef<ScrollView, {
  tone?: Tone;
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  waveHeight?: number;
  minHeaderHeight?: number;
  headerContentStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>(function PremiumScrollScreen({
  tone = 'member', header, children, footer, refreshing, onRefresh, waveHeight = 64, minHeaderHeight,
  headerContentStyle, contentStyle,
}, ref) {
  const insets = useSafeAreaInsets();
  const p = premiumTone(tone);
  const canvas = toneOf(tone).canvas;
  const top = Number(insets?.top || 0);
  const bottom = Number(insets?.bottom || 0);

  const body = (
    <>
      <ScrollView
        ref={ref}
        style={s.flex}
        contentContainerStyle={[{ flexGrow: 1, backgroundColor: canvas, paddingBottom: footer ? SPACE.xl : Math.max(bottom, SPACE.lg) + SPACE.xxl }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={[p.accent]}
            progressBackgroundColor="#FFFFFF"
            progressViewOffset={top}
          />
        ) : undefined}
      >
        <BrandBackdrop
          tone={tone}
          waveColor={canvas}
          waveHeight={waveHeight}
          minHeight={typeof minHeaderHeight === 'number' ? minHeaderHeight + top : undefined}
          contentStyle={[{ paddingTop: top + SPACE.sm, paddingHorizontal: SPACE.lg }, headerContentStyle]}
        >
          {header}
        </BrandBackdrop>
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
      {top > 0 ? <View pointerEvents="none" style={[s.scrim, { height: top, backgroundColor: p.top }]} /> : null}
    </View>
  );
});

const s = StyleSheet.create({
  flex: { flex: 1 },
  overscroll: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});

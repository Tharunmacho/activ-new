import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, SPACE, SIZE, PressableScale, premiumTone } from '../../ui';

/**
 * The business area's bottom navigation — a pinned bar (pass as the page's
 * `footer`), not a floating card inside the scroll. The business screens are
 * Stack screens, so this is a plain row of buttons that navigate; the caller
 * decides what each tap does.
 *
 * Premium look: a white deck with rounded shoulders and a violet shadow; the
 * active tab sits in the business violet gradient pill (#4C1D95 → #7C3AED).
 */
export type BusinessTabKey = 'business' | 'products' | 'discover' | 'analytics' | 'settings';

const TABS: { key: BusinessTabKey; label: string; icon: string }[] = [
  { key: 'business', label: 'Business', icon: 'storefront' },
  { key: 'products', label: 'Products', icon: 'grid-view' },
  { key: 'discover', label: 'ACTIV Network', icon: 'travel-explore' },
  { key: 'analytics', label: 'Analytics', icon: 'insights' },
  { key: 'settings', label: 'Settings', icon: 'tune' },
];

export function BusinessTabBar({ active, onPress }: {
  active: BusinessTabKey;
  /** Called for every tab except the active one. */
  onPress: (key: BusinessTabKey) => void;
}) {
  const insets = useSafeAreaInsets();
  const p = premiumTone('business');
  const bottom = Math.max(Number(insets?.bottom || 0), SPACE.sm);
  return (
    <View style={[styles.bar, { paddingBottom: bottom, shadowColor: p.shadow }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <PressableScale
            key={t.key}
            style={styles.item}
            contentStyle={styles.inner}
            scaleTo={0.92}
            onPress={() => { if (!on) { try { onPress?.(t.key); } catch (err) { console.warn('Tab navigation safely caught:', err); } } }}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
          >
            {on ? (
              <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.pill, styles.pillOn, { shadowColor: p.accent }]}>
                <Icon name={t.icon} size={SIZE.iconLg - 2} color={PALETTE.white} />
              </LinearGradient>
            ) : (
              <View style={styles.pill}>
                <Icon name={t.icon} size={SIZE.iconLg - 2} color={PALETTE.textMuted} />
              </View>
            )}
            <Text style={[styles.label, { textAlign: 'center', minHeight: 28 }, on && { color: p.accentDark, fontWeight: '800' }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{t.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: PALETTE.card,
    paddingTop: SPACE.sm + 2,
    paddingHorizontal: SPACE.xs,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  item: { flex: 1, minWidth: 0, minHeight: SIZE.touch + SPACE.sm },
  inner: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  pill: { width: 52, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pillOn: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: PALETTE.textMuted },
});

export default BusinessTabBar;

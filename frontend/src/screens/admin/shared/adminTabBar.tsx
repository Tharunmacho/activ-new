import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BRAND, PALETTE, SPACE, premiumTone, prefersReducedMotion } from '../../../ui';

/**
 * ============================================================================
 * ADMIN TAB BAR — one premium look for the Block, District, State and Super
 * Admin bottom tabs, so the four consoles can never drift apart visually.
 * ============================================================================
 *
 * White bar with a soft indigo lift, indigo labels, and the active icon on the
 * admin gradient pill (the sign-in button's gradient), springing in when a tab
 * is chosen. The height adds the device's bottom inset so labels never sit
 * under Android's gesture pill or iOS's home indicator.
 */

/** The bar's own height, before the device's gesture inset is added. */
export const ADMIN_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 56 : 64;

const ADMIN = premiumTone('admin');

export const adminTabScreenOptions = (bottomInset: number, palette = PALETTE) => {
  const inset = Number(bottomInset || 0);
  return {
    headerShown: false,
    tabBarActiveTintColor: palette.indigoDark,
    tabBarInactiveTintColor: palette.textMuted,
    tabBarHideOnKeyboard: Platform.OS === 'android',
    tabBarStyle: {
      height: ADMIN_TAB_BAR_HEIGHT + inset,
      paddingBottom: inset + (inset > 0 ? SPACE.xxs : SPACE.sm),
      paddingTop: SPACE.sm - 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.border,
      backgroundColor: palette.card,
      shadowColor: BRAND.indigoDeep,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 12,
    },
    tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, marginTop: SPACE.xxs, marginBottom: 0 },
    tabBarItemStyle: { paddingVertical: 0 },
    tabBarAllowFontScaling: false,
  };
};

function TabGlyph({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const ADMIN = useLegacyAppearance(legacyAppearance_ADMIN);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  useEffect(() => {
    if (prefersReducedMotion()) { scale.setValue(focused ? 1 : 0.9); return; }
    Animated.spring(scale, { toValue: focused ? 1 : 0.9, useNativeDriver: true, speed: 18, bounciness: focused ? 10 : 0 }).start();
  }, [focused, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {focused ? (
        <View style={styles.glow}>
          <LinearGradient colors={ADMIN.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
            <Icon name={name} size={20} color={PALETTE.white} />
          </LinearGradient>
        </View>
      ) : (
        <View style={styles.pill}>
          <Icon name={name} size={22} color={color} />
        </View>
      )}
    </Animated.View>
  );
}

/** A tab icon with the active gradient pill. Build once per icon name at module level. */
export const makeAdminTabIcon = (name: string) => {
  const TabIcon = ({ color, focused }: { color: string; size?: number; focused?: boolean }) => (
    <TabGlyph name={name} color={color} focused={!!focused} />
  );
  return TabIcon;
};

const styles = StyleSheet.create({
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  glow: {
    borderRadius: 15,
    shadowColor: BRAND.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_ADMIN = ADMIN;
const legacyAppearance_PALETTE = PALETTE;

import { useLegacyAppearance } from '../../../../ui/legacyAppearance';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { PALETTE, SPACE, BRAND, useLoop, ConsoleSkeleton } from '../../../../ui';

/**
 * Skeleton placeholders for the Super Admin screens — the premium console's
 * shimmering cards (ConsoleSkeleton), behind the API these screens already
 * use. A gentle pulse on the native driver; off under reduce-motion.
 */

interface BarProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export const SkeletonBar: React.FC<BarProps> = ({ width = '100%', height = 12, radius = 6, style }) => {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const pulse = useLoop({ duration: 1400, pingPong: true });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: PALETTE.divider, opacity }, style]} />;
};

const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
  <View style={[styles.card, style]}>{children}</View>
);
};

export const SkeletonTierCard: React.FC = () => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
  <Card>
    <View style={styles.row}>
      <SkeletonBar width={44} height={44} radius={14} />
      <View style={styles.flex}><SkeletonBar width="55%" height={14} /></View>
    </View>
    <View style={[styles.row, styles.gapTop]}>
      <SkeletonBar width="22%" height={22} />
      <SkeletonBar width="22%" height={22} />
      <SkeletonBar width="22%" height={22} />
      <SkeletonBar width="22%" height={22} />
    </View>
  </Card>
);
};

export const SkeletonRegionCard: React.FC = () => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
  <Card>
    <View style={styles.row}>
      <SkeletonBar width={56} height={56} radius={28} />
      <View style={[styles.flex, { gap: SPACE.sm }]}>
        <SkeletonBar width="60%" height={14} />
        <SkeletonBar width="40%" height={11} />
      </View>
    </View>
    <SkeletonBar height={30} radius={12} style={styles.gapTop} />
  </Card>
);
};

export const SkeletonRow: React.FC<{ lines?: number }> = ({ lines = 2 }) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
  <Card>
    <View style={styles.row}>
      <SkeletonBar width={48} height={48} radius={24} />
      <View style={[styles.flex, { gap: SPACE.sm }]}>
        {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
          <SkeletonBar key={i} width={i === 0 ? '62%' : '40%'} height={i === 0 ? 14 : 11} />
        ))}
      </View>
    </View>
  </Card>
);
};

/** Repeat any skeleton `count` times with the list's normal spacing. */
export const SkeletonList: React.FC<{ count?: number; children?: React.ReactNode; variant?: 'row' | 'region' | 'tier' }> = ({
  count = 4,
  variant = 'row',
  children,
}) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  if (!children && variant === 'row') return <ConsoleSkeleton rows={count} style={styles.flush} />;
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index}>
          {children || (variant === 'region' ? <SkeletonRegionCard /> : <SkeletonTierCard />)}
        </View>
      ))}
    </View>
  );
};

/** Keeps a mounted-once fade for callers that want one. */
export const useSkeletonFade = () => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 240, useNativeDriver: true }).start(); }, [v]);
  return v;
};

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, justifyContent: 'space-between' },
  gapTop: { marginTop: SPACE.lg },
  list: { gap: SPACE.md },
  flush: { paddingHorizontal: 0 },
  card: {
    backgroundColor: PALETTE.white, borderRadius: 20, padding: SPACE.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2,
  },
});

export default SkeletonBar;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_styles = styles;

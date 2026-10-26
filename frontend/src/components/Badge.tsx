import { useLegacyAppearance } from '../ui/legacyAppearance';
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../theme/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';
type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'default',
  size = 'medium',
  style,
  textStyle,
}) => {
  const COLORS = useLegacyAppearance(legacyAppearance_COLORS);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'success':
        return {
          backgroundColor: COLORS.success + '20',
        };
      case 'warning':
        return {
          backgroundColor: COLORS.warning + '20',
        };
      case 'error':
        return {
          backgroundColor: COLORS.error + '20',
        };
      case 'info':
        return {
          backgroundColor: COLORS.info + '20',
        };
      case 'default':
      default:
        return {
          backgroundColor: COLORS.textSecondary + '20',
        };
    }
  };

  const getTextVariantStyles = (): TextStyle => {
    switch (variant) {
      case 'success':
        return { color: COLORS.success };
      case 'warning':
        return { color: COLORS.warning };
      case 'error':
        return { color: COLORS.error };
      case 'info':
        return { color: COLORS.info };
      case 'default':
      default:
        return { color: COLORS.textSecondary };
    }
  };

  const getSizeStyles = (): ViewStyle & TextStyle => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: SPACING.xs,
          paddingVertical: 2,
          fontSize: FONTS.sizes.xs,
        };
      case 'medium':
        return {
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.xs,
          fontSize: FONTS.sizes.sm,
        };
      case 'large':
        return {
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
          fontSize: FONTS.sizes.md,
        };
      default:
        return {
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.xs,
          fontSize: FONTS.sizes.sm,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        getVariantStyles(),
        {
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          getTextVariantStyles(),
          { fontSize: sizeStyles.fontSize },
          textStyle,
        ]}
      >
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: FONTS.weights.semiBold,
  },
});

export default Badge;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_COLORS = COLORS;
const legacyAppearance_styles = styles;

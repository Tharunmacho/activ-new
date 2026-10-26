import { useLegacyAppearance } from '../ui/legacyAppearance';
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../theme/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const COLORS = useLegacyAppearance(legacyAppearance_COLORS);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: COLORS.primary,
        };
      case 'secondary':
        return {
          backgroundColor: COLORS.secondary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: COLORS.primary,
        };
      case 'danger':
        return {
          backgroundColor: COLORS.error,
        };
      case 'success':
        return {
          backgroundColor: COLORS.success,
        };
      default:
        return {
          backgroundColor: COLORS.primary,
        };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.md,
        };
      case 'medium':
        return {
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.lg,
        };
      case 'large':
        return {
          paddingVertical: SPACING.lg,
          paddingHorizontal: SPACING.xl,
        };
      default:
        return {
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.lg,
        };
    }
  };

  const getTextVariantStyles = (): TextStyle => {
    if (variant === 'outline') {
      return {
        color: COLORS.primary,
      };
    }
    return {
      color: COLORS.white,
    };
  };

  const getTextSizeStyles = (): TextStyle => {
    switch (size) {
      case 'small':
        return {
          fontSize: FONTS.sizes.sm,
        };
      case 'medium':
        return {
          fontSize: FONTS.sizes.md,
        };
      case 'large':
        return {
          fontSize: FONTS.sizes.lg,
        };
      default:
        return {
          fontSize: FONTS.sizes.md,
        };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? COLORS.primary : COLORS.white}
        />
      ) : (
        <Text
          style={[
            styles.text,
            getTextVariantStyles(),
            getTextSizeStyles(),
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontWeight: FONTS.weights.semiBold,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_COLORS = COLORS;
const legacyAppearance_styles = styles;

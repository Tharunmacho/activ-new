import { useLegacyAppearance } from '../ui/legacyAppearance';
import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONTS } from '../theme/theme';

type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: AvatarSize;
  style?: ViewStyle;
  backgroundColor?: string;
  textColor?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  name = '',
  imageUrl,
  size = 'medium',
  style,
  backgroundColor = COLORS.primary,
  textColor = COLORS.white,
}) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const getInitials = (fullName?: string | null): string => {
    // `.filter(Boolean)` drops the empty strings a blank/whitespace name
    // would otherwise leave behind, so we always render a real glyph.
    const names = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (
      names[0].charAt(0).toUpperCase() +
      names[names.length - 1].charAt(0).toUpperCase()
    );
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          width: 32,
          height: 32,
          borderRadius: 16,
          fontSize: FONTS.sizes.sm,
        };
      case 'medium':
        return {
          width: 48,
          height: 48,
          borderRadius: 24,
          fontSize: FONTS.sizes.md,
        };
      case 'large':
        return {
          width: 64,
          height: 64,
          borderRadius: 32,
          fontSize: FONTS.sizes.lg,
        };
      case 'xlarge':
        return {
          width: 96,
          height: 96,
          borderRadius: 48,
          fontSize: FONTS.sizes.xl,
        };
      default:
        return {
          width: 48,
          height: 48,
          borderRadius: 24,
          fontSize: FONTS.sizes.md,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  if (imageUrl) {
    return (
      <View style={[styles.container, sizeStyles, style]}>
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, sizeStyles]}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        sizeStyles,
        { backgroundColor },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: sizeStyles.fontSize, color: textColor },
        ]}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontWeight: FONTS.weights.bold,
  },
});

export default Avatar;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;

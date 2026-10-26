import { useLegacyAppearance } from '../ui/legacyAppearance';
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING } from '../theme/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof SPACING;
  elevation?: number;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'md',
  elevation = 3,
}) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <View
      style={[
        styles.card,
        { padding: SPACING[padding] },
        { elevation },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

export default Card;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;

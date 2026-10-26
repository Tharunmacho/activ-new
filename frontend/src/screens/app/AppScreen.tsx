import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const AppScreen = () => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Main App Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default AppScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;

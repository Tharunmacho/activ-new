import { useLegacyAppearance } from '../ui/legacyAppearance';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

/** One quiet presentation while the required update and session checks finish. */
export default function StartupScreen() {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <View
      style={styles.screen}
      accessibilityLabel="Opening ACTIV"
      accessibilityState={{ busy: true }}
    >
      <StatusBar barStyle="dark-content" />
      <Image
        source={require('../../assets/branding/activ-launcher-foreground.png')}
        style={styles.mark}
        resizeMode="contain"
        accessible={false}
      />
      <ActivityIndicator
        color="#35206B"
        size="small"
        style={styles.progress}
        accessibilityLabel="Opening ACTIV"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: 144, height: 144 },
  progress: { position: 'absolute', top: '50%', marginTop: 104 },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  PALETTE, SPACE, TYPE,
  PremiumScreen, PREMIUM_OVERLAP, PremiumSheet, BrandLogo, FloatingIllustration, FadeInUp, WelcomeDoor3D,
  BRAND,
} from '../../ui';

/**
 * A welcome card — the brand mark and the association's name, in the premium
 * language: the brand header with an open door spilling warm light (original
 * art), and the association's full name on the sheet below.
 */
const WelcomeScreen = () => {
  return (
    <PremiumScreen
      minHeaderHeight={260}
      header={(
        <View style={styles.header}>
          <FadeInUp distance={10}><BrandLogo /></FadeInUp>
          <FadeInUp delay={120} scaleFrom={0.8} distance={12} style={styles.art}>
            <FloatingIllustration size={112}>
              <WelcomeDoor3D size={112} />
            </FloatingIllustration>
          </FadeInUp>
          <FadeInUp delay={200}>
            <Text style={styles.eyebrow} maxFontSizeMultiplier={1.2}>Welcome</Text>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.25}>Welcome to ACTIV</Text>
          </FadeInUp>
          <View style={{ height: SPACE.xl }} />
        </View>
      )}
    >
      <FadeInUp delay={280} style={styles.sheet}>
        <PremiumSheet>
          <Text style={styles.name}>Adidravidar Confederation of Trade &amp; Industrial Vision</Text>
          <Text style={styles.tag}>Building Future</Text>
        </PremiumSheet>
      </FadeInUp>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  header: { alignItems: 'center' },
  art: { marginTop: SPACE.xl },
  eyebrow: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: BRAND.onBrandFaint, textAlign: 'center', marginTop: SPACE.lg },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '700', color: PALETTE.white, textAlign: 'center', marginTop: SPACE.xs },
  sheet: { marginTop: -PREMIUM_OVERLAP },
  name: { ...TYPE.heading, textAlign: 'center' },
  tag: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.xs },
});

export default WelcomeScreen;

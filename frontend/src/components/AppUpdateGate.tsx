import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StartupScreen from './StartupScreen';
import { SPACE, GradientButton } from '../ui';
import { AppTheme, useAppTheme, useThemeStyles } from '../ui/AppTheme';
import { AppearanceToggle } from '../ui/AppearanceToggle';
import {
  checkAppUpdate,
  openAppUpdateStore,
  type AppUpdateDecision,
} from '../services/appUpdates';

/** Whole-app gate: no dismiss/back action can reveal an obsolete installed app. */
export default function AppUpdateGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { palette, isDark, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const brand = premiumTone('member');
  const [decision, setDecision] = useState<AppUpdateDecision | null>(null);
  const [checking, setChecking] = useState(true),
    [opening, setOpening] = useState(false),
    [error, setError] = useState('');
  const mounted = useRef(true);
  const check = useCallback(async () => {
    if (mounted.current) setChecking(true);
    const result = await checkAppUpdate();
    if (mounted.current) {
      setDecision(previous =>
        result.checkFailed &&
        previous?.required &&
        previous.versionCode === result.versionCode
          ? { ...previous, checkFailed: true }
          : result,
      );
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [check]);
  if (decision && !decision.required) return <>{children}</>;
  if (!decision) return <StartupScreen />;
  const update = async () => {
    setError('');
    setOpening(true);
    try {
      await openAppUpdateStore();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Google Play could not be opened.',
        );
    } finally {
      if (mounted.current) setOpening(false);
    }
  };
  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient colors={[palette.blueTint, palette.canvas, palette.canvas]} style={s.background}>
      <ScrollView contentContainerStyle={s.content} alwaysBounceVertical={false}>
        <View style={s.wrap}>
          <View style={s.topRow}>
            <Text style={s.brand}>ACTIV</Text>
            <AppearanceToggle />
          </View>
          <View style={s.card}>
          <LinearGradient colors={brand.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <View pointerEvents="none" style={s.glow} />
            <View style={s.glyph}>
              <Icon name="system-update" size={44} color="#FFFFFF" accessible={false} />
            </View>
            <Text style={s.eyebrow}>A BETTER ACTIV EXPERIENCE</Text>
            <Text style={s.title} accessibilityRole="header">Update required</Text>
            <Text style={s.heroCopy}>The latest ACTIV is ready for you.</Text>
          </LinearGradient>
          <View style={s.details}>
          <Text style={s.body}>Please update ACTIV to continue.</Text>
          <Text style={s.caption}>Get the latest improvements from Google Play, then return to the app.</Text>
          <View style={s.steps}>
            <View style={s.step}><View style={s.stepNumber}><Text style={s.stepNumberText}>1</Text></View><Text style={s.stepText}>Open ACTIV on Google Play</Text></View>
            <View style={s.step}><View style={s.stepNumber}><Text style={s.stepNumberText}>2</Text></View><Text style={s.stepText}>Tap Update, then open ACTIV</Text></View>
          </View>
          {decision.checkFailed && (
            <Text style={s.caption} accessibilityLiveRegion="polite">
              Google Play could not be checked right now. Your previously
              confirmed update is still required. Check your connection and try
              again.
            </Text>
          )}
          {!!error && (
            <Text style={s.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <GradientButton
            label="Update on Google Play"
            icon="system-update"
            onPress={() => {
              void update();
            }}
            loading={opening}
          />
          <GradientButton
            variant="outline"
            label="Check again"
            icon="refresh"
            onPress={() => {
              void check();
            }}
            loading={checking}
          />
          <Text style={s.footnote}>Already installed the update? Tap Check again.</Text>
          </View>
          </View>
        </View>
      </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
const makeStyles = ({ palette, type }: AppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  background: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: SPACE.lg, paddingVertical: SPACE.xl },
  wrap: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: SPACE.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  brand: { fontSize: 23, fontWeight: '900', letterSpacing: 1, color: palette.blueDark },
  card: { borderRadius: 28, overflow: 'hidden', backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  hero: { alignItems: 'center', padding: SPACE.xl, paddingVertical: 32, gap: 12, overflow: 'hidden' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -110, top: -70, backgroundColor: 'rgba(255,255,255,0.07)' },
  glyph: { height: 80, width: 80, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.14)', marginBottom: 4 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.4, fontWeight: '700', color: '#DBEAFE', textAlign: 'center' },
  title: { fontSize: 29, lineHeight: 37, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  heroCopy: { fontSize: 15, lineHeight: 22, color: '#DBEAFE', textAlign: 'center' },
  details: { padding: SPACE.lg, gap: SPACE.lg },
  body: { ...type.subheading, color: palette.text, textAlign: 'center' },
  caption: { ...type.small, color: palette.textMuted, textAlign: 'center' },
  steps: { padding: SPACE.lg, gap: SPACE.md, borderRadius: 18, backgroundColor: palette.field },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.blueSoft },
  stepNumberText: { fontSize: 12, fontWeight: '800', color: palette.blueDark },
  stepText: { ...type.small, color: palette.textSoft, flex: 1 },
  footnote: { ...type.small, color: palette.textMuted, fontSize: 11, textAlign: 'center' },
  error: { ...type.small, color: palette.dangerText, textAlign: 'center' },
});

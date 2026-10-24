import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StartupScreen from './StartupScreen';
import { PALETTE, SPACE, TYPE, PrimaryButton, SecondaryButton } from '../ui';
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
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.brand}>ACTIV</Text>
          <Text style={s.title} accessibilityRole="header">
            Update required
          </Text>
          <Text style={s.body}>Please update ACTIV to continue.</Text>
          <Text style={s.caption}>
            A newer version is available for this device on Google Play. Install
            it to continue using ACTIV.
          </Text>
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
          <PrimaryButton
            label="Update on Google Play"
            icon="system-update"
            onPress={() => {
              void update();
            }}
            loading={opening}
          />
          <SecondaryButton
            label="Check again"
            icon="refresh"
            onPress={() => {
              void check();
            }}
            loading={checking}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.canvas },
  content: { flexGrow: 1, justifyContent: 'center', padding: SPACE.xl },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: SPACE.lg },
  brand: {
    ...TYPE.title,
    color: PALETTE.blue,
    fontWeight: '800',
    textAlign: 'center',
  },
  title: { ...TYPE.title, color: PALETTE.text, textAlign: 'center' },
  body: { ...TYPE.body, color: PALETTE.text, textAlign: 'center' },
  caption: { ...TYPE.small, color: PALETTE.textMuted, textAlign: 'center' },
  error: { ...TYPE.small, color: PALETTE.redDark, textAlign: 'center' },
});

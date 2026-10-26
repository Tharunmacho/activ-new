import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { API_BASE_URL } from '../../config/api.config';
import { homeForRole, clearSession, sanitizeUser, isAdminRole, UNSUPPORTED_ACCOUNT_MESSAGE } from '../../services/session';
import { useAuthStore } from '../../stores/exampleStore';
import { PALETTE, SPACE, TYPE, GradientButton, SocialConnect3D, SocialMark } from '../../ui';
import { errorText } from '../../ui/data';
import { authStyles as a } from './authStyles';
import { PremiumAuthScreen, StatusPanel } from './authKit';
import { takePublicAction } from '../../services/publicNavigation';
import SocialEmailVerification from './SocialEmailVerification';

/**
 * ============================================================================
 * SOCIAL SIGN-IN LANDING (website: pages/auth/SocialSignIn.tsx)
 * ============================================================================
 *
 * Reached from the deep link activ://auth/social?… that the server's OAuth
 * callback sends the system browser to when the sign-in was started with
 * `/auth/oauth/:provider/start?client=app`.
 *
 *   code        -> POST /auth/oauth/exchange { code } -> the normal sign-in
 *                  response, stored exactly as the password sign-in stores it
 *   first link  -> email verification when the provider cannot prove email
 *                  ownership, then the same member session/dashboard
 *   anything else -> the website's sentence for that reason
 *
 * The code is single-use and lives 10 minutes, including email verification.
 *
 * Premium: the brand header with linked-accounts art; the provider's real
 * mark beside the verdict. Like the website's toast, a successful sign-in
 * greets the member by name for a moment before the home screen opens.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'SocialSignIn'>;

const REASONS: Record<string, string> = {
  configuration: '{provider} rejected the sign-in configuration. Contact ACTIV support to check the client credentials.',
  callback: 'The {provider} callback address does not match this environment. Contact ACTIV support.',
  permissions: '{provider} has not enabled the email and profile permissions needed for sign-in. Use your email and password or contact ACTIV support.',
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in took too long or was started in another window. Please try again.',
  failed: 'We could not complete the sign-in with that provider. Please try again.',
  no_email: 'That account did not share a verified email address with us, so we cannot match it to an ACTIV account.',
  email_permission: 'Facebook did not give ACTIV permission to read your email. Try again and allow email access. Use the same email as your ACTIV account.',
  facebook_no_email: 'Facebook allowed email access but did not return an email address. Confirm your ACTIV login email in Facebook, then try again. You can also sign in with your ACTIV email and password.',
  admin: 'Administrators sign in with their email and password on the admin login screen.',
  not_configured: 'That sign-in option is not available yet. Please use your email and password.',
  unavailable: 'That sign-in option is not available yet. Please use your email and password.',
};

const PROVIDER_NAME: Record<string, string> = { google: 'Google', facebook: 'Facebook', linkedin: 'LinkedIn' };

const SocialSignInScreen: React.FC<Props> = ({ navigation, route }) => {
  const a = useLegacyAppearance(sharedAppearance_a);
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const code = String(route?.params?.code || '');
  const reason = String(route?.params?.error || '');
  const provider = String(route?.params?.provider || '');
  const email = String(route?.params?.email || '');
  const name = String(route?.params?.name || '');

  const [error, setError] = useState('');
  const [welcome, setWelcome] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [verification, setVerification] = useState<{ email: string; attempt: number } | null>(null);
  const exchanged = useRef('');
  const handledRoute = useRef('');
  const mounted = useRef(true);
  const attemptId = useRef(0);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { login } = useAuthStore();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (navigationTimer.current) clearTimeout(navigationTimer.current); };
  }, []);

  const openDashboard = useCallback(async (payload: any, attempt = attemptId.current) => {
    if (!mounted.current || attempt !== attemptId.current) return;
    const token = String(payload?.token || '');
    const role = String(payload?.role || payload?.user?.role || 'member');
    if (!token) throw new Error(REASONS.failed);
    if (isAdminRole(role)) { await clearSession(); throw new Error(REASONS.admin); }
    await login(sanitizeUser(payload?.user || {}), token, role as any);
    if (!mounted.current || attempt !== attemptId.current) return;
    const home = await homeForRole(role, payload?.memberDetails);
    if (!mounted.current || attempt !== attemptId.current) return;
    if (!home) { await clearSession(); throw new Error(UNSUPPORTED_ACCOUNT_MESSAGE); }
    setVerification(null);
    setWelcome(String(payload?.user?.fullName || payload?.user?.name || '').trim() || 'back');
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = setTimeout(() => {
      if (!mounted.current || attempt !== attemptId.current) return;
      try {
        const resume = takePublicAction();
        navigation.reset(resume ? { index: 1, routes: [{ name: home }, resume] } : { index: 0, routes: [{ name: home }] });
      } catch (cause) { console.warn('Navigation safely caught:', cause); }
    }, 900);
  }, [login, navigation]);

  useEffect(() => {
    const routeKey = JSON.stringify([code, reason, provider]);
    if (handledRoute.current === routeKey) return;
    handledRoute.current = routeKey;
    const attempt = ++attemptId.current;
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    setVerification(null); setWelcome(''); setError('');
    if (reason === 'no_account') return;
    if (!code) {
      const message = provider === 'facebook' && reason === 'no_email'
        ? 'Facebook did not share your email. Try again and allow email access. If your Facebook account uses only a phone number, confirm your ACTIV email there or sign in with your ACTIV email and password.'
        : REASONS[reason] || REASONS.failed;
      setError(message.replace('{provider}', PROVIDER_NAME[provider] || 'Sign-in provider'));
      return;
    }
    if (exchanged.current === code) return;
    exchanged.current = code;

    (async () => {
      try {
        await clearSession();
        const res = await api.post('/auth/oauth/exchange', { code });
        const payload = res?.data?.data || res?.data || {};
        if (!mounted.current || attempt !== attemptId.current) return;
        if (payload.requiresEmailVerification === true) { setVerification({ email: String(payload.email || ''), attempt }); return; }
        await openDashboard(payload, attempt);
      } catch (err: any) {
        if (!mounted.current || attempt !== attemptId.current) return;
        setError(err?.response ? errorText(err, REASONS.failed) : String(err?.message || REASONS.failed));
      }
    })();
  }, [code, reason, provider, login, navigation, openDashboard]);

  const backToLogin = () => {
    attemptId.current += 1;
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };
  const facebookRecovery = provider === 'facebook' && ['no_email', 'email_permission', 'facebook_no_email', 'cancelled', 'expired'].includes(reason);
  const retryFacebook = async () => {
    setRetrying(true);
    try {
      await Linking.openURL(`${API_BASE_URL}/auth/oauth/facebook/start?client=app`);
    } catch {
      setError('Could not open Facebook. Please try again or sign in with your ACTIV email and password.');
    } finally { setRetrying(false); }
  };

  const providerName = PROVIDER_NAME[provider] || '';
  const shell = {
    art: <SocialConnect3D size={100} />,
    eyebrow: providerName ? `Sign in with ${providerName}` : 'Social sign-in',
  };
  const providerRow = providerName ? (
    <View style={s.provider}>
      <SocialMark provider={providerName} size={18} />
      <Text style={s.providerText} numberOfLines={1}>{providerName}{email ? ` · ${email}` : ''}</Text>
    </View>
  ) : null;

  if (verification) return <PremiumAuthScreen {...shell} title="Confirm your email" subtitle="Keep your existing ACTIV account and social sign-in connected.">
    <SocialEmailVerification code={code} initialEmail={verification.email} onComplete={payload => openDashboard(payload, verification.attempt)} />
    <GradientButton variant="outline" label="Back to sign in" onPress={backToLogin} style={{ marginTop: SPACE.lg }} />
  </PremiumAuthScreen>;

  if (reason === 'no_account') {
    return (
      <PremiumAuthScreen {...shell} title="No account yet" subtitle="Create one and it links automatically next time.">
        <StatusPanel
          icon="person-add"
          kind="info"
          title="Let's create your account"
          actions={(
            <>
              <GradientButton
                label="Create an account"
                iconRight="arrow-forward"
                size="lg"
                onPress={() => navigation.replace('RegistrationStep1', { email, name })}
              />
              <GradientButton variant="outline" label="Back to sign in" onPress={backToLogin} />
            </>
          )}
        >
          <Text style={a.statusText}>
            No ACTIV member account uses <Text style={a.statusStrong}>{email || 'that email'}</Text>
            {providerName ? ` (from ${providerName})` : ''}. Create one and it will be
            linked automatically next time.
          </Text>
          {providerRow}
        </StatusPanel>
      </PremiumAuthScreen>
    );
  }

  if (error) {
    return (
      <PremiumAuthScreen {...shell} title="Could not sign in" subtitle="Try again to continue to your dashboard.">
        <StatusPanel
          icon="error-outline"
          kind="warning"
          title="Sign-in did not finish"
          actions={(
            <>
              {facebookRecovery && <GradientButton label="Try Facebook again" size="lg" disabled={retrying} onPress={retryFacebook} />}
              <GradientButton label={facebookRecovery ? 'Use email and password' : 'Back to sign in'} variant={facebookRecovery ? 'outline' : 'primary'} icon="arrow-back" size="lg" onPress={backToLogin} />
            </>
          )}
        >
          {error}
        </StatusPanel>
      </PremiumAuthScreen>
    );
  }

  if (welcome) {
    return (
      <PremiumAuthScreen {...shell} title={welcome === 'back' ? 'Welcome back!' : `Welcome, ${welcome}!`} subtitle="Opening your dashboard…">
        <StatusPanel icon="check-circle" kind="success" title="You're signed in">
          <ActivityIndicator color={PALETTE.blue} style={{ marginTop: SPACE.lg }} />
        </StatusPanel>
      </PremiumAuthScreen>
    );
  }

  return (
    <PremiumAuthScreen {...shell} title="Signing you in" subtitle="Checking your account with ACTIV…">
      <View style={s.loading} accessibilityRole="progressbar" accessibilityLabel="Signing you in">
        <ActivityIndicator size="large" color={PALETTE.blue} />
        <Text style={s.loadingText}>One moment…</Text>
        {providerRow}
      </View>
    </PremiumAuthScreen>
  );
};

const s = StyleSheet.create({
  provider: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, alignSelf: 'center',
    marginTop: SPACE.lg, paddingHorizontal: SPACE.md, minHeight: 36, borderRadius: 999,
    borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.white, maxWidth: '100%',
  },
  providerText: { ...TYPE.caption, color: PALETTE.textSoft, flexShrink: 1 },
  loading: { alignItems: 'center', paddingVertical: SPACE.xl, gap: SPACE.md },
  loadingText: { ...TYPE.body, color: PALETTE.textMuted },
});

export default SocialSignInScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;

const sharedAppearance_a = a;

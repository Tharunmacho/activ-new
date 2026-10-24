import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Linking, StyleSheet, Pressable } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { homeForRole, clearSession, sanitizeUser, isAdminRole, UNSUPPORTED_ACCOUNT_MESSAGE } from '../../services/session';
import { ENDPOINTS, API_BASE_URL } from '../../config/api.config';
import { useAuthStore } from '../../stores/exampleStore';
import {
  BRAND, PALETTE, SPACE, TYPE, PressableScale,
  PremiumScreen, PREMIUM_OVERLAP, PremiumSheet, PremiumInput, PremiumDivider,
  GradientButton, SocialMark, PortalSwitchCard, BrandLogo, FadeInUp,
} from '../../ui';
import { EyeToggle } from '../profile/formKit';
import { AuthTitle, TextLink } from './authKit';
import { clearPublicAction, takePublicAction } from '../../services/publicNavigation';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuthStore();

  const validateForm = (): boolean => {
    let isValid = true;

    /*
     * The website's rules, exactly: both fields required, and the email only
     * checked for SHAPE. No minimum password length here — that rule belongs to
     * choosing a password, and applying it at sign-in would lock out an
     * account whose password predates it.
     */
    const id = (email || '').trim();
    let emailErr = '';
    if (!id) emailErr = 'Please enter both your email and password';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id)) {
      emailErr = id.includes('@')
        ? 'That email address is not complete — check for a typo.'
        : 'Enter the email address you registered with.';
    }
    if (emailErr) {
      setEmailError(emailErr);
      isValid = false;
    } else {
      setEmailError('');
    }

    const passwordErr = password ? '' : 'Please enter both your email and password';
    if (passwordErr) {
      setPasswordError(passwordErr);
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      /*
       * THE MEMBER SIGN-IN. `portal: 'member'` makes the server refuse an
       * admin account here ("Admins sign in on the admin login page.") before
       * any token is issued — exactly the website's /login. Admins use the
       * Admin sign-in screen, linked at the bottom.
       */
      await clearSession();
      const response = await api.post(ENDPOINTS.AUTH.LOGIN, {
        email: (email || '').toLowerCase().trim(),
        password,
        portal: 'member',
      });

      const payload = response?.data?.data || response?.data || {};
      const token: string = payload?.token || '';
      const role: string = String(payload?.role || payload?.user?.role || 'member');
      if (!token) throw new Error(response?.data?.message || 'Login failed');

      // A backstop for an older server that does not know `portal`.
      if (isAdminRole(role)) {
        await clearSession();
        Alert.alert('Admin account', 'Admins sign in on the admin login screen.', [
          { text: 'Open admin login', onPress: () => navigation.replace('AdminLogin') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      // Never store the password — only who is signed in.
      await login(sanitizeUser(payload?.user || {}), token, role as any);

      const home = await homeForRole(role, payload?.memberDetails);
      if (!home) {
        await clearSession();
        Alert.alert('Use the website', UNSUPPORTED_ACCOUNT_MESSAGE);
        return;
      }
      const resume = takePublicAction();
      navigation.reset(resume ? { index: 1, routes: [{ name: home }, resume] } : { index: 0, routes: [{ name: home }] });
    } catch (error: any) {
      let errorMessage = 'Login failed. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      }

      /*
       * A blocked account is not a failed login attempt.
       *
       * The server answers 403 with its own sentence for someone the
       * association has blocked, and heading that "Login Failed" invites them to
       * try again and again with credentials that are perfectly correct. The
       * title names the real state; the message beneath is the server's.
       */
      const blocked = error.response?.status === 403;
      Alert.alert(blocked ? 'Account Blocked' : 'Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('RegistrationStep1');
  };

  /*
   * SIGN IN WITH GOOGLE / FACEBOOK / LINKEDIN — the website's flow, members only.
   *
   *   GET /auth/oauth/providers                 which buttons have keys set
   *   GET /auth/oauth/:p/start?client=app       opened in the SYSTEM browser;
   *                                             the server runs the provider
   *                                             redirect and, because of
   *                                             `client=app`, returns to
   *                                             activ://auth/social?code=…
   *   POST /auth/oauth/exchange { code }        in SocialSignInScreen
   */
  const [providers, setProviders] = useState<Record<string, boolean> | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    api.get('/auth/oauth/providers')
      .then((res) => {
        const rows = res?.data?.data || res?.data || [];
        const map: Record<string, boolean> = {};
        (Array.isArray(rows) ? rows : []).forEach((row: any) => {
          const key = String(row?.key || '').toLowerCase();
          if (key) map[key] = row?.enabled === true;
        });
        if (!cancelled) setProviders(map);
      })
      .catch(() => { if (!cancelled) setProviders(null); })
      .finally(() => { if (!cancelled) setProvidersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleSocialLogin = async (provider: string) => {
    const key = String(provider || '').toLowerCase();
    const label = provider || 'Social';
    try {
      // The website's rule: only a provider the server reports as enabled
      // starts; an unknown answer (the list failed to load) counts as not yet.
      if (!providers || providers[key] !== true) {
        Alert.alert(`${label} sign-in`, `${label} sign-in is being set up — use your email for now.`);
        return;
      }
      const url = `${API_BASE_URL}/auth/oauth/${encodeURIComponent(key)}/start?client=app`;
      if (typeof Linking?.openURL === 'function') {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn('Social login handler safely caught:', err);
      Alert.alert(`${label} sign-in`, 'Could not open the sign-in page. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    // Was an Alert telling the member to enter their email, with nowhere to
    // enter it. The screen it should always have opened now exists.
    navigation.navigate('ForgotPassword', { portal: 'member' });
  };

  const exploreActiv = () => {
    clearPublicAction();
    navigation.reset({ index: 0, routes: [{ name: 'PublicExplore' }] });
  };

  return (
    <PremiumScreen
      waveHeight={44}
      tone="member"
      header={(
        <View>
          <FadeInUp distance={10} style={styles.topbar}>
            <BrandLogo />
            <PressableScale onPress={exploreActiv} disabled={isLoading} accessibilityRole="button" accessibilityLabel="Skip sign-in" contentStyle={styles.skip}>
              <Text style={styles.skipText}>Skip</Text>
            </PressableScale>
          </FadeInUp>
          <View style={styles.heroRow}>
            <FadeInUp delay={80} style={styles.heroText}>
              <AuthTitle
                eyebrow="Welcome back"
                title="Log in to your account"
                subtitle="Members sign in here."
              />
            </FadeInUp>
          </View>
        </View>
      )}
    >
      <FadeInUp delay={220} style={styles.sheetWrap}>
        <PremiumSheet>
          <PremiumInput
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="email"
            editable={!isLoading}
            returnKeyType="next"
            icon="mail-outline"
            error={emailError}
          />

          <PremiumInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!isLoading}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            icon="lock-outline"
            error={passwordError}
            style={styles.lastField}
            right={<EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />

          {/* Forgot password — the website's link beside the password label. */}
          <View style={styles.optionsRow}>
            <TextLink label="Forgot password?" onPress={handleForgotPassword} />
          </View>

          <GradientButton label="Sign in" onPress={handleLogin} loading={isLoading} size="lg" iconRight="arrow-forward" />
          <GradientButton label="Explore ACTIV" variant="outline" icon="public"
            onPress={exploreActiv} disabled={isLoading}
            style={{ marginTop: SPACE.md }} />

          {/* Don't have an account? Register as member */}
          <View style={styles.promptRow}>
            <Text style={styles.promptText} maxFontSizeMultiplier={1.3}>New to ACTIV? </Text>
            <TextLink label="Create an account" onPress={handleRegister} disabled={isLoading} />
          </View>
        </PremiumSheet>
      </FadeInUp>

      <FadeInUp delay={300} style={styles.below}>
        <PremiumDivider label="Or continue with" />

        {/* Google, LinkedIn, Facebook — one row of round brand marks. Three
            full-width "Continue with …" buttons pushed the admin link below
            the fold; the marks alone are recognised, and each is still a 64px
            target with a spoken label. */}
        <View style={styles.socialRow}>
          {SOCIAL.map((name) => (
            <Pressable
              key={name}
              onPress={() => handleSocialLogin(name)}
              disabled={isLoading || providersLoading}
              accessibilityRole="button"
              accessibilityLabel={`Sign in with ${name}`}
              android_ripple={{ color: 'rgba(15,23,42,0.08)', borderless: true, radius: 34 }}
              style={({ pressed }) => [styles.socialCircle, pressed && styles.socialPressed, (isLoading || providersLoading) && styles.socialDim]}
            >
              <SocialMark provider={name} size={28} />
            </Pressable>
          ))}
        </View>
        <Text style={{ color: PALETTE.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: SPACE.lg }}>Signed up with Google, LinkedIn or Facebook? Use the same sign-in option. No ACTIV password is needed.</Text>

        {/* The way to the admin sign-in, below everything a member needs.
            Pads itself clear of the Android navigation bar. */}
        <PortalSwitchCard
          tone="admin"
          icon="admin-panel-settings"
          question="Are you an administrator?"
          action="Admin sign in"
          accessibilityLabel="Admin login"
          onPress={() => navigation.navigate('AdminLogin')}
          disabled={isLoading}
          style={styles.portal}
        />
      </FadeInUp>
    </PremiumScreen>
  );
};

/** Google, LinkedIn, Facebook — in that order, as before. */
const SOCIAL = ['Google', 'LinkedIn', 'Facebook'];

const styles = StyleSheet.create({
  heroRow: { marginTop: SPACE.lg, marginBottom: SPACE.lg },
  heroText: { minWidth: 0 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  skip: { minHeight: 44, minWidth: 64, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder },
  skipText: { color: PALETTE.white, fontSize: 14, fontWeight: '700' },
  sheetWrap: { marginTop: -PREMIUM_OVERLAP },
  lastField: { marginBottom: SPACE.xs },
  optionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: SPACE.md },
  promptRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: SPACE.md,
  },
  promptText: { ...TYPE.body, color: PALETTE.textMuted },
  below: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
  socialRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACE.xl, marginBottom: SPACE.lg },
  socialCircle: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: PALETTE.white, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0B1A45', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  socialPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
  socialDim: { opacity: 0.5 },
  portal: { marginTop: SPACE.xl },
});

export default LoginScreen;


import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { validateEmail } from '../../utils/validators';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import { useAuthStore } from '../../stores/exampleStore';
import { ADMIN_HOME, clearSession, sanitizeUser, UNSUPPORTED_ACCOUNT_MESSAGE } from '../../services/session';
import {
  PALETTE, SPACE, TYPE,
  PremiumScreen, PREMIUM_OVERLAP, PremiumSheet, PremiumInput, GradientButton,
  BrandLogo, GlassBadge, FadeInUp, PortalSwitchCard,
} from '../../ui';
import { EyeToggle } from '../profile/formKit';
import { AuthTitle, TextLink } from './authKit';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AdminLogin'>;
};

/**
 * ============================================================================
 * THE ADMIN SIGN-IN — the website's /admin/login, in the app's own design
 * ============================================================================
 *
 * Same look as the member sign-in (shared `authKit`), in the admin tone, and deliberately
 * WITHOUT social sign-in and WITHOUT "Register": admin accounts are created by
 * the Super Admin, never by the person themselves.
 *
 * Sends `portal: 'admin'`, so the server refuses a member account here
 * ("This sign-in is for ACTIV administrators…") before any token is issued —
 * the same rule, from the same backend, as the website. Each admin lands on
 * their own dashboard (session.ADMIN_HOME); the events admin lands on event
 * check-in (QR entry passes). The CMS account is website-only and is told so.
 *
 * "Forgot password?" opens the ADMIN reset (`portal: 'admin'`), which only
 * reaches active admin accounts the Super Admin created.
 */
const AdminLoginScreen: React.FC<Props> = ({ navigation }) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuthStore();

  const validate = (): boolean => {
    let ok = true;
    const e = validateEmail(email);
    if (e) { setEmailError(e); ok = false; } else setEmailError('');
    if (!(password || '').length) { setPasswordError('Enter your password'); ok = false; } else setPasswordError('');
    return ok;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await clearSession();
      const response = await api.post(ENDPOINTS.AUTH.LOGIN, {
        email: (email || '').toLowerCase().trim(),
        password,
        portal: 'admin',
      });

      const payload = response?.data?.data || response?.data || {};
      const token: string = payload?.token || '';
      const role: string = String(payload?.role || payload?.user?.role || '');
      if (!token) throw new Error(response?.data?.message || 'Sign-in failed');

      const home = ADMIN_HOME[role];
      if (!home) {
        // A member on an older server that ignores `portal`, or a
        // website-only admin role (the CMS account).
        await clearSession();
        if (role === 'member') {
          Alert.alert('Member account', 'This sign-in is for ACTIV administrators. Members sign in on the member login screen.', [
            { text: 'Open member login', onPress: () => navigation.replace('Login') },
            { text: 'Cancel', style: 'cancel' },
          ]);
        } else {
          Alert.alert('Use the website', UNSUPPORTED_ACCOUNT_MESSAGE);
        }
        return;
      }

      await login(sanitizeUser(payload?.user || {}), token, role as any);
      navigation.reset({ index: 0, routes: [{ name: home }] });
    } catch (error: any) {
      let message = 'Sign-in failed. Please try again.';
      if (error?.response?.data?.message) message = error.response.data.message;
      else if (!error?.response) message = 'Cannot connect to the server. Please check your internet connection.';
      const blocked = error?.response?.status === 403;
      Alert.alert(blocked ? 'Account deactivated' : 'Sign-in failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PremiumScreen
      waveHeight={44}
      tone="admin"
      header={(
        <View>
          <FadeInUp distance={10} style={styles.topRow}>
            <BrandLogo />
            <GlassBadge icon="admin-panel-settings" label="Admin portal" />
          </FadeInUp>
          <View style={styles.heroRow}>
            <FadeInUp delay={80} style={styles.heroText}>
              <AuthTitle
                eyebrow="Administrators"
                title="Admin sign in"
                subtitle="For ACTIV administrators only"
              />
            </FadeInUp>
          </View>
        </View>
      )}
    >
      <FadeInUp delay={220} style={styles.sheetWrap}>
        <PremiumSheet tone="admin">
          <PremiumInput
            tone="admin"
            label="Email address"
            placeholder="admin@activ.org.in"
            value={email}
            onChangeText={(t) => { setEmail(t); setEmailError(''); }}
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
            tone="admin"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!isLoading}
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
            icon="lock-outline"
            error={passwordError}
            style={styles.lastField}
            right={<EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />

          <View style={styles.optionsRow}>
            <TextLink
              tone="admin"
              label="Forgot password?"
              onPress={() => navigation.navigate('ForgotPassword', { portal: 'admin' })}
            />
          </View>

          <GradientButton tone="admin" label="Sign in" onPress={handleSignIn} loading={isLoading} size="lg" iconRight="arrow-forward" />
        </PremiumSheet>
      </FadeInUp>

      <FadeInUp delay={300} style={styles.below}>
        <Text style={styles.note} maxFontSizeMultiplier={1.3}>
          For Block, District, State, Super and Events Admins. Admin accounts are created by the ACTIV Super Admin.
        </Text>

        <PortalSwitchCard
          tone="member"
          icon="person-outline"
          question="Not an administrator?"
          action="Member sign in"
          accessibilityLabel="Member sign in"
          onPress={() => navigation.replace('Login')}
          disabled={isLoading}
          style={styles.portal}
        />
      </FadeInUp>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap' },
  heroRow: { marginTop: SPACE.lg, marginBottom: SPACE.lg },
  heroText: { minWidth: 0 },
  sheetWrap: { marginTop: -PREMIUM_OVERLAP },
  lastField: { marginBottom: SPACE.xs },
  optionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: SPACE.md },
  below: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },
  note: { fontSize: 14, color: PALETTE.textMuted, textAlign: 'center', lineHeight: 21 },
  portal: { marginTop: SPACE.lg },
});

export default AdminLoginScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
